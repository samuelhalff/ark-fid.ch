import { json, staffRoute } from "@/src/lib/kyc-questionnaire/server/http";
import { previewForm } from "@/src/lib/kyc-questionnaire/server/service";

/**
 * Cadence's read-only preview of the client form, before any case exists:
 *   POST {route, prefill?, skippedDocuments?} → { pages, documentItems }
 * Same engine as the real form, so the preview cannot drift from what the client sees.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  return staffRoute(request, async ({ body }) => {
    const route = String(body.route || "");
    const prefill = body.prefill && typeof body.prefill === "object" ? (body.prefill as Record<string, unknown>) : null;
    const skipped = Array.isArray(body.skippedDocuments) ? body.skippedDocuments.filter((key): key is string => typeof key === "string").slice(0, 100) : [];
    return json(previewForm(route, prefill, skipped));
  });
}
