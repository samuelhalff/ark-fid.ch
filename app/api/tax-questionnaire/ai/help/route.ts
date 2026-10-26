import { NextResponse } from "next/server";
import { AiError, aiEnabled, aiHelp, asLocale, hasAiOptIn } from "@/src/lib/tax-questionnaire/server/ai";
import { aiGate } from "@/src/lib/tax-questionnaire/server/service";
import { getStorage as getQfStorage } from "@/src/lib/tax-questionnaire/server/storage";
import { clientIp, json, originAllowed, rateLimited, readJson, requireSession, type Counter } from "@/src/lib/tax-questionnaire/server/http";

/** AI help on one question (gated: TAX_QF_AI_ENABLED=1 + client opt-in). Never on the regularisation route. */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ipCounters = new Map<string, Counter>();

export async function POST(request: Request) {
  if (!aiEnabled()) return json({ error: "ai_disabled" }, 404);
  if (!originAllowed(request)) return json({ error: "forbidden" }, 403);
  const limited = rateLimited(ipCounters, clientIp(request), 30, 10 * 60 * 1000);
  if (limited) return limited;
  const read = await readJson(request, 8 * 1024);
  if (!read.ok) return read.response;
  const session = await requireSession(request, "any");
  if (session instanceof NextResponse) return session;
  if (!hasAiOptIn(read.body)) return json({ error: "ai_consent_required" }, 403);
  // Consent and the protected route are checked against the saved case, not the request.
  const gate = await aiGate(getQfStorage(), session.caseId).catch(() => "ai_consent_required" as const);
  if (gate) return json({ error: gate }, 403);
  const { stepId, fieldId, locale, question } = read.body;
  if (typeof stepId !== "string" || typeof question !== "string" || (fieldId !== undefined && typeof fieldId !== "string")) {
    return json({ error: "invalid_request" }, 400);
  }
  try {
    return json(await aiHelp({ stepId, fieldId, locale: asLocale(locale), question }));
  } catch (error) {
    if (error instanceof AiError) return json({ error: error.code }, error.status);
    return json({ error: "ai_unavailable" }, 502);
  }
}
