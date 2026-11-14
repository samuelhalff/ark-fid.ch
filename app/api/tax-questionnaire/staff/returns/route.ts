import { json } from "@/src/lib/tax-questionnaire/server/http";
import { changes, createReturn } from "@/src/lib/tax-questionnaire/server/staff";
import { staffRoute } from "@/src/lib/tax-questionnaire/server/staff-http";

/**
 * Cadence API (signed requests, see docs/tax-questionnaire.md « API bureau (Cadence) »):
 *   GET  ?cursor=<cursor>&limit=<n> — change feed, one item per (caseId, year), never answers;
 *   POST {clientRef, spouseRef?, firstName, lastName, email, language, canton, taxYear,
 *         prefill?: {answers, notes}, sendInvitation} — find-or-create the return (Idempotency-Key
 *         required): 201 created, 200 adopted or replayed; the summary and a staff link.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return staffRoute(request, async ({ deps }) => {
    const url = new URL(request.url);
    const cursor = (url.searchParams.get("cursor") || "").slice(0, 160);
    const limit = Number(url.searchParams.get("limit")) || 50;
    return json(await changes(cursor, limit, deps));
  });
}

export async function POST(request: Request) {
  return staffRoute(request, async ({ body, idempotencyKey, deps }) => {
    const result = await createReturn(body, { idempotencyKey }, deps);
    return json({ ...result.summary, link: result.link, replayed: result.replayed, adopted: result.adopted }, result.created ? 201 : 200);
  });
}
