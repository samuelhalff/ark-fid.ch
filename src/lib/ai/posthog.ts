import { createHash, randomUUID } from "node:crypto";
import { PostHog } from "posthog-node";

export type AiChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

type AiGenerationCapture = {
  distinctId: string;
  sessionId: string;
  traceId: string;
  spanName: string;
  input: AiChatMessage[];
  output?: string;
  response?: unknown;
  latencyMs: number;
  error?: unknown;
};

const projectToken = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;
const posthogHost = process.env.NEXT_PUBLIC_POSTHOG_HOST;

if (!projectToken && process.env.NODE_ENV !== "production") {
  throw new Error(
    "NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN variable required by PostHog is missing or un-configured, this causes events to be silently missed. This error stops appearing once NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN is configured",
  );
}

if (!posthogHost && process.env.NODE_ENV !== "production") {
  throw new Error(
    "NEXT_PUBLIC_POSTHOG_HOST variable required by PostHog is missing or un-configured, this causes events to be silently missed. This error stops appearing once NEXT_PUBLIC_POSTHOG_HOST is configured",
  );
}

const posthog = projectToken && posthogHost
  ? new PostHog(projectToken, {
      host: posthogHost,
      flushAt: 1,
      flushInterval: 0,
      enableExceptionAutocapture: true,
      privacyMode: true,
    })
  : null;

const getRecord = (value: unknown) =>
  value && typeof value === "object" ? (value as Record<string, unknown>) : undefined;

const getNumber = (value: unknown, keys: string[]) => {
  const record = getRecord(value);
  for (const key of keys) {
    const candidate = record?.[key];
    if (typeof candidate === "number" && Number.isFinite(candidate)) return candidate;
  }
  return undefined;
};

const getString = (value: unknown, key: string) => {
  const candidate = getRecord(value)?.[key];
  return typeof candidate === "string" && candidate ? candidate : undefined;
};

export const getAiSessionId = (namespace: string, conversationId: string) =>
  `${namespace}-${createHash("sha256").update(conversationId).digest("hex")}`;

export async function captureAiGeneration({
  distinctId,
  sessionId,
  traceId,
  spanName,
  response,
  latencyMs,
  error,
}: AiGenerationCapture) {
  if (!posthog) return;

  const usage = getRecord(response)?.usage;
  const model = getString(response, "model");
  const status = getNumber(error, ["status"]);
  const properties: Record<string, unknown> = {
    $ai_trace_id: traceId,
    $ai_session_id: sessionId,
    $ai_span_id: randomUUID(),
    $ai_span_name: spanName,
    $ai_provider: "azure",
    $ai_latency: latencyMs / 1000,
    $ai_stream: false,
  };

  if (model) properties.$ai_model = model;
  if (error) {
    properties.$ai_is_error = true;
    properties.$ai_error = error instanceof Error ? error.name : "azure_foundry_request_failed";
  }
  if (status) properties.$ai_http_status = status;

  const inputTokens = getNumber(usage, ["input_tokens", "prompt_tokens"]);
  const outputTokens = getNumber(usage, ["output_tokens", "completion_tokens"]);
  if (inputTokens !== undefined) properties.$ai_input_tokens = inputTokens;
  if (outputTokens !== undefined) properties.$ai_output_tokens = outputTokens;

  try {
    posthog.capture({
      distinctId,
      event: "$ai_generation",
      properties,
    });
    await posthog.flush();
  } catch {
    // Observability must not change the visitor-facing assistant response.
  }
}
