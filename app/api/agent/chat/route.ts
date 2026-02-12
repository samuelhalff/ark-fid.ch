import { NextResponse } from "next/server";
import { ClientSecretCredential } from "@azure/identity";
import { createHash, randomBytes, timingSafeEqual } from "crypto";
import { z } from "zod";
import { promises as dns } from "dns";
import {
  extractResponseText,
  getAzureCredentialFromEnv,
  getFoundryAccessToken,
  isLegacyAssistantId,
  parseAgentReference,
  resolveFoundryAgentReference,
  type FoundryAgentReferenceCacheEntry,
} from "@/src/lib/ai/foundryAgent";

export const runtime = "nodejs";
export const revalidate = 0;

type Role = "user" | "assistant";

const RATE_LIMIT_WINDOW_MS = Number.parseInt(
  process.env.AZURE_AGENT_RATE_LIMIT_WINDOW_MS || "600000",
  10
);
const RATE_LIMIT_MAX = Number.parseInt(
  process.env.AZURE_AGENT_RATE_LIMIT_MAX || "12",
  10
);

const rateLimitStore = new Map<string, { count: number; resetAt: number }>();
const agentReferenceCache = new Map<string, FoundryAgentReferenceCacheEntry>();

const emptyToUndefined = (value: unknown) => {
  if (typeof value === "string" && value.trim() === "") return undefined;
  return value;
};

const optionalTrimmedString = (max: number) =>
  z.preprocess(emptyToUndefined, z.string().trim().max(max).optional());

const trimmedEmail = () =>
  z.preprocess(
    (value) => (typeof value === "string" ? value.trim() : value),
    z.string().email()
  );

const utmSchema = z
  .object({
    source: optionalTrimmedString(160),
    medium: optionalTrimmedString(160),
    campaign: optionalTrimmedString(200),
    term: optionalTrimmedString(160),
    content: optionalTrimmedString(200),
  })
  .optional();

const messageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().trim().min(1).max(2000),
});

const requestSchema = z
  .object({
    email: trimmedEmail(),
    name: optionalTrimmedString(120),
    companyName: optionalTrimmedString(160),
    phone: optionalTrimmedString(80),
    messages: z.array(messageSchema).max(12).optional(),
    leadOnly: z.boolean().optional(),
    leadMessage: optionalTrimmedString(240),
    leadId: optionalTrimmedString(120),
    leadToken: optionalTrimmedString(240),
    sessionId: optionalTrimmedString(160),
    pageUrl: optionalTrimmedString(600),
    referrer: optionalTrimmedString(600),
    utm: utmSchema,
    turnstileToken: z.preprocess(
      emptyToUndefined,
      z.string().trim().min(1).optional()
    ),
  })
  .superRefine((value, ctx) => {
    const messages = value.messages ?? [];
    if (!value.leadOnly && messages.length < 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "messages must include at least one item",
        path: ["messages"],
      });
    }
    if (!value.leadOnly) {
      if (!value.leadId || !value.leadToken) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "leadId and leadToken required",
          path: ["leadId"],
        });
      }
    }
  });

const getEnv = (key: string, fallback?: string) =>
  process.env[key] || fallback || "";

const normalizeFieldKey = (value: string) =>
  value.includes(" ") ? value.replace(/ /g, "_x0020_") : value;

const getFieldKey = (key: string, fallback: string) =>
  normalizeFieldKey(getEnv(key, fallback).trim());

const getRateLimitKey = (request: Request) => {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0]?.trim() || "unknown";
  }
  return request.headers.get("x-real-ip") || "unknown";
};

const normalizeOrigin = (origin: string) => origin.replace(/\/+$/, "");

