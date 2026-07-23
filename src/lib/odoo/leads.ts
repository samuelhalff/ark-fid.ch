export type LeadTranscriptMessage = {
  role: "user" | "assistant";
  content: string;
};

export type LeadUtmParams = {
  source?: string;
  medium?: string;
  campaign?: string;
  term?: string;
  content?: string;
};

export type WebsiteLeadInput = {
  name?: string;
  email: string;
  companyName?: string;
  phone?: string;
  subject?: string;
  message?: string;
  sourceDetail: string;
  pageUrl?: string;
  referrer?: string;
  gaClientId?: string;
  utm?: LeadUtmParams;
  transcript?: LeadTranscriptMessage[];
  assignedUserId?: number;
  sourceId?: number;
};

type OdooConfig = {
  url: string;
  db: string;
  token: string;
  timeoutMs: number;
  captureInternal: boolean;
};

const WEBSITE_SOURCE = "ark-fid.ch";
const DEFAULT_ODOO_TIMEOUT_MS = 7000;
const INTERNAL_DOMAINS = new Set(["ark-fid.ch", "pbm.law"]);
const fieldsCache = new Map<string, { fields: Set<string>; expiresAt: number }>();
const userCache = new Map<string, { id: number | null; expiresAt: number }>();
const FIELDS_CACHE_TTL_MS = 10 * 60 * 1000;

const trim = (value?: string) => (value || "").trim();

const runOdooWithTimeout = async <T>(
  task: (signal: AbortSignal) => Promise<T>,
  timeoutMs: number,
  label: string,
) => {
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(new Error(`${label}_timeout`)),
    timeoutMs,
  );
  try {
    return await task(controller.signal);
  } finally {
    clearTimeout(timeout);
  }
};

