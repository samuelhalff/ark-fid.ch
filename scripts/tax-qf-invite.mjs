#!/usr/bin/env node
/**
 * Manual invitation to the tax questionnaire (staff), through the same path as the February
 * campaign: the year's return is created pre-filled from the client's latest submitted one, and
 * the invitation e-mail (link + one-time code on opening) goes to the client.
 *
 *   TAX_QF_CRON_SECRET=… node scripts/tax-qf-invite.mjs --client <clientKey> --year 2025 [--email a@b.ch] [--dry-run]
 *   TAX_QF_CRON_SECRET=… node scripts/tax-qf-invite.mjs --key-from "client@mail.ch|NOM|Prénom" --year 2025
 *   TAX_QF_CRON_SECRET=… node scripts/tax-qf-invite.mjs --prefill-ref <ref> --year 2025 --no-email
 *
 * --client      client key (column ClientKey of "Suivi questionnaires")
 * --key-from    computes the client key from the e-mail and names used in last year's questionnaire
 * --email       address to invite (default: the client's address on record)
 * --prefill-ref case prepared by Ark: reads _system/staff-prefill/<ref>.json in the tax library
 *               ({ identity: { email, firstName, lastName }, language, answers, notes }); the file is
 *               emptied once the case exists
 * --no-email    no e-mail to the client: the link is written to _system/staff-prefill/<result-ref>.result.json
 *               (default <result-ref> = <prefill-ref>) for staff to send themselves; it is never printed
 * --url         cron endpoint (default https://tax.ark-fid.ch/api/tax-questionnaire/cron)
 * The secret is read from the environment only (never a command-line argument).
 */
import { createHash, randomBytes } from "node:crypto";

const args = process.argv.slice(2);
const opt = (name) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && i + 1 < args.length ? args[i + 1] : "";
};
const flag = (name) => args.includes(`--${name}`);

const normalise = (s) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9@.+-]+/g, " ").trim();
const clientKeyOf = (email, lastName, firstName) =>
  createHash("sha256").update(`ark-tax-qf-client|${normalise(email)}|${normalise(lastName)}|${normalise(firstName)}`).digest("hex").slice(0, 24);

function usage(message) {
  if (message) console.error(message);
  console.error('Usage: node scripts/tax-qf-invite.mjs (--client <key> | --key-from "email|NOM|Prénom") --year <yyyy> [--email <address>] [--dry-run] [--url <endpoint>]');
  process.exit(2);
}

let clientKey = opt("client");
const keyFrom = opt("key-from");
if (!clientKey && keyFrom) {
  const [email, lastName, firstName] = keyFrom.split("|");
  if (!email || !lastName || firstName === undefined) usage("--key-from expects \"email|NOM|Prénom\"");
  clientKey = clientKeyOf(email, lastName, firstName);
}
const taxYear = Number(opt("year"));
const prefillRef = opt("prefill-ref");
const resultRef = opt("result-ref") || prefillRef;
const noEmail = flag("no-email");
if (!prefillRef && !/^[a-f0-9]{16,64}$/.test(clientKey)) usage("Missing or invalid client key.");
if (noEmail && !resultRef) usage("--no-email needs --result-ref (or --prefill-ref).");
if (!Number.isInteger(taxYear)) usage("Missing --year.");
const secret = (process.env.TAX_QF_CRON_SECRET || "").trim();
if (secret.length < 32) usage("TAX_QF_CRON_SECRET is not set in the environment.");

const url = opt("url") || process.env.TAX_QF_CRON_URL || "https://tax.ark-fid.ch/api/tax-questionnaire/cron";
const body = {
  task: "invite",
  clientKey: clientKey || undefined,
  prefillRef: prefillRef || undefined,
  resultRef: resultRef || undefined,
  noEmail,
  taxYear,
  email: opt("email") || undefined,
  dryRun: flag("dry-run"),
  idempotencyKey: `invite-${clientKey || prefillRef}-${taxYear}-${randomBytes(4).toString("hex")}`,
};

const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json", "x-tax-qf-cron": secret }, body: JSON.stringify(body) });
const data = await res.json().catch(() => ({}));
console.log(`HTTP ${res.status}`, JSON.stringify({ clientKey: clientKey || undefined, prefillRef: prefillRef || undefined, ...data }));
process.exit(res.ok ? 0 : 1);
