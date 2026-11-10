import { plainHtml } from "@/src/lib/tax-questionnaire/server/email";
import { createChallenge, createPick, createSession, emailHash, normaliseEmail, readCookie, readLink, readPick, releaseChallenge, revokeSession, sessionCookie, STAFF_HASH, STAFF_SESSION_TTL_MS, redeemAssist, verifyChallenge } from "@/src/lib/kyc-questionnaire/server/access";
import { mailSender } from "@/src/lib/kyc-questionnaire/server/config";
import { clientRoute, json, limited } from "@/src/lib/kyc-questionnaire/server/http";
import { accessFor, contactOf, KycError } from "@/src/lib/kyc-questionnaire/server/service";
import { getPorts } from "@/src/lib/kyc-questionnaire/server/sharepoint";

/**
 * Client access:
 *   link   — the link sent by Ark (Cadence) is opened → a 6-digit code is e-mailed to the case's address;
 *   verify — code entered → session cookie for that case and revision;
 *   email  — no link: the client types their address → the same code, e-mailed only if a form in
 *            progress was issued to it; the answer is identical either way and sent before any lookup;
 *   pick   — after an e-mail code, the form chosen when the address has several in progress;
 *   assist — Ark staff: the single-use code ("Code cabinet") or link issued by Cadence's `assist` action
 *            opens the open revision with role "staff" (no e-mail code: the access itself is the secret);
 *   logout — session revoked.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const maskEmail = (email: string) => email.replace(/^(.)(.*)(@.*)$/, (_m, a: string, b: string, c: string) => `${a}${"•".repeat(Math.min(6, b.length))}${c}`);

const OTP = {
  fr: { subject: (code: string) => `Votre code d'accès Ark Fiduciaire : ${code}`, body: (code: string) => `Votre code pour ouvrir le formulaire KYC d'Ark Fiduciaire SA : ${code}`, valid: "Il est valable 10 minutes. Si vous n'avez rien demandé, ignorez ce message." },
  en: { subject: (code: string) => `Your Ark Fiduciaire access code: ${code}`, body: (code: string) => `Your code to open the Ark Fiduciaire SA KYC form: ${code}`, valid: "It is valid for 10 minutes. If you did not ask for it, ignore this message." },
};

const EMAIL_RE = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,}$/;
/** States in which the client still has something to do. */
const ACTIVE = new Set(["open", "awaiting_signature"]);

/**
 * Forms in progress issued to this address (current address of the case, not closed), at most
 * 10. A missing case is skipped; any other storage failure is thrown, never read as "no form".
 */
async function activeCases(hash: string) {
  const out: { caseId: string; displayName: string; revision: number; language: "fr" | "en"; email: string }[] = [];
  for (const caseId of await getPorts().access.casesByEmail(hash)) {
    const access = await accessFor(caseId, hash).catch((error) => {
      if (error instanceof KycError && error.code === "case_not_found") return null;
      throw error;
    });
    if (access && !access.closed && ACTIVE.has(access.state)) out.push({ caseId, displayName: access.displayName, revision: access.revision, language: access.language, email: access.email });
    if (out.length >= 10) break;
  }
  return out;
}

async function sessionFor(caseId: string, revision: number, hash: string) {
  const value = await createSession({ caseId, revision, emailHash: hash });
  const response = json({ ok: true });
  response.headers.append("Set-Cookie", sessionCookie(value));
  return response;
}

