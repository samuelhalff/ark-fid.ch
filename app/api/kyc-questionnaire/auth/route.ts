import { plainHtml } from "@/src/lib/tax-questionnaire/server/email";
import { createChallenge, createSession, readCookie, readLink, revokeSession, sessionCookie, verifyChallenge } from "@/src/lib/kyc-questionnaire/server/access";
import { mailSender } from "@/src/lib/kyc-questionnaire/server/config";
import { clientRoute, json, limited } from "@/src/lib/kyc-questionnaire/server/http";
import { contactOf } from "@/src/lib/kyc-questionnaire/server/service";
import { getPorts } from "@/src/lib/kyc-questionnaire/server/sharepoint";

/**
 * Client access:
 *   link   — the link sent by Ark (Cadence) is opened → a 6-digit code is e-mailed to the case's address;
 *   verify — code entered → session cookie for that case and revision;
 *   logout — session revoked.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const maskEmail = (email: string) => email.replace(/^(.)(.*)(@.*)$/, (_m, a: string, b: string, c: string) => `${a}${"•".repeat(Math.min(6, b.length))}${c}`);

const OTP = {
  fr: { subject: (code: string) => `Votre code d'accès Ark Fiduciaire : ${code}`, body: (code: string) => `Votre code pour ouvrir le formulaire KYC d'Ark Fiduciaire SA : ${code}`, valid: "Il est valable 10 minutes. Si vous n'avez rien demandé, ignorez ce message." },
  en: { subject: (code: string) => `Your Ark Fiduciaire access code: ${code}`, body: (code: string) => `Your code to open the Ark Fiduciaire SA KYC form: ${code}`, valid: "It is valid for 10 minutes. If you did not ask for it, ignore this message." },
};

export async function POST(request: Request) {
  return clientRoute(request, { name: "kyc-auth", perIp: 20, session: false }, async ({ body }) => {
    if (body.action === "link") {
      const link = await readLink(body.token);
      if (!link) return json({ error: "link_invalid" }, 410);
      const contact = await contactOf(link.caseId);
      if (contact.closed) return json({ error: "case_closed" }, 410);
      const tooMany = limited("kyc-otp", link.caseId, 6, 60 * 60 * 1000);
      if (tooMany) return tooMany;
      const { code, challenge } = createChallenge({ caseId: link.caseId, revision: link.revision, emailHash: link.emailHash });
      const text = OTP[contact.language];
      await getPorts().sendMail({ from: mailSender(), to: [contact.email], cc: [], subject: text.subject(code), html: plainHtml([text.body(code), text.valid]) });
      return json({ challenge, emailHint: maskEmail(contact.email), language: contact.language });
    }

    if (body.action === "verify") {
      const result = verifyChallenge(body.challenge, body.code);
      if (!result.ok) return json({ error: result.error }, result.error === "otp_locked" ? 429 : 400);
      const { caseId, revision, emailHash } = result.payload;
      const contact = await contactOf(caseId);
      if (contact.emailHash !== emailHash) return json({ error: "otp_invalid" }, 400);
      // The case was closed or reopened (new revision, old links revoked) since the code was sent.
      if (contact.closed || contact.revision !== revision) return json({ error: "link_invalid" }, 410);
      const value = await createSession({ caseId, revision, emailHash });
      const response = json({ ok: true });
      response.headers.append("Set-Cookie", sessionCookie(value));
      return response;
    }

    if (body.action === "logout") {
      await revokeSession(readCookie(request));
      const response = json({ ok: true });
      response.headers.append("Set-Cookie", sessionCookie("", 0));
      return response;
    }

    return json({ error: "invalid_request" }, 400);
  });
}
