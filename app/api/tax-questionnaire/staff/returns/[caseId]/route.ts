import { json } from "@/src/lib/tax-questionnaire/server/http";
import { STAFF_ACTIONS, staffAction, staffReturn, type StaffAction } from "@/src/lib/tax-questionnaire/server/staff";
import { staffRoute } from "@/src/lib/tax-questionnaire/server/staff-http";

/**
 * Cadence API for one case:
 *   GET  ?year=<taxYear> — the return (latest year by default) with its documents, answers and
 *        filledBy (answer key → who at Ark entered it; submittedBy when Ark sent it), and questions
 *        (what the client sees now, in French: [{id, kind: field|group, step, stepTitle, label, type?,
 *        options?: [{value, label}], required?, fields?, maxRows?}]), and pages (the answers to read,
 *        in ?lang=fr|en|de, French by default: [{id, title, sections: [{id, title, items: [{kind: field, id,
 *        label, value, valid} | {kind: group, id, label, rows: [{title, fields: [field…]}]}]}]}], answered
 *        questions only — the tabs Situation / Revenus / Fortune / Déductions);
 *   POST {action, taxYear?, email?, send?, extendedTo?, staffDocs?, officeDocs?, clientRef?, by?, ttlMinutes?, answers?} (Idempotency-Key required):
 *        link (per case: new staff link; email changes the address; send mails it) |
 *        remind {taxYear} | exclude / include {taxYear} | deadline {taxYear, extendedTo} |
 *        staffDocs {taxYear, staffDocs: (string | {label, help?, required?})[]} | officeDocs {taxYear, officeDocs: string[]} (document keys the
 *        office holds: off the client's to-do, missing list and reminders) | attach {clientRef} |
 *        assist {taxYear, by, ttlMinutes?} (office access « Code cabinet »: answer adds
 *        assist: {link (#assist=), code, expiresAt}; single use; nothing e-mailed) |
 *        prefill {taxYear, by, answers: {<question id>: value}} (writes as an office session, marked
 *        « rempli par Ark »; all or nothing, 400 invalid_answers {fields: [{id, error}]}; 409 not_started /
 *        case_closed / already_submitted; answer adds prefill: {written, unchanged, hidden}).
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request, context: { params: Promise<{ caseId: string }> }) {
  const { caseId } = await context.params;
  const query = new URL(request.url).searchParams;
  return staffRoute(request, async ({ deps }) => json(await staffReturn(caseId, query.get("year") || undefined, deps, query.get("lang"))));
}

export async function POST(request: Request, context: { params: Promise<{ caseId: string }> }) {
  const { caseId } = await context.params;
  return staffRoute(request, async ({ body, idempotencyKey, payloadHash, deps }) => {
    const action = String(body.action || "") as StaffAction;
    if (!STAFF_ACTIONS.includes(action)) return json({ error: "invalid_request", field: "action" }, 400);
    const result = await staffAction(caseId, action, body, { idempotencyKey, payloadHash }, deps);
    return json({ ...result.summary, ...(result.extra || {}), ...(result.link ? { link: result.link } : {}), replayed: result.replayed });
  });
}