export function plainTextToHtml(text: string) {
  return trim(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
    .replace(/\r\n/g, "\n")
    .replace(/\n/g, "<br>");
}

function formatUtmLine(utm?: LeadUtmParams) {
  if (!utm) return null;
  const parts = (["source", "medium", "campaign", "term", "content"] as const)
    .filter((key) => trim(utm[key]))
    .map((key) => `${key}=${trim(utm[key])}`);
  return parts.length ? `UTM: ${parts.join(" ")}` : null;
}

export function formatLeadDescription(input: WebsiteLeadInput) {
  const lines = [
    `Source: ${WEBSITE_SOURCE}`,
    `Source detail: ${input.sourceDetail}`,
    input.name ? `Name: ${input.name}` : null,
    `Email: ${input.email}`,
    input.companyName ? `Company: ${input.companyName}` : null,
    input.phone ? `Phone: ${input.phone}` : null,
    input.subject ? `Subject: ${input.subject}` : null,
    input.pageUrl ? `Page: ${input.pageUrl}` : null,
    input.referrer ? `Referrer: ${input.referrer}` : null,
    // Joins this lead to GA acquisition data for offline conversion import.
    input.gaClientId ? `GA Client ID: ${input.gaClientId}` : null,
    formatUtmLine(input.utm),
    input.message ? `Message:\n${input.message}` : null,
  ].filter(Boolean);

  if (input.transcript?.length) {
    lines.push(
      "Conversation:",
      ...input.transcript.map(
        (message) => `${message.role}: ${message.content.trim()}`,
      ),
    );
  }

  return lines.join("\n\n");
}

export function buildOdooLeadValues(
  input: WebsiteLeadInput,
  availableFields: Set<string>,
) {
  const name = trim(input.name);
  const email = trim(input.email);
  const companyName = trim(input.companyName);
  const leadTitle = name || companyName || email;
  const values: Record<string, unknown> = {
    name: leadTitle || "Website lead",
    type: "opportunity",
    contact_name: name || undefined,
    email_from: trim(input.email),
    phone: trim(input.phone) || undefined,
    partner_name: companyName || undefined,
    description: formatLeadDescription(input),
  };

  for (const key of Object.keys(values)) {
    if (values[key] === undefined || values[key] === "") delete values[key];
  }

  if (
    availableFields.has("source_id") &&
    input.sourceId &&
    Number.isFinite(input.sourceId)
  ) {
    values.source_id = input.sourceId;
  }
  if (
    availableFields.has("user_id") &&
    input.assignedUserId &&
    Number.isFinite(input.assignedUserId)
  ) {
    values.user_id = input.assignedUserId;
  }

  return values;
}

const getOdooConfig = (): OdooConfig | null => {
  const url = trim(process.env.ODOO_OWN_URL || process.env.ODOO_URL);
  const db = trim(process.env.ODOO_OWN_DB || process.env.ODOO_DB);
  const token = trim(process.env.ODOO_OWN_TOKEN || process.env.ODOO_TOKEN);
  if (!url || !db || !token) return null;
  return {
    url: url.replace(/\/+$/, ""),
    db,
    token,
    timeoutMs: Number.parseInt(
      process.env.ODOO_TIMEOUT_MS || `${DEFAULT_ODOO_TIMEOUT_MS}`,
      10,
    ),
    captureInternal: process.env.ODOO_CAPTURE_INTERNAL_LEADS === "1",
  };
};

const getEmailDomain = (email: string) =>
  email.split("@")[1]?.toLowerCase().trim() || "";

const shouldSkipInternalLead = (email: string, config: OdooConfig) =>
  !config.captureInternal && INTERNAL_DOMAINS.has(getEmailDomain(email));

const odooJson2 = async (
  config: OdooConfig,
  model: string,
  method: string,
  body: Record<string, unknown>,
) => {
  const res = await runOdooWithTimeout(
    (signal) =>
      fetch(`${config.url}/json/2/${model}/${method}`, {
        method: "POST",
        headers: {
          Authorization: `bearer ${config.token}`,
          "X-Odoo-Database": config.db,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
        signal,
      }),
    config.timeoutMs,
    `odoo_${model}_${method}`,
  );
  const text = await res.text();
  if (!res.ok) {
    // Odoo error payloads echo submitted values (names, messages, …), so the
    // body must never reach a log line. Allowlist only the exception class
    // name, which is a code identifier, never user input.
    let errorName = "";
    try {
      const parsed = JSON.parse(text) as { name?: unknown };
      if (typeof parsed.name === "string") {
        errorName = parsed.name.replace(/[^\w.]/g, "").slice(0, 120);
      }
    } catch {
      // Non-JSON body (proxy error page, …): log status only.
    }
    throw new Error(
      `Odoo ${model}.${method} failed (${res.status})${errorName ? ` ${errorName}` : ""}`,
    );
  }
  return text ? JSON.parse(text) : {};
};

const unwrapOdooResult = (payload: unknown) => {
  if (payload && typeof payload === "object" && "result" in payload) {
    return (payload as { result: unknown }).result;
  }
  return payload;
};

const getLeadFields = async (config: OdooConfig) => {
  const cacheKey = `${config.url}::${config.db}`;
  const cached = fieldsCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.fields;

  const payload = await odooJson2(config, "crm.lead", "fields_get", {
    attributes: ["type", "string"],
  });
  const result = unwrapOdooResult(payload);
  const fields = new Set(
    result && typeof result === "object" ? Object.keys(result) : [],
  );
  fieldsCache.set(cacheKey, {
    fields,
    expiresAt: Date.now() + FIELDS_CACHE_TTL_MS,
  });
  return fields;
};

const getDefaultLeadUserId = async (config: OdooConfig) => {
  const userNeedle = trim(process.env.ODOO_LEAD_DEFAULT_USER || "samuel");
  if (!userNeedle) return null;

  const cacheKey = `${config.url}::${config.db}::${userNeedle.toLowerCase()}`;
  const cached = userCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.id;

  const payload = await odooJson2(config, "res.users", "search_read", {
    domain: [
      "|",
      "|",
      ["login", "ilike", userNeedle],
      ["email", "ilike", userNeedle],
      ["name", "ilike", userNeedle],
    ],
    fields: ["id", "name", "login", "email"],
    limit: 1,
  });
  const result = unwrapOdooResult(payload);
  const id =
    Array.isArray(result) && typeof result[0]?.id === "number"
      ? result[0].id
      : null;
  userCache.set(cacheKey, {
    id,
    expiresAt: Date.now() + FIELDS_CACHE_TTL_MS,
  });
  return id;
};

const getWebsiteSourceId = async (config: OdooConfig) => {
  const sourceName = trim(process.env.ODOO_LEAD_SOURCE_NAME || WEBSITE_SOURCE);
  if (!sourceName) return null;

  const cacheKey = `${config.url}::${config.db}::source::${sourceName.toLowerCase()}`;
  const cached = userCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.id;

  const payload = await odooJson2(config, "utm.source", "search_read", {
    domain: [["name", "=ilike", sourceName]],
    fields: ["id", "name"],
    limit: 1,
  });
  const result = unwrapOdooResult(payload);
  const id =
    Array.isArray(result) && typeof result[0]?.id === "number"
      ? result[0].id
      : null;
  userCache.set(cacheKey, {
    id,
    expiresAt: Date.now() + FIELDS_CACHE_TTL_MS,
  });
  return id;
};

export async function createOdooWebsiteLead(input: WebsiteLeadInput) {
  const config = getOdooConfig();
  if (!config || shouldSkipInternalLead(input.email, config)) return null;

  const fields = await getLeadFields(config);
  const assignedUserId = input.assignedUserId || (await getDefaultLeadUserId(config));
  const sourceId = input.sourceId || (await getWebsiteSourceId(config));
  const values = buildOdooLeadValues(
    { ...input, assignedUserId, ...(sourceId ? { sourceId } : {}) },
    fields,
  );
  const payload = await odooJson2(config, "crm.lead", "create", {
    vals_list: [values],
  });
  const result = unwrapOdooResult(payload);
  if (Array.isArray(result) && result[0]) return Number(result[0]);
  if (typeof result === "number") return result;
  return null;
}

export async function postOdooLeadNote(
  leadId: number | undefined,
  note: string,
  { retries = 1 }: { retries?: number } = {},
) {
  const config = getOdooConfig();
  if (!config || !leadId || !Number.isFinite(leadId)) return false;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      await odooJson2(config, "crm.lead", "message_post", {
        ids: [leadId],
        body: plainTextToHtml(note),
        subtype_xmlid: "mail.mt_note",
      });
      return true;
    } catch (error) {
      // Conversation context is lost for good if this note never lands, so
      // failures must be visible in server logs (error message only, with
      // email/phone-like tokens already redacted upstream).
      const message = error instanceof Error ? error.message : String(error);
      console.error(
        `[odoo] message_post failed for lead ${leadId} (attempt ${attempt + 1}/${retries + 1}):`,
        message,
      );
      // A timeout is ambiguous — Odoo may have committed the note before the
      // abort fired. Retrying would risk a duplicate chatter note, so only
      // retry failures where Odoo answered with an error (transaction rolled
      // back).
      if (message.includes("_timeout")) return false;
    }
  }
  return false;
}