export async function POST(request: Request) {
  return clientRoute(request, { name: "kyc-auth", perIp: 20, session: false }, async ({ body, ip }) => {
    if (body.action === "link") {
      const link = await readLink(body.token);
      if (!link) return json({ error: "link_invalid" }, 410);
      // The code goes to the address the link was issued for: the contact, or a signatory still to sign.
      const access = await accessFor(link.caseId, link.emailHash);
      if (access?.closed) return json({ error: "case_closed" }, 410);
      if (!access || access.revision !== link.revision) return json({ error: "link_invalid" }, 410);
      const tooMany = limited("kyc-otp", `${link.caseId}:${link.emailHash}`, 6, 60 * 60 * 1000) || limited("kyc-otp-case", link.caseId, 15, 60 * 60 * 1000);
      if (tooMany) return tooMany;
      const { code, challenge } = createChallenge({ caseId: link.caseId, revision: link.revision, emailHash: link.emailHash });
      const text = OTP[access.language];
      await getPorts().sendMail({ from: mailSender(), to: [access.email], cc: [], subject: text.subject(code), html: plainHtml([text.body(code), text.valid]) });
      return json({ challenge, emailHint: maskEmail(access.email), language: access.language });
    }

    if (body.action === "email") {
      const email = typeof body.email === "string" ? normaliseEmail(body.email) : "";
      if (email.length > 254 || !EMAIL_RE.test(email)) return json({ error: "invalid_email" }, 400);
      const hash = emailHash(email);
      const tooMany = limited("kyc-otp-email", hash, 5, 60 * 60 * 1000) || limited("kyc-otp-email-ip", ip, 10, 60 * 60 * 1000);
      if (tooMany) return tooMany;
      const { code, challenge } = createChallenge({ caseId: "", revision: 0, emailHash: hash, byEmail: true });
      // After the answer: its content and timing do not depend on whether the address is a client's.
      void activeCases(hash)
        .then(async (cases) => {
          if (!cases.length) return;
          const text = OTP[cases[0].language];
          await getPorts().sendMail({ from: mailSender(), to: [cases[0].email], cc: [], subject: text.subject(code), html: plainHtml([text.body(code), text.valid]) });
        })
        .catch((error) => console.error("kyc email code", error instanceof Error ? error.message : "error"));
      return json({ challenge, emailHint: maskEmail(email) });
    }

    if (body.action === "verify") {
      const result = verifyChallenge(body.challenge, body.code);
      if (!result.ok) return json({ error: result.error }, result.error === "otp_locked" ? 429 : 400);
      if (result.payload.byEmail) {
        const cases = await activeCases(result.payload.emailHash).catch(() => null);
        // Storage failure: the code stays usable for another try.
        if (!cases) {
          releaseChallenge(result.payload.id);
          return json({ error: "storage_unavailable" }, 503);
        }
        if (!cases.length) return json({ error: "otp_invalid" }, 400);
        if (cases.length === 1) return sessionFor(cases[0].caseId, cases[0].revision, result.payload.emailHash);
        return json({ choose: cases.map((c) => ({ caseId: c.caseId, name: c.displayName })), pick: createPick(result.payload.emailHash, cases.map((c) => c.caseId)) });
      }
      const { caseId, revision, emailHash: hash } = result.payload;
      const access = await accessFor(caseId, hash);
      if (!access) return json({ error: "otp_invalid" }, 400);
      // The case was closed or reopened (new revision, old links revoked) since the code was sent.
      if (access.closed || access.revision !== revision) return json({ error: "link_invalid" }, 410);
      return sessionFor(caseId, revision, hash);
    }

    if (body.action === "pick") {
      const pick = readPick(body.pick);
      if (!pick || typeof body.caseId !== "string" || !pick.caseIds.includes(body.caseId)) return json({ error: "otp_expired" }, 400);
      const chosen = (await activeCases(pick.emailHash)).find((c) => c.caseId === body.caseId);
      if (!chosen) return json({ error: "link_invalid" }, 410);
      return sessionFor(chosen.caseId, chosen.revision, pick.emailHash);
    }

    if (body.action === "assist") {
      const tooMany = limited("kyc-assist", ip, 10, 10 * 60 * 1000);
      if (tooMany) return tooMany;
      const assist = await redeemAssist({ token: body.token, code: body.code });
      if (!assist) return json({ error: "assist_invalid" }, 400);
      const state = await contactOf(assist.caseId);
      if (state.closed) return json({ error: "case_closed" }, 410);
      if (state.state !== "open" || state.revision !== assist.revision) return json({ error: "assist_invalid" }, 410);
      const value = await createSession({ caseId: assist.caseId, revision: assist.revision, emailHash: STAFF_HASH, staffBy: assist.by }, { ttlMs: STAFF_SESSION_TTL_MS });
      const response = json({ ok: true, staff: true });
      response.headers.append("Set-Cookie", sessionCookie(value, STAFF_SESSION_TTL_MS / 1000));
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