const getAllowedOrigins = () => {
  const configured = (getEnv("AGENT_CHAT_ALLOWED_ORIGINS") || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  const defaults = [getEnv("NEXT_PUBLIC_SITE_URL"), "https://ark-fid.ch"].filter(
    Boolean
  );
  const candidates = [...defaults, ...configured].map(normalizeOrigin);
  if (process.env.NODE_ENV !== "production") {
    candidates.push("http://localhost:3000", "http://localhost:5000");
  }
  return new Set(candidates);
};

const allowedOrigins = getAllowedOrigins();

const enforceOrigin = (request: Request) => {
  if (process.env.NODE_ENV !== "production") return true;
  const origin = request.headers.get("origin");
  if (!origin) return true;
  return allowedOrigins.has(normalizeOrigin(origin));
};

const applyRateLimit = (key: string) => {
  const now = Date.now();
  for (const [entryKey, entry] of rateLimitStore.entries()) {
    if (entry.resetAt <= now) rateLimitStore.delete(entryKey);
  }
  const entry = rateLimitStore.get(key);
  if (!entry || entry.resetAt <= now) {
    const resetAt = now + RATE_LIMIT_WINDOW_MS;
    rateLimitStore.set(key, { count: 1, resetAt });
    return { allowed: true, retryAfterMs: RATE_LIMIT_WINDOW_MS };
  }
  if (entry.count >= RATE_LIMIT_MAX) {
    return { allowed: false, retryAfterMs: entry.resetAt - now };
  }
  entry.count += 1;
  rateLimitStore.set(key, entry);
  return { allowed: true, retryAfterMs: entry.resetAt - now };
};

const FORMSPARK_ACTION_URL = process.env.FORMSPARK_ACTION_URL;
const GRAPH_SCOPE = "https://graph.microsoft.com/.default";
const GRAPH_TIMEOUT_MS = Number.parseInt(
  process.env.MSGRAPH_TIMEOUT_MS || "6500",
  10
);
const GRAPH_CACHE_TTL_MS = 10 * 60 * 1000;
const SP_SITE_HOSTNAME = (
  process.env.SP_SITE_HOSTNAME || "arkfiduciaire.sharepoint.com"
).trim();
const SP_SITE_PATH = (process.env.SP_SITE_PATH || "").trim();
const SP_SITE_ID = (process.env.SP_SITE_ID || "").trim();
const SP_LEADS_LIST_ID = (process.env.SP_LEADS_LIST_ID || "").trim();
const SP_LEADS_LIST_NAME = (process.env.SP_LEADS_LIST_NAME || "").trim();
const SP_MESSAGES_LIST_ID = (process.env.SP_MESSAGES_LIST_ID || "").trim();
const SP_MESSAGES_LIST_NAME = (process.env.SP_MESSAGES_LIST_NAME || "").trim();
const LEAD_TOKEN_SECRET = (process.env.AGENT_LEAD_TOKEN_SECRET || "").trim();
const DOMAIN_VALIDATION_TTL_MS = 12 * 60 * 60 * 1000;
const DOMAIN_VALIDATION_TIMEOUT_MS = 3500;
const DOMAIN_VALIDATION_MAX_ENTRIES = 400;
const TURNSTILE_SECRET_KEY = process.env.TURNSTILE_SECRET_KEY;
const INVALID_EMAIL_DOMAINS = (
  process.env.INVALID_EMAIL_DOMAINS ||
  "example.com,example.org,example.net,test.com,test.ch,invalid,localhost"
)
  .split(",")
  .map((value) => value.trim().toLowerCase())
  .filter(Boolean);
const invalidDomains = new Set(INVALID_EMAIL_DOMAINS);
const domainValidationCache = new Map<
  string,
  { valid: boolean; checkedAt: number }
>();
const DEBUG_VALIDATION = process.env.DEBUG_AGENT === "1";

const leadFieldMap = {
  title: getFieldKey("SP_LEADS_FIELD_TITLE", "Title"),
  email: getFieldKey("SP_LEADS_FIELD_EMAIL", "Email"),
  tokenHash: getFieldKey("SP_LEADS_FIELD_TOKEN_HASH", "LeadTokenHash"),
  transcript: getFieldKey("SP_LEADS_FIELD_TRANSCRIPT", "Messages"),
  name: getFieldKey("SP_LEADS_FIELD_NAME", "LeadName"),
  companyName: getFieldKey("SP_LEADS_FIELD_COMPANY", "LeadCompany"),
  phone: getFieldKey("SP_LEADS_FIELD_PHONE", "LeadPhone"),
  status: getFieldKey("SP_LEADS_FIELD_STATUS", "LeadStatus"),
  source: getFieldKey("SP_LEADS_FIELD_SOURCE", "LeadSource"),
  sessionId: getFieldKey("SP_LEADS_FIELD_SESSION_ID", "LeadSessionId"),
  pageUrl: getFieldKey("SP_LEADS_FIELD_PAGE_URL", "LeadPageUrl"),
  referrer: getFieldKey("SP_LEADS_FIELD_REFERRER", "LeadReferrer"),
  utmSource: getFieldKey("SP_LEADS_FIELD_UTM_SOURCE", "LeadUtmSource"),
  utmMedium: getFieldKey("SP_LEADS_FIELD_UTM_MEDIUM", "LeadUtmMedium"),
  utmCampaign: getFieldKey("SP_LEADS_FIELD_UTM_CAMPAIGN", "LeadUtmCampaign"),
  utmTerm: getFieldKey("SP_LEADS_FIELD_UTM_TERM", "LeadUtmTerm"),
  utmContent: getFieldKey("SP_LEADS_FIELD_UTM_CONTENT", "LeadUtmContent"),
  lastMessageAt: getFieldKey(
    "SP_LEADS_FIELD_LAST_MESSAGE_AT",
    "LeadLastMessageAt"
  ),
  lastUserMessage: getFieldKey(
    "SP_LEADS_FIELD_LAST_USER_MESSAGE",
    "LeadLastUserMessage"
  ),
  lastAssistantMessage: getFieldKey(
    "SP_LEADS_FIELD_LAST_ASSISTANT_MESSAGE",
    "LeadLastAssistantMessage"
  ),
  initialMessage: getFieldKey(
    "SP_LEADS_FIELD_INITIAL_MESSAGE",
    "LeadInitialMessage"
  ),
};

const messageFieldMap = {
  title: getFieldKey("SP_MESSAGES_FIELD_TITLE", "Title"),
  leadId: getFieldKey("SP_MESSAGES_FIELD_LEAD_ID", "LeadId"),
  role: getFieldKey("SP_MESSAGES_FIELD_ROLE", "Role"),
  content: getFieldKey("SP_MESSAGES_FIELD_CONTENT", "Content"),
  timestamp: getFieldKey("SP_MESSAGES_FIELD_TIMESTAMP", "Timestamp"),
  sessionId: getFieldKey("SP_MESSAGES_FIELD_SESSION_ID", "SessionId"),
};

type GraphTokenCache = { token: string; expiresAt: number };
const graphTokenCache: GraphTokenCache = { token: "", expiresAt: 0 };
const graphSiteCache = { id: "", expiresAt: 0 };
const graphListCache = new Map<string, { id: string; expiresAt: number }>();

const buildSystemPrompt = (data: z.infer<typeof requestSchema>) => {
  const profile = [
    data.name ? `Name: ${data.name}` : null,
    data.email ? `Email: ${data.email}` : null,
    data.companyName ? `Company: ${data.companyName}` : null,
    data.phone ? `Phone: ${data.phone}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  return [
    "You are Ark Fiduciaire's assistant.",
    "Always answer in the user's language and do not mix languages.",
    "Use the language of the latest user message in the conversation.",
    profile ? `Client details:\n${profile}` : null,
  ]
    .filter(Boolean)
    .join("\n");
};

const buildConversationItems = (
  data: z.infer<typeof requestSchema>,
  messages: z.infer<typeof messageSchema>[]
) => {
  const systemPrompt = buildSystemPrompt(data);
  return [
    {
      type: "message",
      role: "system",
      content: systemPrompt,
    },
    ...messages.map((message) => ({
      type: "message",
      role: message.role,
      content: message.content,
    })),
  ];
};

const normalizeSitePath = (path: string) => {
  const trimmed = path.trim();
  if (!trimmed) return "";
  const withSlash = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  return withSlash.replace(/\/+$/, "");
};

const isSharePointConfigured = () => {
  const siteReady = Boolean(SP_SITE_ID || (SP_SITE_HOSTNAME && SP_SITE_PATH));
  const leadsReady = Boolean(SP_LEADS_LIST_ID || SP_LEADS_LIST_NAME);
  return siteReady && leadsReady;
};

const isMessagesListConfigured = () =>
  Boolean(SP_MESSAGES_LIST_ID || SP_MESSAGES_LIST_NAME);

const getGraphCredential = () => {
  const tenantId = (process.env.MSGRAPH_TENANT_ID || "").trim();
  const clientId = (process.env.MSGRAPH_CLIENT_ID || "").trim();
  const clientSecret = (process.env.MSGRAPH_CLIENT_SECRET || "").trim();
  if (tenantId && clientId && clientSecret) {
    return new ClientSecretCredential(tenantId, clientId, clientSecret);
  }
  return getAzureCredentialFromEnv();
};

const getGraphAccessToken = async () => {
  const now = Date.now();
  if (graphTokenCache.token && graphTokenCache.expiresAt - 60_000 > now) {
    return graphTokenCache.token;
  }
  const credential = getGraphCredential();
  const token = await credential.getToken(GRAPH_SCOPE);
  if (!token?.token) {
    throw new Error("Graph token acquisition failed");
  }
  graphTokenCache.token = token.token;
  graphTokenCache.expiresAt =
    token.expiresOnTimestamp ?? now + GRAPH_CACHE_TTL_MS;
  return token.token;
};

type GraphRequestOptions = Omit<RequestInit, "body" | "headers"> & {
  body?: Record<string, unknown> | string;
  headers?: Record<string, string>;
};

const graphRequestJson = async (
  path: string,
  options: GraphRequestOptions = {}
) => {
  const token = await getGraphAccessToken();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), GRAPH_TIMEOUT_MS);
  const headers = new Headers(options.headers);
  headers.set("Accept", "application/json");
  headers.set("Authorization", `Bearer ${token}`);
  let resolvedBody: BodyInit | undefined;
  if (options.body && typeof options.body !== "string") {
    resolvedBody = JSON.stringify(options.body);
    headers.set("Content-Type", "application/json");
  } else if (typeof options.body === "string") {
    resolvedBody = options.body;
  }
  const url = path.startsWith("http")
    ? path
    : `https://graph.microsoft.com/v1.0${path}`;
  try {
    const res = await fetch(url, {
      ...options,
      headers,
      body: resolvedBody,
      signal: controller.signal,
    });
    const text = await res.text();
    if (!res.ok) {
      const error = new Error(
        `Graph error ${res.status}: ${text.slice(0, 300)}`
      );
      (error as any).status = res.status;
      throw error;
    }
    return text ? JSON.parse(text) : {};
  } finally {
    clearTimeout(timeout);
  }
};

const getSharePointSiteId = async () => {
  if (SP_SITE_ID) return SP_SITE_ID;
  if (graphSiteCache.id && graphSiteCache.expiresAt > Date.now()) {
    return graphSiteCache.id;
  }
  const path = normalizeSitePath(SP_SITE_PATH);
  if (!path) {
    throw new Error("missing_sharepoint_site");
  }
  const site = await graphRequestJson(
    `/sites/${SP_SITE_HOSTNAME}:${path}`
  );
  if (!site?.id) {
    throw new Error("sharepoint_site_lookup_failed");
  }
  graphSiteCache.id = site.id;
  graphSiteCache.expiresAt = Date.now() + GRAPH_CACHE_TTL_MS;
  return site.id as string;
};

const getSharePointListId = async (
  listName: string,
  listId: string,
  cacheKey: string
) => {
  if (listId) return listId;
  if (!listName) {
    throw new Error("missing_sharepoint_list");
  }
  const cached = graphListCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.id;
  }
  const siteId = await getSharePointSiteId();
  const lists = await graphRequestJson(
    `/sites/${siteId}/lists?$select=id,name&$top=200`
  );
  const match = Array.isArray(lists?.value)
    ? lists.value.find(
        (list: any) =>
          typeof list?.name === "string" &&
          list.name.toLowerCase() === listName.toLowerCase()
      )
    : undefined;
  if (!match?.id) {
    throw new Error(`sharepoint_list_not_found:${listName}`);
  }
  graphListCache.set(cacheKey, {
    id: match.id,
    expiresAt: Date.now() + GRAPH_CACHE_TTL_MS,
  });
  return match.id as string;
};

const getLeadsListId = async () =>
  getSharePointListId(SP_LEADS_LIST_NAME, SP_LEADS_LIST_ID, "leads");

const getMessagesListId = async () =>
  getSharePointListId(
    SP_MESSAGES_LIST_NAME,
    SP_MESSAGES_LIST_ID,
    "messages"
  );

const setLeadField = (
  fields: Record<string, unknown>,
  key: string,
  value: unknown
) => {
  if (!key) return;
  if (value === undefined || value === null) return;
  if (typeof value === "string" && value.trim() === "") return;
  fields[key] = value;
};

const hashLeadToken = (token: string) => {
  const hash = createHash("sha256");
  if (LEAD_TOKEN_SECRET) {
    hash.update(LEAD_TOKEN_SECRET);
    hash.update("|");
  }
  hash.update(token);
  return hash.digest("hex");
};

const safeEqualHex = (left: string, right: string) => {
  if (!left || !right) return false;
  try {
    const leftBuf = Buffer.from(left, "hex");
    const rightBuf = Buffer.from(right, "hex");
    if (leftBuf.length !== rightBuf.length) return false;
    return timingSafeEqual(leftBuf, rightBuf);
  } catch {
    return false;
  }
};

const formatTranscriptEntry = (role: Role, content: string) => {
  const timestamp = new Date().toISOString();
  const safeContent = content.replace(/\r\n/g, "\n").trim();
  return `[${timestamp}] ${role}\n${safeContent}`;
};

const appendTranscript = (current: string, entry: string) => {
  if (!current) return entry;
  return `${current}\n${entry}`;
};

const buildLeadCreateFields = (
  payload: z.infer<typeof requestSchema>,
  leadTokenHash: string
) => {
  const fields: Record<string, unknown> = {};
  setLeadField(fields, leadFieldMap.title, `Lead - ${payload.email}`);
  setLeadField(fields, leadFieldMap.email, payload.email);
  setLeadField(fields, leadFieldMap.name, payload.name);
  setLeadField(fields, leadFieldMap.companyName, payload.companyName);
  setLeadField(fields, leadFieldMap.phone, payload.phone);
  setLeadField(fields, leadFieldMap.status, "new");
  setLeadField(fields, leadFieldMap.source, "AI agent chat");
  setLeadField(fields, leadFieldMap.sessionId, payload.sessionId);
  setLeadField(fields, leadFieldMap.pageUrl, payload.pageUrl);
  setLeadField(fields, leadFieldMap.referrer, payload.referrer);
  setLeadField(fields, leadFieldMap.utmSource, payload.utm?.source);
  setLeadField(fields, leadFieldMap.utmMedium, payload.utm?.medium);
  setLeadField(fields, leadFieldMap.utmCampaign, payload.utm?.campaign);
  setLeadField(fields, leadFieldMap.utmTerm, payload.utm?.term);
  setLeadField(fields, leadFieldMap.utmContent, payload.utm?.content);
  setLeadField(fields, leadFieldMap.initialMessage, payload.leadMessage);
  setLeadField(fields, leadFieldMap.tokenHash, leadTokenHash);
  return fields;
};

const createSharePointLead = async (payload: z.infer<typeof requestSchema>) => {
  if (!leadFieldMap.tokenHash) {
    throw new Error("missing_sharepoint_lead_token_field");
  }
  const leadToken = randomBytes(32).toString("hex");
  const leadTokenHash = hashLeadToken(leadToken);
  const fields = buildLeadCreateFields(payload, leadTokenHash);
  const siteId = await getSharePointSiteId();
  const listId = await getLeadsListId();
  const result = await graphRequestJson(
    `/sites/${siteId}/lists/${listId}/items`,
    {
      method: "POST",
      body: { fields },
    }
  );
  if (!result?.id) {
    throw new Error("sharepoint_lead_create_failed");
  }
  return { leadId: `${result.id}`, leadToken };
};

const fetchLeadFields = async (
  leadId: string,
  includeTranscript: boolean
) => {
  const selectFields = [leadFieldMap.tokenHash];
  if (includeTranscript && leadFieldMap.transcript) {
    selectFields.push(leadFieldMap.transcript);
  }
  const select = selectFields.filter(Boolean).join(",");
  const siteId = await getSharePointSiteId();
  const listId = await getLeadsListId();
  const result = await graphRequestJson(
    `/sites/${siteId}/lists/${listId}/items/${leadId}?expand=fields($select=${encodeURIComponent(
      select
    )})`
  );
  return result?.fields ?? {};
};

const updateLeadFields = async (
  leadId: string,
  fields: Record<string, unknown>
) => {
  if (!Object.keys(fields).length) return;
  const siteId = await getSharePointSiteId();
  const listId = await getLeadsListId();
  await graphRequestJson(
    `/sites/${siteId}/lists/${listId}/items/${leadId}/fields`,
    {
      method: "PATCH",
      body: fields,
    }
  );
};

const logLeadMessage = async ({
  leadId,
  role,
  content,
  sessionId,
  email,
  existingTranscript,
}: {
  leadId: string;
  role: Role;
  content: string;
  sessionId?: string;
  email: string;
  existingTranscript?: string;
}): Promise<string | undefined> => {
  const timestamp = new Date().toISOString();
  let nextTranscript: string | undefined;
  if (isMessagesListConfigured()) {
    const messageFields: Record<string, unknown> = {};
    setLeadField(messageFields, messageFieldMap.title, `${role} - ${email}`);
    setLeadField(messageFields, messageFieldMap.leadId, leadId);
    setLeadField(messageFields, messageFieldMap.role, role);
    setLeadField(messageFields, messageFieldMap.content, content);
    setLeadField(messageFields, messageFieldMap.timestamp, timestamp);
    setLeadField(messageFields, messageFieldMap.sessionId, sessionId);
    const siteId = await getSharePointSiteId();
    const listId = await getMessagesListId();
    await graphRequestJson(
      `/sites/${siteId}/lists/${listId}/items`,
      {
        method: "POST",
        body: { fields: messageFields },
      }
    );
  } else {
    if (!leadFieldMap.transcript) {
      throw new Error("missing_sharepoint_transcript_field");
    }
    const entry = formatTranscriptEntry(role, content);
    nextTranscript = appendTranscript(existingTranscript || "", entry);
    const updateFields: Record<string, unknown> = {
      [leadFieldMap.transcript]: nextTranscript,
    };
    await updateLeadFields(leadId, updateFields);
  }
  const leadUpdate: Record<string, unknown> = {};
  setLeadField(leadUpdate, leadFieldMap.lastMessageAt, timestamp);
  if (role === "user") {
    setLeadField(leadUpdate, leadFieldMap.lastUserMessage, content);
    setLeadField(leadUpdate, leadFieldMap.status, "engaged");
  } else {
    setLeadField(leadUpdate, leadFieldMap.lastAssistantMessage, content);
  }
  await updateLeadFields(leadId, leadUpdate);
  return nextTranscript;
};

const isLikelyInvalidDomain = (domain: string) => {
  if (!domain || domain.length < 4 || !domain.includes(".")) return true;
  if (invalidDomains.has(domain)) return true;
  if (domain.endsWith(".local")) return true;
  if (domain.startsWith("example.")) return true;
  return false;
};

const withTimeout = async <T>(promise: Promise<T>, timeoutMs: number) => {
  let timeoutHandle: NodeJS.Timeout | undefined;
  const timeoutPromise = new Promise<T>((_, reject) => {
    timeoutHandle = setTimeout(() => reject(new Error("timeout")), timeoutMs);
  });
  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeoutHandle) clearTimeout(timeoutHandle);
  }
};

