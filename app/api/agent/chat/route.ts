import { NextResponse } from "next/server";
import { DefaultAzureCredential } from "@azure/identity";
import { z } from "zod";
import { promises as dns } from "dns";

export const runtime = "nodejs";
export const revalidate = 0;

const RATE_LIMIT_WINDOW_MS = Number.parseInt(
  process.env.AZURE_AGENT_RATE_LIMIT_WINDOW_MS || "600000",
  10
);
const RATE_LIMIT_MAX = Number.parseInt(
  process.env.AZURE_AGENT_RATE_LIMIT_MAX || "12",
  10
);

const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

const messageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().trim().min(1).max(2000),
});

const requestSchema = z
  .object({
    email: z.string().email(),
    name: z.string().trim().max(120).optional(),
    companyName: z.string().trim().max(160).optional(),
    phone: z.string().trim().max(80).optional(),
    messages: z.array(messageSchema).max(12).optional(),
    leadOnly: z.boolean().optional(),
    leadMessage: z.string().trim().max(240).optional(),
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
  });

const getEnv = (key: string, fallback?: string) =>
  process.env[key] || fallback || "";

const getRateLimitKey = (request: Request) => {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0]?.trim() || "unknown";
  }
  return request.headers.get("x-real-ip") || "unknown";
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
const DOMAIN_VALIDATION_TTL_MS = 12 * 60 * 60 * 1000;
const DOMAIN_VALIDATION_TIMEOUT_MS = 3500;
const DOMAIN_VALIDATION_MAX_ENTRIES = 400;
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

const parseAgentReference = (raw: string) => {
  const trimmed = raw.trim();
  const [namePart, versionPart] = trimmed.split(":");
  if (!namePart) {
    throw new Error("AZURE_AGENT_NAME must include a name");
  }
  return {
    type: "agent_reference",
    name: namePart,
    ...(versionPart ? { version: versionPart } : {}),
  };
};

const extractResponseText = (response: unknown): string => {
  if (!response || typeof response !== "object") return "";
  const candidate = response as Record<string, any>;
  if (typeof candidate.output_text === "string") return candidate.output_text;
  if (Array.isArray(candidate.output)) {
    for (const item of candidate.output) {
      if (item?.type === "output_text" && typeof item.text === "string") {
        return item.text;
      }
      if (item?.type === "text" && typeof item.text === "string") {
        return item.text;
      }
      if (item?.type === "message" && Array.isArray(item.content)) {
        for (const content of item.content) {
          if (content?.type === "output_text" && typeof content.text === "string") {
            return content.text;
          }
          if (content?.type === "text" && content.text) {
            return typeof content.text === "string"
              ? content.text
              : content.text.value || "";
          }
        }
      }
    }
  }
  if (candidate.output?.content) {
    for (const content of candidate.output.content) {
      if (content?.type === "output_text" && typeof content.text === "string") {
        return content.text;
      }
      if (content?.type === "text" && content.text) {
        return typeof content.text === "string"
          ? content.text
          : content.text.value || "";
      }
    }
  }
  if (candidate.choices?.[0]?.message?.content) {
    return candidate.choices[0].message.content;
  }
  return "";
};

const buildConversationItems = (
  data: z.infer<typeof requestSchema>,
  messages: z.infer<typeof messageSchema>[]
) => {
  const profile = [
    data.name ? `Name: ${data.name}` : null,
    data.email ? `Email: ${data.email}` : null,
    data.companyName ? `Company: ${data.companyName}` : null,
    data.phone ? `Phone: ${data.phone}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  const systemPrompt = [
    "You are Ark Fiduciaire's assistant.",
    "Provide an approximate quote and suggest relevant services based on the request.",
    "Keep the tone commercial but not pushy.",
    "Offer brief next steps and ask clarifying questions when needed.",
    "For later tasks, explain what documents or information would be required.",
    profile ? `Client details:\n${profile}` : null,
  ]
    .filter(Boolean)
    .join("\n");

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
  token: string,
  body: Record<string, unknown>,
  timeoutMs: number
) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
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

export async function POST(request: Request) {
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
  const agentName = getEnv("AZURE_AGENT_NAME");
  const apiVersion = getEnv(
    "AZURE_AGENT_RESPONSES_API_VERSION",
    "2025-11-15-preview"
  );
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

    if (payload.leadOnly) {
      if (!FORMSPARK_ACTION_URL) {
        return NextResponse.json(
          { error: "missing_configuration" },
          { status: 500 }
        );
      }
      await submitLead(payload, leadMessage);
      return NextResponse.json(
        { ok: true },
        {
          headers: {
            "Cache-Control": "no-store, no-cache, must-revalidate",
          },
        }
      );
    }

    if (!azureEndpoint || !agentName) {
      return NextResponse.json(
        { error: "missing_configuration" },
        { status: 500 }
      );
    }

    const credential = new DefaultAzureCredential();
    const token = await credential.getToken("https://ai.azure.com/.default");
    if (!token?.token) {
      throw new Error("Azure token acquisition failed");
    }

    const baseUrl = `${azureEndpoint.replace(/\/+$/, "")}/openai`;
    const agentRef = parseAgentReference(agentName);

    const conversation = await postJson(
      `${baseUrl}/conversations?api-version=${apiVersion}`,
      token.token,
      { items: buildConversationItems(payload, messages) },
      timeoutMs
    );

    const response = await postJson(
      `${baseUrl}/responses?api-version=${apiVersion}`,
      token.token,
      {
        conversation: conversation.id,
        agent: agentRef,
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
