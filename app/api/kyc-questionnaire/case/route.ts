import { clientRoute, json, limited } from "@/src/lib/kyc-questionnaire/server/http";
import { askField, clientCase, confirmSigned, createUpload, deleteUpload, saveDraft, signOnline, submit } from "@/src/lib/kyc-questionnaire/server/service";

/** The client's case: GET reads it; POST with x-kqf-action saves, uploads, submits, signs online, confirms the signed scan or asks about a field. */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return clientRoute(request, { name: "kyc-case-read", perIp: 240, session: true }, async ({ session }) => json(await clientCase(session!)));
}

export async function POST(request: Request) {
  const action = request.headers.get("x-kqf-action") || "";
  const perIp = action === "save" ? 600 : action === "ask" ? 30 : 120;
  return clientRoute(request, { name: `kyc-case-${action || "none"}`, perIp, maxBytes: 512 * 1024, session: true }, async ({ body, session }) => {
    switch (action) {
      case "save":
        return json(await saveDraft(session!, body));
      case "upload":
        return json(await createUpload(session!, body));
      case "delete":
        return json(await deleteUpload(session!, body));
      case "submit":
        return json(await submit(session!, body));
      case "signed":
        return json(await confirmSigned(session!));
      case "sign-online":
        return json(await signOnline(session!, body));
      case "ask": {
        // At most 20 questions per case in ten minutes (Cadence keeps the same cap).
        const tooMany = limited("kyc-ask:case", session!.caseId, 20);
        return tooMany || json(await askField(session!, body));
      }
      default:
        return json({ error: "invalid_request" }, 400);
    }
  });
}
