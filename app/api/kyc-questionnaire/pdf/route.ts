import { NextResponse } from "next/server";
import { clientRoute } from "@/src/lib/kyc-questionnaire/server/http";
import { readPdf } from "@/src/lib/kyc-questionnaire/server/service";

/** The PDF to sign of the client's revision (session cookie; same origin). */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return clientRoute(request, { name: "kyc-pdf", perIp: 60, session: true }, async ({ session }) => {
    const { name, bytes } = await readPdf(session!);
    const ascii = name.normalize("NFD").replace(/[^\x20-\x7e]/g, "").replace(/"/g, "");
    return new NextResponse(Buffer.from(bytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(name)}`,
        "Cache-Control": "no-store",
        "X-Robots-Tag": "noindex",
        "X-Content-Type-Options": "nosniff",
      },
    });
  });
}
