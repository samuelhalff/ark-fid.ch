import { NextResponse } from "next/server";
import { AiError, aiEnabled, extractFromDocument, getUploadedFileReader, hasAiOptIn, setUploadedFileReader } from "@/src/lib/tax-questionnaire/server/ai";
import { getCase, readCaseFile } from "@/src/lib/tax-questionnaire/server/service";
import { getStorage } from "@/src/lib/tax-questionnaire/server/storage";
import { clientIp, json, originAllowed, rateLimited, readJson, requireSession, type Counter } from "@/src/lib/tax-questionnaire/server/http";

/** Reads the uploaded last return / notice of assessment and returns names to pre-fill (gated; client confirms). */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const ipCounters = new Map<string, Counter>();

// Only files of the session's own case can be read (the listing is done per case).
setUploadedFileReader(async (session, fileId) => readCaseFile(getStorage(), await getCase(session.caseId), fileId));

export async function POST(request: Request) {
  if (!aiEnabled()) return json({ error: "ai_disabled" }, 404);
  if (!originAllowed(request)) return json({ error: "forbidden" }, 403);
  const limited = rateLimited(ipCounters, clientIp(request), 6, 10 * 60 * 1000);
  if (limited) return limited;
  const read = await readJson(request, 4 * 1024);
  if (!read.ok) return read.response;
  const session = await requireSession(request, "edit");
  if (session instanceof NextResponse) return session;
  if (!hasAiOptIn(read.body)) return json({ error: "ai_consent_required" }, 403);
  const fileId = read.body.fileId;
  if (typeof fileId !== "string" || fileId.length > 200) return json({ error: "invalid_request" }, 400);
  const reader = getUploadedFileReader();
  if (!reader) return json({ error: "ai_not_configured" }, 503);
  try {
    // The reader checks that the file belongs to this session's case.
    const file = await reader(session, fileId);
    if (!file) return json({ error: "not_found" }, 404);
    return json({ prefill: await extractFromDocument(file.bytes, file.mime, file.name) });
  } catch (error) {
    if (error instanceof AiError) return json({ error: error.code }, error.status);
    return json({ error: "ai_unavailable" }, 502);
  }
}
