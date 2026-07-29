const test = require("node:test");
const assert = require("node:assert/strict");

const {
  computeAzureOpenAIRetryDelayMs,
  getRetryAfterMsFromError,
  isResearchRegenerationError,
  isRetryableAzureOpenAIFetchError,
} = require("./ai-ressources-update");

test("regenerates research when the drafted article is an all-time duplicate", () => {
  assert.equal(
    isResearchRegenerationError({ code: "ALL_TIME_TITLE_DUPLICATE" }),
    true,
  );
  assert.equal(
    isResearchRegenerationError({ code: "ALL_TIME_TOPIC_DUPLICATE" }),
    true,
  );
  assert.equal(isResearchRegenerationError({ code: "TOO_SHORT" }), false);
});

test("treats undici headers timeout as retryable", () => {
  const error = new Error("fetch failed");
  error.cause = { code: "UND_ERR_HEADERS_TIMEOUT" };

  assert.equal(isRetryableAzureOpenAIFetchError(error), true);
});

test("treats connection reset as retryable", () => {
  const error = new Error("socket hang up");
  error.code = "ECONNRESET";

  assert.equal(isRetryableAzureOpenAIFetchError(error), true);
});

test("does not classify generic validation errors as retryable", () => {
  const error = new Error("Draft payload missing newArticle");

  assert.equal(isRetryableAzureOpenAIFetchError(error), false);
});

test("prefers x-ms-retry-after-ms when present", () => {
  const delay = getRetryAfterMsFromError({
    headers: {
      "x-ms-retry-after-ms": "1200",
      "retry-after": "9",
    },
  });

  assert.equal(delay, 1200);
});

test("compute retry delay honors server minimum", () => {
  const delay = computeAzureOpenAIRetryDelayMs(1, 5000);

  assert.ok(delay >= 5000);
});
