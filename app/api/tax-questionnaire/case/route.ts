import { createSession, readCookie, revokeSession, sessionCookie } from "@/src/lib/tax-questionnaire/server/access";
import { deadlinesFor } from "@/src/lib/tax-questionnaire/deadlines";
import { json } from "@/src/lib/tax-questionnaire/server/http";
import { route } from "@/src/lib/tax-questionnaire/server/route-kit";
import {
  createUpload,
  deleteDraft,
  finalizeSubmission,
  invitePartner,
  listUploads,
  notifyAdditions,
  syncStaffDocs,
  readDraft,
  recordFeedback,
  removeUpload,
  reopenCase,
  saveDraft,
  sendResumeLink,
  ServiceError,
} from "@/src/lib/tax-questionnaire/server/service";
import { EMAIL_RE } from "@/src/lib/tax-questionnaire/format";

/**
 * The client's case (session cookie required):
 *   GET            — draft, files, state, deadlines;
 *   POST {action}  — save | delete | resumeLink | upload | remove | submit | additions | reopen | feedback | partner.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
const toDdMmYyyy = (iso?: string) => (iso && /^\d{4}-\d{2}-\d{2}/.test(iso) ? `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}` : undefined);

export async function GET(request: Request) {
  return route(request, { name: "case-get", perIp: 120, scope: "any" }, async ({ storage, info, session }) => {
    if (!info || !session) return json({ error: "session_expired" }, 401);
    // Staff "Documents à demander" lines join the client's to-do (and the reminders).
    const draft = (await syncStaffDocs(storage, info).catch(() => null)) || (await readDraft(storage, info));
    const files = await listUploads(storage, info);
    const answers = draft?.answers || {};
    return json({
      caseId: info.caseId,
      scope: session.scope,
      state: info.main.state,
      submittedAt: info.main.submittedAt || null,
      email: info.email,
      language: info.language,
      years: info.records.map((r) => r.taxYear),
      draft,
      files,
      deadlines: deadlinesFor(answers, { extendedTo: toDdMmYyyy(info.main.extendedTo) }),
    });
  });
}

export async function POST(request: Request) {
  const action = request.headers.get("x-tqf-action") || "";
  const maxBytes = action === "submit" || action === "save" ? 600 * 1024 : 32 * 1024;
  const scope = ["additions", "feedback", "reopen", "upload", "resumeLink"].includes(action) ? "any" : "edit";
  const perIp = action === "save" ? 600 : action === "upload" ? 400 : 60;
  return route(request, { name: `case-${action || "unknown"}`, perIp, maxBytes, scope }, async ({ body, storage, info, session }) => {
    if (!info || !session) return json({ error: "session_expired" }, 401);
    switch (action) {
      case "save":
        return json(await saveDraft(storage, info, { answers: body.answers, stepId: body.stepId, docStatus: body.docStatus, locale: body.locale, aiOptIn: body.aiOptIn, submitKey: body.submitKey }));
      case "delete":
        await deleteDraft(storage, info);
        return json({ ok: true });
      case "resumeLink":
        await sendResumeLink(storage, info);
        return json({ ok: true });
      case "upload": {
        // After submission (status page) clients may still add documents, never remove them.
        const result = await createUpload(storage, info, {
          docKey: str(body.docKey),
          label: str(body.label).slice(0, 80),
          fileName: str(body.fileName).slice(0, 200),
          size: Number(body.size),
          mime: str(body.mime).slice(0, 120),
        });
        return json(result);
      }
      case "remove":
        await removeUpload(storage, info, str(body.itemId));
        return json({ ok: true });
      case "submit":
        return json(
          await finalizeSubmission(storage, info, {
            locale: body.locale,
            answers: body.answers,
            docStatus: body.docStatus,
            privacyAccepted: body.privacyAccepted,
            certified: body.certified,
            aiOptIn: body.aiOptIn,
            submitKey: body.submitKey,
          }),
        );
      case "additions":
        if (info.main.state !== "submitted") throw new ServiceError("invalid_request");
        await notifyAdditions(storage, info);
        return json({ ok: true });
      case "reopen":
        if (info.main.state !== "submitted") throw new ServiceError("invalid_request");
        await reopenCase(info);
        {
          // Same verified visitor: the status session is exchanged for an edit session.
          await revokeSession(readCookie(request));
          const response = json({ ok: true });
          response.headers.append("Set-Cookie", sessionCookie(await createSession({ caseId: info.caseId, emailHash: info.emailHash, scope: "edit" })));
          return response;
        }
      case "feedback":
        await recordFeedback(info, str(body.source));
        return json({ ok: true });
      case "partner": {
        const email = str(body.email).toLowerCase();
        if (!EMAIL_RE.test(email) || !str(body.firstName) || !str(body.lastName)) throw new ServiceError("invalid_request");
        await invitePartner(storage, info, { email, firstName: str(body.firstName).slice(0, 100), lastName: str(body.lastName).slice(0, 100) });
        return json({ ok: true });
      }
      default:
        return json({ error: "invalid_request" }, 400);
    }
  });
}