const validateEmailDomain = async (domain: string) => {
  if (isLikelyInvalidDomain(domain)) return false;
  const cached = domainValidationCache.get(domain);
  if (cached && Date.now() - cached.checkedAt < DOMAIN_VALIDATION_TTL_MS) {
    cached.checkedAt = Date.now();
    return cached.valid;
  }
  const lookup = async (
    label: string,
    promise: Promise<unknown>
  ): Promise<boolean> => {
    try {
      const records = await withTimeout(promise, DOMAIN_VALIDATION_TIMEOUT_MS);
      return Array.isArray(records) && records.length > 0;
    } catch (error) {
      if (DEBUG_VALIDATION) {
        console.warn(`[agent] ${label} lookup failed`, domain, error);
      }
      return false;
    }
  };
  const check = async () => {
    const lookups = [
      lookup("MX", dns.resolveMx(domain)),
      lookup("A", dns.resolve4(domain)),
      lookup("AAAA", dns.resolve6(domain)),
    ];
    try {
      await Promise.any(
        lookups.map(async (promise) => {
          const ok = await promise;
          if (!ok) throw new Error("empty");
          return ok;
        })
      );
      return true;
    } catch {
      return false;
    }
  };
  const valid = await check();
  if (domainValidationCache.size >= DOMAIN_VALIDATION_MAX_ENTRIES) {
    let oldestKey: string | undefined;
    let oldestTimestamp = Number.POSITIVE_INFINITY;
    for (const [key, value] of domainValidationCache.entries()) {
      if (value.checkedAt < oldestTimestamp) {
        oldestTimestamp = value.checkedAt;
        oldestKey = key;
      }
    }
    if (oldestKey) domainValidationCache.delete(oldestKey);
  }
  domainValidationCache.set(domain, { valid, checkedAt: Date.now() });
  return valid;
};

