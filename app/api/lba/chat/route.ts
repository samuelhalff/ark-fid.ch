import { createHash } from "node:crypto";
import { promises as dns } from "node:dns";
import { NextResponse } from "next/server";
import {
  extractResponseText,
  getAzureCredentialFromEnv,
  getFoundryAccessToken,
  parseAgentReference,
  resolveFoundryAgentReference,
  type FoundryAgentReference,
  type FoundryAgentReferenceCacheEntry,
} from "@/src/lib/ai/foundryAgent";
import { runWithTimeout } from "@/src/lib/agent/resilience";
import { isUsableLeadTokenSecret } from "@/src/lib/lead-session";
import { createOdooWebsiteLead, postOdooLeadNote } from "@/src/lib/odoo/leads";
import {
  LBA_CHAT_DISCLAIMER,
  LBA_INTERNAL_EMAIL_DOMAINS,
  emailDomain,
  LBA_CHAT_LIMITS,
  LBA_CHAT_REFUSAL,
  hit,
  issueLbaChatSession,
  validateLbaChatRequest,
  verifyLbaChatSession,
  withDisclaimer,
  type Counter,
} from "@/src/lib/lba/chat";

/**
 * Assistant of lba.ark-fid.ch: questions about the AMLA adviser rules and the transparency register.
 *
 * Same proven path as the quote agent (Foundry agent through the Responses API, plain JSON, no
 * streaming), with a light lead capture (email only). Order of checks: origin → rate limit → body → session
 * (first question: email + Turnstile, lead recorded, signed session token issued) → Foundry.
 * Every reply ends with the fixed "not legal advice" sentence, appended here.
 */
export const runtime = "nodejs";
export const revalidate = 0;
export const dynamic = "force-dynamic";

const env = (name: string) => (process.env[name] || "").trim();
const isProd = () => process.env.NODE_ENV === "production";

const DEFAULT_AGENT_NAME = "lba-assistant";
const FOUNDRY_TIMEOUT_MS = 60_000;
const TURNSTILE_TIMEOUT_MS = 6_500;
const MAX_BODY_BYTES = 64 * 1024;

const ipCounters = new Map<string, Counter>();
const sessionCounters = new Map<string, Counter>();
const dayCounter = new Map<string, Counter>();
const agentReferenceCache = new Map<string, FoundryAgentReferenceCacheEntry>();

const json = (body: Record<string, unknown>, status = 200, headers: Record<string, string> = {}) =>
  NextResponse.json(body, { status, headers: { "Cache-Control": "no-store", ...headers } });

const clientIp = (request: Request) => {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    // Rightmost entry is appended by our own front proxy; leftmost values are client-controlled.
    const parts = forwarded.split(",");
    return parts[parts.length - 1]?.trim() || "unknown";
  }
  return request.headers.get("x-real-ip") || "unknown";
};

const originAllowed = (request: Request) => {
  if (!isProd()) return true;
  const origin = (request.headers.get("origin") || "").replace(/\/+$/, "");
  // Browsers always send Origin on a cross-site or same-site POST with a JSON body.
  if (!origin) return false;
  const extra = env("LBA_CHAT_ALLOWED_ORIGINS")
    .split(",")
    .map((value) => value.trim().replace(/\/+$/, ""))
    .filter(Boolean);
  return ["https://lba.ark-fid.ch", ...extra].includes(origin);
};

async function verifyTurnstile(token: string, ip: string): Promise<boolean> {
  const secret = env("TURNSTILE_SECRET_KEY");
  if (!secret) return false;
  const body = new URLSearchParams({ secret, response: token });
  if (ip !== "unknown") body.append("remoteip", ip);
  const res = await runWithTimeout(
    (signal) =>
      fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body,
        signal,
      }),
    TURNSTILE_TIMEOUT_MS,
    "lba_turnstile_verify",
  );
  if (!res.ok) return false;
  const payload = (await res.json()) as { success?: boolean };
  return payload.success === true;
}

async function postJson(url: string, headers: Record<string, string>, body: Record<string, unknown>) {
  const res = await runWithTimeout(
    (signal) =>
      fetch(url, {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal,
      }),
    FOUNDRY_TIMEOUT_MS,
    "lba_foundry_call",
  );
  const text = await res.text();
  if (!res.ok) {
    const error = new Error(`Foundry error ${res.status}: ${text.slice(0, 300)}`) as Error & { status?: number };
    error.status = res.status;
    throw error;
  }
  return text ? JSON.parse(text) : {};
}

async function foundryAuthHeaders(): Promise<Record<string, string>> {
  try {
    const token = await getFoundryAccessToken(getAzureCredentialFromEnv());
    return { Authorization: `Bearer ${token}` };
  } catch (error) {
    const apiKey = env("AZURE_AGENT_API_KEY");
    if (!apiKey) throw error;
    return { "api-key": apiKey };
  }
}

const domainCache = new Map<string, number>();

