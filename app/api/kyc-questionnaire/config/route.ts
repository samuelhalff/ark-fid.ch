import { json } from "@/src/lib/kyc-questionnaire/server/http";
import { UPLOAD_LIMITS } from "@/src/lib/tax-questionnaire/files";

/** Public configuration of the KYC page (no secrets). */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return json({ maxFileBytes: UPLOAD_LIMITS.maxFileBytes });
}