const getEmailDomain = (email: string) =>
  email.split("@")[1]?.toLowerCase() || "";

const verifyTurnstile = async (token: string, ip?: string) => {
  if (!TURNSTILE_SECRET_KEY) return false;
  const body = new URLSearchParams({
    secret: TURNSTILE_SECRET_KEY,
    response: token,
  });
  if (ip && ip !== "unknown") {
    body.append("remoteip", ip);
  }
  const res = await fetch(
    "https://challenges.cloudflare.com/turnstile/v0/siteverify",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
    }
  );
  if (!res.ok) {
    if (DEBUG_VALIDATION) {
      console.warn("[agent] Turnstile verify failed", res.status);
    }
    return false;
  }
  const payload = (await res.json()) as { success?: boolean };
  return payload.success === true;
};

const submitLead = async (
  payload: z.infer<typeof requestSchema>,
  message?: string
) => {
  if (!FORMSPARK_ACTION_URL) {
    throw new Error("Missing FORMSPARK_ACTION_URL");
  }
  const body = {
    fullName: payload.name || "",
    email: payload.email,
    companyName: payload.companyName || "",
    phone: payload.phone || "",
    message: message || "",
    source: "AI agent chat",
  };
  const res = await fetch(FORMSPARK_ACTION_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const detail = await res.text();
    if (DEBUG_VALIDATION) {
      console.warn("[agent] Lead submission failed", res.status, detail);
    }
    throw new Error("Lead submission failed");
  }
};

