import { createChallenge, createSession, emailHash, readCookie, readLink, revokeSession, sessionCookie, verifyChallenge } from "@/src/lib/tax-questionnaire/server/access";
import { json, rateLimited, skipTurnstile, verifyTurnstile, type Counter } from "@/src/lib/tax-questionnaire/server/http";
import { otpMail } from "@/src/lib/tax-questionnaire/server/mails";
import { route } from "@/src/lib/tax-questionnaire/server/route-kit";
import { createCase, getCase, optOut, sendLinksForEmail } from "@/src/lib/tax-questionnaire/server/service";
import { normalise } from "@/src/lib/tax-questionnaire/server/sharepoint-registry";
import { EMAIL_RE } from "@/src/lib/tax-questionnaire/format";
import { sanitizeAnswers, stepById, validateStep } from "@/src/lib/tax-questionnaire/logic";
import { QF_LOCALES, type QfLocale } from "@/src/lib/tax-questionnaire/types";

/**
 * Access without accounts:
 *   start  — start screen done: Turnstile + privacy acknowledgement → code e-mailed (no case yet);
 *   verify — code entered → (new) case created, or (link) case opened → session cookie;
 *   link   — magic link opened → code e-mailed to the case's address;
 *   find   — "I already started": links e-mailed for the cases of an address (never says if any);
 *   logout — session revoked.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const perEmail = new Map<string, Counter>();
const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
const locale = (v: unknown): QfLocale => ((QF_LOCALES as readonly string[]).includes(String(v)) ? (v as QfLocale) : "fr");
const maskEmail = (email: string) => email.replace(/^(.)(.*)(@.*)$/, (_m, a: string, b: string, c: string) => `${a}${"•".repeat(Math.min(6, b.length))}${c}`);

export async function POST(request: Request) {
  return route(request, { name: "auth", perIp: 20, maxBytes: 64 * 1024, scope: "none" }, async ({ body, ip, storage }) => {
    const action = body.action;
    const lang = locale(body.locale);

    if (action === "start") {
      if (body.privacyAccepted !== true) return json({ error: "consent_required" }, 400);
      const answers = sanitizeAnswers(body.answers);
      const errors = validateStep(stepById("start")!, answers);
      if (Object.keys(errors).length) return json({ error: "invalid_answers", fields: Object.keys(errors) }, 422);
      const email = str(answers["start.email"]);
      const limited = rateLimited(perEmail, normalise(email), 4, 60 * 60 * 1000);
      if (limited) return limited;
      if (!skipTurnstile()) {
        if (!(await verifyTurnstile(str(body.turnstileToken), ip))) return json({ error: "turnstile_failed" }, 400);
      }
      const { code, challenge } = createChallenge({
        purpose: "new",
        emailHash: emailHash(email),
        email,
        firstName: str(answers["start.firstName"]),
        lastName: str(answers["start.lastName"]),
      });
      await storage.sendMail(otpMail(lang, email, code));
      return json({ challenge, emailHint: maskEmail(email) });
    }

    if (action === "link") {
      const link = await readLink(body.token);
      if (!link) return json({ error: "link_invalid" }, 410);
      if (link.purpose === "optout" && link.caseId.startsWith("client:")) {
        await optOut(link.caseId.slice("client:".length));
        return json({ optedOut: true });
      }
      const info = await getCase(link.caseId);
      const limited = rateLimited(perEmail, info.emailHash, 6, 60 * 60 * 1000);
      if (limited) return limited;
      const scope = info.main.state === "submitted" ? "status" : link.scope;
      const { code, challenge } = createChallenge({ purpose: "link", emailHash: info.emailHash, caseId: info.caseId, scope });
      await storage.sendMail(otpMail(info.language, info.email, code));
      return json({ challenge, emailHint: maskEmail(info.email) });
    }

    if (action === "verify") {
      const result = verifyChallenge(body.challenge, body.code);
      if (!result.ok) return json({ error: result.error }, result.error === "otp_locked" ? 429 : 400);
      const payload = result.payload;
      let caseId = payload.caseId || "";
      let scope = payload.scope || "edit";
      if (payload.purpose === "new") {
        const answers = sanitizeAnswers(body.answers);
        // The verified identity wins over anything re-sent.
        if (normalise(str(answers["start.email"])) !== normalise(payload.email || "")) return json({ error: "otp_invalid" }, 400);
        const info = await createCase(storage, {
          identity: { email: payload.email || "", firstName: payload.firstName || "", lastName: payload.lastName || "" },
          locale: lang,
          answers,
          source: "web",
        });
        caseId = info.caseId;
        scope = "edit";
      } else {
        const info = await getCase(caseId);
        if (info.emailHash !== payload.emailHash) return json({ error: "otp_invalid" }, 400);
        if (info.main.state === "submitted") scope = "status";
        if (info.main.state === "invited") scope = "edit";
      }
      const value = await createSession({ caseId, emailHash: payload.emailHash, scope });
      const response = json({ ok: true, scope });
      response.headers.append("Set-Cookie", sessionCookie(value));
      return response;
    }

    if (action === "find") {
      const email = str(body.email).toLowerCase();
      if (!EMAIL_RE.test(email)) return json({ error: "invalid_email" }, 400);
      const limited = rateLimited(perEmail, `find:${normalise(email)}`, 3, 60 * 60 * 1000);
      if (limited) return limited;
      if (!skipTurnstile() && !(await verifyTurnstile(str(body.turnstileToken), ip))) return json({ error: "turnstile_failed" }, 400);
      try {
        await sendLinksForEmail(storage, email);
      } catch (error) {
        console.error("[tax-qf] find failed", error instanceof Error ? error.message.slice(0, 80) : "");
      }
      // Same answer whether or not a questionnaire exists for this address.
      return json({ ok: true });
    }

    if (action === "logout") {
      await revokeSession(readCookie(request));
      const response = json({ ok: true });
      response.headers.append("Set-Cookie", sessionCookie("", 0));
      return response;
    }

    return json({ error: "invalid_request" }, 400);
  });
}
