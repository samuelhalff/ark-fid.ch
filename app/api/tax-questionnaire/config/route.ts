import { aiEnabled } from "@/src/lib/tax-questionnaire/server/ai";
import { json, skipTurnstile } from "@/src/lib/tax-questionnaire/server/http";
import { UPLOAD_LIMITS } from "@/src/lib/tax-questionnaire/files";

/** Public configuration of the questionnaire page (no secrets). */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return json({
    turnstileSiteKey: skipTurnstile() ? "" : (process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || "").trim(),
    aiEnabled: aiEnabled(),
    maxFileBytes: UPLOAD_LIMITS.maxFileBytes,
    maxFiles: UPLOAD_LIMITS.maxFiles,
  });
}