const postJson = async (
  url: string,
  headers: Record<string, string>,
  body: Record<string, unknown>,
  timeoutMs: number
) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        ...headers,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const text = await res.text();
    if (!res.ok) {
      const error = new Error(
        `Azure Agent error ${res.status}: ${text.slice(0, 300)}`
      );
      (error as any).status = res.status;
      throw error;
    }
    return text ? JSON.parse(text) : {};
  } finally {
    clearTimeout(timeout);
  }
};

const buildSafetyIdentifier = (email: string) => {
  const hash = createHash("sha256")
    .update(email.trim().toLowerCase())
    .digest("hex");
  return hash;
};

export async function POST(request: Request) {
  if (!enforceOrigin(request)) {
    return NextResponse.json(
      { error: "forbidden" },
      { status: 403 }
    );
  }

  const rateKey = getRateLimitKey(request);
  const limit = applyRateLimit(rateKey);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "rate_limited" },
      {
        status: 429,
        headers: {
          "Retry-After": Math.ceil(limit.retryAfterMs / 1000).toString(),
        },
      }
    );
  }

  const azureEndpoint = getEnv("AZURE_AGENT_ENDPOINT");
  const agentName = getEnv("AZURE_AGENT_CHAT_NAME", getEnv("AZURE_AGENT_NAME"));
  const apiVersion =
    getEnv("AZURE_AGENT_CHAT_RESPONSES_API_VERSION") ||
    getEnv("AZURE_AGENT_RESPONSES_API_VERSION", "2025-11-15-preview");
  const timeoutMs = Number.parseInt(
    getEnv("AZURE_AGENT_RESPONSES_TIMEOUT_MS", "180000"),
    10
  );
  const maxOutputTokens = Number.parseInt(
    getEnv("AZURE_AGENT_RESPONSES_MAX_OUTPUT_TOKENS", "0"),
    10
  );

  let payload: z.infer<typeof requestSchema>;
  try {
    payload = requestSchema.parse(await request.json());
  } catch (error) {
    return NextResponse.json(
      { error: "invalid_request" },
      { status: 400 }
    );
  }

  try {
    // Email is validated by zod, so a single "@" is safe to split.
    const emailDomain = getEmailDomain(payload.email);
    if (!emailDomain || !(await validateEmailDomain(emailDomain))) {
      return NextResponse.json(
        { error: "invalid_email_domain" },
        { status: 400 }
      );
    }

    const messages = payload.messages ?? [];
    const lastUserMessage = messages
      .filter((message) => message.role === "user")
      .at(-1)?.content;
    const leadMessage = payload.leadMessage || lastUserMessage || "";
    const sharePointEnabled = isSharePointConfigured();
    const missingLeadTokenField = !leadFieldMap.tokenHash;
    const missingTranscriptField =
      !isMessagesListConfigured() && !leadFieldMap.transcript;

    if (payload.leadOnly) {
      if (!sharePointEnabled) {
        return NextResponse.json(
          { error: "missing_configuration" },
          { status: 500 }
        );
      }
      if (missingLeadTokenField) {
        return NextResponse.json(
          { error: "missing_configuration" },
          { status: 500 }
        );
      }
      if (payload.turnstileToken && !TURNSTILE_SECRET_KEY) {
        return NextResponse.json(
          { error: "missing_configuration" },
          { status: 500 }
        );
      }
      if (TURNSTILE_SECRET_KEY) {
        if (!payload.turnstileToken) {
          return NextResponse.json(
            { error: "turnstile_required" },
            { status: 400 }
          );
        }
        const turnstileOk = await verifyTurnstile(
          payload.turnstileToken,
          rateKey
        );
        if (!turnstileOk) {
          return NextResponse.json(
            { error: "turnstile_failed" },
            { status: 400 }
          );
        }
      }
      const lead = await createSharePointLead(payload);
      if (FORMSPARK_ACTION_URL) {
        try {
          await submitLead(payload, leadMessage);
        } catch (error) {
          if (DEBUG_VALIDATION) {
            console.warn("[agent] Formspark submission failed", error);
          }
        }
      }
      return NextResponse.json(
        { ok: true, leadId: lead.leadId, leadToken: lead.leadToken },
        {
          headers: {
            "Cache-Control": "no-store, no-cache, must-revalidate",
          },
        }
      );
    }

    if (!sharePointEnabled) {
      return NextResponse.json(
        { error: "missing_configuration" },
        { status: 500 }
      );
    }
    if (missingLeadTokenField || missingTranscriptField) {
      return NextResponse.json(
        { error: "missing_configuration" },
        { status: 500 }
      );
    }

    if (!azureEndpoint || !agentName) {
      return NextResponse.json(
        { error: "missing_configuration" },
        { status: 500 }
      );
    }
    if (isLegacyAssistantId(agentName)) {
      return NextResponse.json(
        { error: "missing_configuration" },
        { status: 500 }
      );
    }

    const apiKey = getEnv("AZURE_AGENT_API_KEY");
    let accessToken: string | undefined;
    let authHeaders: Record<string, string> | undefined;
    try {
      const credential = getAzureCredentialFromEnv();
      accessToken = await getFoundryAccessToken(credential);
      authHeaders = { Authorization: `Bearer ${accessToken}` };
    } catch (error) {
      if (!apiKey) {
        throw error;
      }
      if (DEBUG_VALIDATION) {
        console.warn("[agent] Azure token acquisition failed; using API key");
      }
      authHeaders = { "api-key": apiKey };
    }
    if (!authHeaders) {
      return NextResponse.json(
        { error: "missing_configuration" },
        { status: 500 }
      );
    }

    const baseUrl = `${azureEndpoint.replace(/\/+$/, "")}/openai`;
    let agentRef;
    try {
      agentRef = await resolveFoundryAgentReference({
        endpoint: azureEndpoint,
        agentName,
        apiVersion,
        token: accessToken,
        headers: authHeaders,
        cache: agentReferenceCache,
      });
    } catch (error) {
      if (DEBUG_VALIDATION) {
        console.warn("[agent] Agent metadata lookup failed; using name-only ref");
      }
      agentRef = parseAgentReference(agentName);
    }

    const includeTranscript = !isMessagesListConfigured();
    let leadFields: Record<string, unknown>;
    try {
      leadFields = await fetchLeadFields(
        payload.leadId || "",
        includeTranscript
      );
    } catch (error) {
      const status = (error as any)?.status;
      if (status === 403 || status === 404) {
        return NextResponse.json(
          { error: "lead_invalid" },
          { status: 401 }
        );
      }
      throw error;
    }
    const storedHash =
      typeof leadFields?.[leadFieldMap.tokenHash] === "string"
        ? (leadFields[leadFieldMap.tokenHash] as string)
        : "";
    const providedToken = payload.leadToken || "";
    if (!safeEqualHex(storedHash, hashLeadToken(providedToken))) {
      return NextResponse.json(
        { error: storedHash ? "lead_invalid" : "lead_required" },
        { status: 401 }
      );
    }
    if (!lastUserMessage) {
      return NextResponse.json(
        { error: "invalid_request" },
        { status: 400 }
      );
    }

    const updatedTranscript = await logLeadMessage({
      leadId: payload.leadId || "",
      role: "user",
      content: lastUserMessage,
      sessionId: payload.sessionId || "",
      email: payload.email,
      existingTranscript: includeTranscript
        ? (leadFields?.[leadFieldMap.transcript] as string | undefined)
        : undefined,
    });

    const conversation = await postJson(
      `${baseUrl}/conversations?api-version=${apiVersion}`,
      authHeaders,
      { items: buildConversationItems(payload, messages) },
      timeoutMs
    );

    const response = await postJson(
      `${baseUrl}/responses?api-version=${apiVersion}`,
      authHeaders,
      {
        conversation: conversation.id,
        agent: agentRef,
        safety_identifier: buildSafetyIdentifier(payload.email),
        ...(Number.isFinite(maxOutputTokens) && maxOutputTokens > 0
          ? { max_output_tokens: maxOutputTokens }
          : {}),
      },
      timeoutMs
    );

    const reply = extractResponseText(response);
    if (!reply) {
      throw new Error("Empty response from agent");
    }

    try {
      await logLeadMessage({
        leadId: payload.leadId || "",
        role: "assistant",
        content: reply,
        sessionId: payload.sessionId || "",
        email: payload.email,
        existingTranscript: includeTranscript ? updatedTranscript : undefined,
      });
    } catch (error) {
      if (DEBUG_VALIDATION) {
        console.warn("[agent] Failed to log assistant reply", error);
      }
    }

    return NextResponse.json(
      { reply },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate",
        },
      }
    );
  } catch (error) {
    const status = (error as any)?.status;
    if (DEBUG_VALIDATION) {
      console.warn("[agent] Agent request failed", error);
    }
    if (status === 429) {
      return NextResponse.json(
        { error: "rate_limited" },
        {
          status: 429,
          headers: {
            "Retry-After": "30",
          },
        }
      );
    }
    return NextResponse.json(
      { error: "agent_error" },
      { status: 500 }
    );
  }
}
