import { json, staffRoute } from "@/src/lib/kyc-questionnaire/server/http";
import { changes, createCase } from "@/src/lib/kyc-questionnaire/server/service";

/**
 * Cadence API (signed requests, see docs/kyc-questionnaire.md):
 *   GET  ?cursor=<cursor>&limit=<n> — change feed;
 *   POST — create a case (Idempotency-Key required): returns the case and the client link (no e-mail is sent).
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return staffRoute(request, async () => {
    const url = new URL(request.url);
    const cursor = (url.searchParams.get("cursor") || "").slice(0, 120);
    const limit = Number(url.searchParams.get("limit")) || 50;
    return json(await changes(cursor, limit));
  });
}

const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");

export async function POST(request: Request) {
  return staffRoute(request, async ({ body, keyId, idempotencyKey, payloadHash }) => {
    const folder = (body.clientFolder || {}) as Record<string, unknown>;
    const result = await createCase(
      {
        clientRef: str(body.clientRef),
        displayName: str(body.displayName),
        route: str(body.route),
        language: str(body.language),
        email: str(body.email),
        clientFolder: { driveId: str(folder.driveId), itemId: str(folder.itemId) },
        prefill: body.prefill,
      },
      { keyId, idempotencyKey, payloadHash },
    );
    return json({ ...result.summary, link: result.link, replayed: result.replayed }, result.replayed ? 200 : 201);
  });
}