/**
 * The email domain must exist (MX, A or AAAA). Only positive results are cached, and a resolver
 * failure (timeout, SERVFAIL) lets the visitor through: a DNS incident must not lock people out.
 */
async function emailDomainExists(domain: string): Promise<boolean> {
  if (!domain || domain.length < 4 || !domain.includes(".") || domain.endsWith(".local") || domain.startsWith("example.")) {
    return false;
  }
  const cachedAt = domainCache.get(domain);
  if (cachedAt && Date.now() - cachedAt < 12 * 60 * 60 * 1000) return true;
  const lookup = async (query: Promise<unknown[]>): Promise<"yes" | "no" | "error"> => {
    try {
      const records = await Promise.race([
        query,
        new Promise<unknown[]>((_, reject) => setTimeout(() => reject(new Error("dns_timeout")), 3500)),
      ]);
      return Array.isArray(records) && records.length > 0 ? "yes" : "no";
    } catch (error) {
      const code = (error as { code?: string })?.code;
      return code === "ENOTFOUND" || code === "ENODATA" ? "no" : "error";
    }
  };
  const results = await Promise.all([lookup(dns.resolveMx(domain)), lookup(dns.resolve4(domain)), lookup(dns.resolve6(domain))]);
  if (results.includes("yes")) {
    if (domainCache.size > 500) domainCache.clear();
    domainCache.set(domain, Date.now());
    return true;
  }
  return results.includes("error");
}

/**
 * Records the visitor as a lead: Odoo first, Formspark as well. A lead must land in at least one
 * of them, otherwise the request fails (no silent lead loss).
 */
async function recordLead(email: string, locale: string, firstQuestion: string) {
  const pageUrl = `https://lba.ark-fid.ch/${locale}/`;
  let odooLeadId = 0;
  try {
    odooLeadId =
      (await createOdooWebsiteLead({
        email,
        subject: "Assistant LBA (lba.ark-fid.ch)",
        message: firstQuestion,
        sourceDetail: "lba_assistant",
        pageUrl,
      })) || 0;
  } catch (error) {
    console.error("[lba-chat] Odoo lead creation failed:", error instanceof Error ? error.message : String(error));
  }
  let formspark = false;
  const formsparkUrl = env("FORMSPARK_ACTION_URL");
  if (formsparkUrl) {
    try {
      const res = await runWithTimeout(
        (signal) =>
          fetch(formsparkUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json", Accept: "application/json" },
            body: JSON.stringify({ email, message: firstQuestion, source: "LBA assistant (lba.ark-fid.ch)", page: pageUrl }),
            signal,
          }),
        5_000,
        "lba_formspark_submit",
      );
      formspark = res.ok;
    } catch {
      formspark = false;
    }
  }
  return { recorded: odooLeadId > 0 || formspark, odooLeadId };
}

// Local development only: lets the chat be exercised without a Turnstile widget.
const skipTurnstile = () => !isProd() && env("LBA_CHAT_SKIP_TURNSTILE") === "1";

/** Public configuration for the chat panel (the static page cannot read env vars). */
export async function GET() {
  return json({
    turnstileSiteKey: skipTurnstile() ? "" : env("NEXT_PUBLIC_TURNSTILE_SITE_KEY"),
    maxUserChars: LBA_CHAT_LIMITS.maxUserChars,
  });
}

