import { NextResponse } from "next/server";
import { AiError, aiEnabled, aiSuggest, asLocale, hasAiOptIn } from "@/src/lib/tax-questionnaire/server/ai";
import { aiGate } from "@/src/lib/tax-questionnaire/server/service";
import { getStorage as getQfStorage } from "@/src/lib/tax-questionnaire/server/storage";
import { clientIp, json, originAllowed, rateLimited, readJson, requireSession, type Counter } from "@/src/lib/tax-questionnaire/server/http";

/** Free-text description → suggested router cards, which the client must confirm (gated). */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ipCounters = new Map<string, Counter>();

export async function POST(request: Request) {
  if (!aiEnabled()) return json({ error: "ai_disabled" }, 404);
  if (!originAllowed(request)) return json({ error: "forbidden" }, 403);
  const limited = rateLimited(ipCounters, clientIp(request), 10, 10 * 60 * 1000);
  if (limited) return limited;
  const read = await readJson(request, 16 * 1024);
  if (!read.ok) return read.response;
  const session = await requireSession(request, "edit");
  if (session instanceof NextResponse) return session;
  if (!hasAiOptIn(read.body)) return json({ error: "ai_consent_required" }, 403);
  // Consent and the protected route are checked against the saved case, not the request.
  const gate = await aiGate(getQfStorage(), session.caseId).catch(() => "ai_consent_required" as const);
  if (gate) return json({ error: gate }, 403);
  if (typeof read.body.text !== "string") return json({ error: "invalid_request" }, 400);
  try {
    return json(await aiSuggest({ text: read.body.text, locale: asLocale(read.body.locale) }));
  } catch (error) {
    if (error instanceof AiError) return json({ error: error.code }, error.status);
    return json({ error: "ai_unavailable" }, 502);
  }
}
