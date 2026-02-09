import { NextResponse } from "next/server";
import { DefaultAzureCredential } from "@azure/identity";
import { z } from "zod";

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

const requestSchema = z.object({
  email: z.string().email(),
  name: z.string().trim().max(120).optional(),
  companyName: z.string().trim().max(160).optional(),
  phone: z.string().trim().max(80).optional(),
  messages: z.array(messageSchema).min(1).max(12),
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
  data: z.infer<typeof requestSchema>
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
    ...data.messages.map((message) => ({
      type: "message",
      role: message.role,
      content: message.content,
    })),
  ];
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

  if (!azureEndpoint || !agentName) {
    return NextResponse.json(
      { error: "missing_configuration" },
      { status: 500 }
    );
  }

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
      { items: buildConversationItems(payload) },
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