export async function POST(request: Request) {
  if (!originAllowed(request)) return json({ error: "forbidden" }, 403);

  const ip = clientIp(request);
  const perIp = hit(ipCounters, ip, Number(env("LBA_CHAT_RATE_LIMIT_MAX")) || 20, 10 * 60 * 1000);
  if (!perIp.allowed) {
    return json({ error: "rate_limited" }, 429, { "Retry-After": `${Math.ceil(perIp.retryAfterMs / 1000)}` });
  }

  if (Number(request.headers.get("content-length") || 0) > MAX_BODY_BYTES) {
    return json({ error: "payload_too_large" }, 413);
  }
  let raw: string;
  try {
    raw = await request.text();
  } catch {
    return json({ error: "invalid_request" }, 400);
  }
  if (raw.length > MAX_BODY_BYTES) return json({ error: "payload_too_large" }, 413);
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return json({ error: "invalid_request" }, 400);
  }
  const validation = validateLbaChatRequest(body);
  if (!validation.ok) {
    return json({ error: validation.error }, validation.error === "payload_too_large" ? 413 : 400);
  }
  const { locale, messages, turnstileToken } = validation.data;

  // Checked at request time: the production env is not present during `next build`.
  const secret = env("AGENT_LEAD_TOKEN_SECRET");
  const endpoint = env("AZURE_AGENT_ENDPOINT").replace(/\/+$/, "");
  if (!isUsableLeadTokenSecret(secret) || !endpoint) {
    console.error("[lba-chat] missing configuration");
    return json({ error: "missing_configuration" }, 500);
  }

  // Session: a valid signed token, or (first question) an email plus a Turnstile check, which
  // records the lead and issues the token.
  let session = validation.data.session;
  let verified = verifyLbaChatSession(secret, session);
  if (!verified) {
    const email = validation.data.email;
    if (!email) return json({ error: "email_required" }, 401);
    const domain = emailDomain(email);
    if (!skipTurnstile()) {
      if (!turnstileToken) return json({ error: "turnstile_required" }, 401);
      let human = false;
      try {
        // Turnstile tokens are single-use: verify exactly once per request.
        human = await verifyTurnstile(turnstileToken, ip);
      } catch {
        human = false;
      }
      if (!human) return json({ error: "turnstile_failed" }, 400);
    }
    // After Turnstile, so that the DNS lookups cannot be triggered without solving the challenge.
    if (!(await emailDomainExists(domain))) return json({ error: "invalid_email" }, 400);
    let leadId = 0;
    // Colleagues use the assistant without becoming prospects; local tests never create leads.
    if (!LBA_INTERNAL_EMAIL_DOMAINS.has(domain) && !skipTurnstile()) {
      const lead = await recordLead(email, locale, messages[messages.length - 1].content);
      if (!lead.recorded) {
        console.error("[lba-chat] Lead lost: neither Odoo nor Formspark accepted it");
        return json({ error: "crm_unavailable" }, 502);
      }
      leadId = lead.odooLeadId;
    }
    session = issueLbaChatSession(secret, leadId);
    verified = verifyLbaChatSession(secret, session);
    if (!verified) return json({ error: "agent_error" }, 500);
  }
  const sessionId = verified.id;

  const perSession = hit(sessionCounters, sessionId, LBA_CHAT_LIMITS.maxTurnsPerSession, LBA_CHAT_LIMITS.sessionTtlMs);
  if (!perSession.allowed) return json({ error: "session_limit", session }, 429);
  // Overall daily budget, so a distributed abuse cannot run up the bill.
  const perDay = hit(dayCounter, "all", Number(env("LBA_CHAT_DAILY_MAX")) || 1500, 24 * 60 * 60 * 1000);
  if (!perDay.allowed) return json({ error: "rate_limited", session }, 429, { "Retry-After": "3600" });

  try {
    const apiVersion =
      env("AZURE_AGENT_CHAT_RESPONSES_API_VERSION") || env("AZURE_AGENT_RESPONSES_API_VERSION") || "2025-11-15-preview";
    const agentName = env("LBA_AGENT_NAME") || DEFAULT_AGENT_NAME;
    const authHeaders = await foundryAuthHeaders();

    let agent: FoundryAgentReference;
    try {
      agent = await runWithTimeout(
        () =>
          resolveFoundryAgentReference({
            endpoint,
            agentName,
            apiVersion,
            headers: authHeaders,
            cache: agentReferenceCache,
          }),
        15_000,
        "lba_agent_lookup",
      );
    } catch {
      agent = parseAgentReference(agentName);
    }

    const base = `${endpoint}/openai`;
    const conversation = await postJson(`${base}/conversations?api-version=${apiVersion}`, authHeaders, {
      items: [
        {
          type: "message",
          role: "system",
          content: `Interface language of the page: ${locale}. Reply in the language of the user's last message; if unclear, use ${locale}.`,
        },
        ...messages.map((message) => ({ type: "message", role: message.role, content: message.content })),
      ],
    });
    const response = await postJson(`${base}/responses?api-version=${apiVersion}`, authHeaders, {
      conversation: conversation.id,
      agent,
      safety_identifier: createHash("sha256").update(`lba:${sessionId}`).digest("hex"),
    });

    const reply = extractResponseText(response);
    if (!reply) throw new Error("Empty response from agent");
    if (verified.leadId) {
      // Keeps the conversation on the lead in Odoo (best effort, never blocks the reply).
      void postOdooLeadNote(
        verified.leadId,
        ["LBA assistant conversation update", "", `User: ${messages[messages.length - 1].content}`, "", `Assistant: ${reply}`].join("\n"),
      );
    }
    return json({ reply: withDisclaimer(reply, locale), disclaimer: LBA_CHAT_DISCLAIMER[locale], session });
  } catch (error) {
    const status = (error as { status?: number })?.status;
    console.error("[lba-chat] agent call failed", status || "", error instanceof Error ? error.message.slice(0, 200) : "");
    if (status === 429) return json({ error: "rate_limited", session }, 429, { "Retry-After": "30" });
    // Azure's content filter rejects some prompts (e.g. injection attempts) with a 400.
    if (status === 400 && error instanceof Error && /content_filter|content management policy/i.test(error.message)) {
      return json({
        reply: withDisclaimer(LBA_CHAT_REFUSAL[locale], locale),
        disclaimer: LBA_CHAT_DISCLAIMER[locale],
        session,
      });
    }
    return json({ error: "agent_error", session }, 502);
  }
}
