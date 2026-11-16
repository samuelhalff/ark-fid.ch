import { NextResponse } from "next/server";
import { staffRoute } from "@/src/lib/kyc-questionnaire/server/http";
import { previewPdf } from "@/src/lib/kyc-questionnaire/server/service";

/**
 * Cadence's « PDF » of a form not signed yet:
 *   POST {route, answers, clientName, language} → application/pdf, « Brouillon — non signé »
 * The form's own layout (Ark letterhead, sections), so Cadence never keeps a second print.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  return staffRoute(request, async ({ body }) => {
    const answers = body.answers && typeof body.answers === "object" ? (body.answers as Record<string, unknown>) : null;
    const pdf = await previewPdf(String(body.route || ""), answers, String(body.clientName || ""), String(body.language || "fr"));
    return new NextResponse(Buffer.from(pdf), { status: 200, headers: { "content-type": "application/pdf", "cache-control": "no-store" } });
  });
}
