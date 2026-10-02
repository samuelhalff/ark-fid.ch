#!/usr/bin/env node
/**
 * Creates a new version of the Foundry agent behind the assistant of lba.ark-fid.ch.
 *
 * The agent definition is built from src/lba/agent/: instructions.md + page-summary.fr.md +
 * legal-texts.fr.md + sources.json. It has no tools: the assistant answers only from those texts.
 *
 *   node scripts/lba-agent-sync.mjs            # show what would be sent (sizes, model)
 *   node scripts/lba-agent-sync.mjs --apply    # create the new version in Foundry
 *
 * Env: AZURE_AGENT_ENDPOINT, AZURE_TENANT_ID, AZURE_CLIENT_ID, AZURE_CLIENT_SECRET (from .env),
 * optional LBA_AGENT_NAME (default lba-assistant), LBA_AGENT_MODEL (default gpt-5.2).
 * Run it again whenever the page content or the legal texts change.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DIR = path.join(ROOT, "src/lba/agent");
const apply = process.argv.includes("--apply");

// Minimal .env reader (no dependency); real environment variables win.
const envFile = path.join(ROOT, ".env");
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, "utf8").split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!m || process.env[m[1]] !== undefined) continue;
    process.env[m[1]] = m[2].replace(/^(['"])(.*)\1$/, "$2");
  }
}
const need = (name) => {
  const value = (process.env[name] || "").trim();
  if (!value) throw new Error(`Missing ${name}`);
  return value;
};

const read = (file) => fs.readFileSync(path.join(DIR, file), "utf8").trim();
const sources = JSON.parse(read("sources.json"));
const instructions = [
  read("instructions.md"),
  "# OFFICIAL SOURCES\n\n" +
    sources
      .map((s) => `- ${s.title_fr} — FR: ${s.url_fr}${s.url_de ? ` — DE: ${s.url_de}` : ""}${s.url_en ? ` — EN: ${s.url_en}` : ""}`)
      .join("\n"),
  "# PAGE SUMMARY (lba.ark-fid.ch, French)\n\n" + read("page-summary.fr.md"),
  "# LEGAL TEXTS (verbatim, French, in force on 1 October 2026)\n\n" + read("legal-texts.fr.md"),
].join("\n\n---\n\n");

const name = (process.env.LBA_AGENT_NAME || "lba-assistant").trim();
const model = (process.env.LBA_AGENT_MODEL || "gpt-5.2").trim();
const definition = { kind: "prompt", model, instructions };
console.log(`agent ${name} | model ${model} | instructions ${instructions.length} chars`);
if (!apply) {
  console.log("Dry run. Pass --apply to create the new version.");
  process.exit(0);
}

const endpoint = need("AZURE_AGENT_ENDPOINT").replace(/\/+$/, "");
const apiVersion = (process.env.AZURE_AGENT_RESPONSES_API_VERSION || "2025-11-15-preview").trim();
const tokenRes = await fetch(`https://login.microsoftonline.com/${need("AZURE_TENANT_ID")}/oauth2/v2.0/token`, {
  method: "POST",
  body: new URLSearchParams({
    client_id: need("AZURE_CLIENT_ID"),
    client_secret: need("AZURE_CLIENT_SECRET"),
    grant_type: "client_credentials",
    scope: "https://ai.azure.com/.default",
  }),
});
const { access_token: token } = await tokenRes.json();
if (!token) throw new Error(`Token request failed (${tokenRes.status})`);

const res = await fetch(`${endpoint}/agents/${encodeURIComponent(name)}/versions?api-version=${apiVersion}`, {
  method: "POST",
  headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  body: JSON.stringify({
    description: `lba.ark-fid.ch assistant — synced ${new Date().toISOString().slice(0, 10)}`,
    definition,
  }),
});
const text = await res.text();
if (!res.ok) throw new Error(`Foundry ${res.status}: ${text.slice(0, 500)}`);
const created = JSON.parse(text);
console.log(`created ${created.id || `${name}:${created.version}`}`);
