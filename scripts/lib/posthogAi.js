"use strict";

const { randomUUID } = require("crypto");

const aiSessionId = `ai-run-${process.pid}-${randomUUID()}`;
const privacyMode = process.env.POSTHOG_AI_PRIVACY_MODE === "true";
let posthogClient;
let posthogUnavailable = false;

function createAiTraceId() {
  return randomUUID();
}

function getPostHogClient() {
  if (posthogUnavailable) return null;
  if (posthogClient) return posthogClient;

  const token = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;
  const host = process.env.NEXT_PUBLIC_POSTHOG_HOST;
  if (!token || !host) {
    posthogUnavailable = true;
    console.warn(
      "PostHog AI Observability is not configured; skipping generation capture.",
    );
    return null;
  }

  try {
    const { PostHog } = require("posthog-node");
    posthogClient = new PostHog(token, {
      host,
      flushAt: 1,
      flushInterval: 0,
      privacyMode,
    });
    return posthogClient;
  } catch {
    posthogUnavailable = true;
    console.warn(
      "PostHog AI Observability requires posthog-node; skipping generation capture.",
    );
    return null;
  }
}

function tokenCount(usage, primaryKey, alternateKey) {
  const value = usage?.[primaryKey] ?? usage?.[alternateKey];
  return typeof value === "number" ? value : undefined;
}

async function captureAiGeneration({
  traceId,
  spanName,
  model,
  provider = "azure",
  input,
  output,
  usage,
  latencyMs,
  httpStatus,
  requestUrl,
  temperature,
  maxTokens,
}) {
  const client = getPostHogClient();
  if (!client) return;

  const properties = {
    $ai_trace_id: traceId,
    $ai_session_id: aiSessionId,
    $ai_span_id: randomUUID(),
    $ai_span_name: spanName,
    $ai_model: model,
    $ai_provider: provider,
    $ai_input_tokens: tokenCount(usage, "prompt_tokens", "input_tokens"),
    $ai_output_tokens: tokenCount(usage, "completion_tokens", "output_tokens"),
    $ai_latency: latencyMs / 1000,
    $ai_http_status: httpStatus,
    $ai_request_url: requestUrl,
    $ai_temperature: temperature,
    $ai_max_tokens: maxTokens,
  };

  if (!privacyMode) {
    properties.$ai_input = input;
    properties.$ai_output_choices = [{ role: "assistant", content: output }];
  }

  try {
    client.capture({
      distinctId: `ai-observability:${aiSessionId}`,
      event: "$ai_generation",
      properties,
    });
    await client.flush();
  } catch {
    console.warn("PostHog AI Observability capture failed; continuing.");
  }
}

module.exports = {
  captureAiGeneration,
  createAiTraceId,
};
