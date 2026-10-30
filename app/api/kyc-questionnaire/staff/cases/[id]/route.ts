import { json, staffRoute } from "@/src/lib/kyc-questionnaire/server/http";
import { staffAction, staffCase, type StaffAction } from "@/src/lib/kyc-questionnaire/server/service";

/**
 * Cadence API for one case:
 *   GET  — the case, with the submitted answers of the latest revision;
 *   POST {action: "link" | "reopen" | "close", expectedRevision, prefill?, route?} (Idempotency-Key required).
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ACTIONS: StaffAction[] = ["link", "reopen", "close"];

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  return staffRoute(request, async () => json({ ...(await staffCase(id)) }));
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  return staffRoute(request, async ({ body, idempotencyKey, payloadHash }) => {
    const action = String(body.action || "") as StaffAction;
    if (!ACTIONS.includes(action)) return json({ error: "invalid_request", field: "action" }, 400);
    const result = await staffAction(id, action, body, { idempotencyKey, payloadHash });
    return json({ ...result.summary, ...(result.link ? { link: result.link } : {}), replayed: result.replayed });
  });
}
