import { clientRoute, json } from "@/src/lib/kyc-questionnaire/server/http";
import { clientCase, confirmSigned, createUpload, deleteUpload, saveDraft, submit } from "@/src/lib/kyc-questionnaire/server/service";

/** The client's case: GET reads it; POST with x-kqf-action saves, uploads, submits, confirms the signature. */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return clientRoute(request, { name: "kyc-case-read", perIp: 240, session: true }, async ({ session }) => json(await clientCase(session!)));
}

export async function POST(request: Request) {
  const action = request.headers.get("x-kqf-action") || "";
  return clientRoute(request, { name: `kyc-case-${action || "none"}`, perIp: action === "save" ? 600 : 120, maxBytes: 512 * 1024, session: true }, async ({ body, session }) => {
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
      default:
        return json({ error: "invalid_request" }, 400);
    }
  });
}
