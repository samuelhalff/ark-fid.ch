/**
 * Annual campaign (DECISIONS §E 19): advance notice in January for clients who never used the
 * questionnaire, invitation from 1 February for the previous tax year (pre-filled when a
 * previous return exists), reminder 14 days later, then at D-30 and D-10 before the deadline,
 * and one staff digest per run. Every decision is derived from tracker / preference fields, so
 * re-running the same day sends nothing twice. Called by the daily cron route.
 */
import { createHash } from "node:crypto";
import { campaignStopDate } from "../deadlines";
import { personName } from "../format";
import type { IssueLinkOptions } from "./access";
import { escapeHtml, firstNameOf, isInternalCase, mailConfig, plainHtml, VOICE, type MailBlock } from "./email";
import type { ClientPreferences, ClientRegistry, PreferenceStore, ReturnRecord, ReturnTracker } from "./ports";
import { clientKey as computeClientKey } from "./service";
import type { MailMessage } from "./storage";

export interface CampaignLedger {
  has(key: string): Promise<boolean>;
  add(key: string): Promise<void>;
}

export interface InvitedReturnInput {
  clientKey: string;
  email: string;
  name: string;
  language: string;
  taxYear: number;
  prefillFrom?: ReturnRecord;
  /** Planned tracker row (staff inventory) that becomes this return's row. */
  planned?: ReturnRecord;
  /** Case prepared by Ark (staff invitation): answers to start from, instead of last year's. */
  prefillAnswers?: Record<string, unknown>;
  /** Staff notes for the preparer (kept server-side, in the case folder). */
  notes?: string[];
}

export interface CampaignDeps {
  registry: ClientRegistry;
  tracker: ReturnTracker;
  prefs: PreferenceStore;
  sendMail(message: MailMessage): Promise<void>;
  issueLink(options: IssueLinkOptions): Promise<string>;
  createInvitedReturn(input: InvitedReturnInput): Promise<ReturnRecord>;
  staffRecipients: string[];
  /** Optional: makes the staff digest idempotent per day (the cron route passes its ledger). */
  ledger?: CampaignLedger;
  /** E-mail fingerprint used by the access store (the app passes access.emailHash, keyed). */
  hashEmail?: (email: string) => string;
  /** Optional: recounts a submitted return's missing documents (tracker updated), returns the labels. */
  refreshMissing?: (record: ReturnRecord) => Promise<string[]>;
  /** Optional: labels of the documents still missing on a return (reminder e-mail). */
  missingDocuments?: (record: ReturnRecord, language: Lang) => Promise<string[]>;
  /** Optional cleanup of abandoned drafts (cron task "cleanup"); implemented by the app. */
  cleanupAbandonedDrafts?: () => Promise<{ deleted: number }>;
}

export interface CampaignSummary {
  notices: number;
  invitations: number;
  reminders: number;
  /** Reminders for documents still missing after submission. */
  missingReminders: number;
  escalations: number;
  skipped: number;
  dryRun: boolean;
}

const DAY = 24 * 60 * 60 * 1000;
const INVITATION_TTL = 14 * DAY;
const OPTOUT_TTL = 120 * DAY;
/** Staff statuses that end the campaign for a return (staff-owned column). */
export const STOP_STATUSES = ["Déposé", "Clos"];

type Lang = "fr" | "en" | "de";
export const lang = (value: string | undefined): Lang => (value === "en" || value === "de" ? value : "fr");

/** Fallback fingerprint (tests); production passes the keyed access.emailHash via deps.hashEmail. */
export const emailHashOf = (email: string) =>
  createHash("sha256").update(`ark-tax-qf-email|${email.trim().toLowerCase()}`).digest("hex").slice(0, 32);

const utcDay = (d: Date) => Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
const daysBetween = (from: Date, to: Date) => Math.round((utcDay(to) - utcDay(from)) / DAY);
const iso = (d: Date) => d.toISOString();

export interface Member {
  clientKey: string;
  email: string;
  name: string;
  language: Lang;
  prefs: ClientPreferences | null;
  /** Planned row of the tracker (staff inventory) this client is invited from. */
  planned?: ReturnRecord;
}

/**
 * Planned rows (staff inventory, Provenance "inventaire"): tracker rows without a case. They are
 * campaign audience records, not returns: the invitation creates the case on that same row.
 */
export const isPlanned = (r: ReturnRecord) => !r.caseId && r.source === "inventaire";
/** Planned row still to be validated by staff: never invited, never announced. */
export const PLANNED_PENDING = "À valider";
/** Client key of a planned row whose ClientKey column is empty (stable, from the row id). */
export const plannedKey = (r: ReturnRecord) => createHash("sha256").update(`ark-tax-qf-planned|${r.trackerId || r.name}`).digest("hex").slice(0, 24);
const sameEmail = (a: string, b: string) => !!a && !!b && a.trim().toLowerCase() === b.trim().toLowerCase();
/**
 * Planned row for a client (by client key, else by a unique e-mail match). An e-mail shared by
 * several planned rows matches none of them (left to staff).
 */
export function plannedFor(rows: ReturnRecord[], member: { clientKey: string; email: string }): ReturnRecord | undefined {
  const byKey = rows.filter((r) => r.clientKey && r.clientKey === member.clientKey);
  if (byKey.length === 1) return byKey[0];
  if (byKey.length > 1) return undefined;
  const byEmail = rows.filter((r) => sameEmail(r.email, member.email));
  return byEmail.length === 1 ? byEmail[0] : undefined;
}

// ---- mails --------------------------------------------------------------------------------------

/** Client campaign mails, in Samuel's voice (owner-approved French model for the invitation). */
const TEXT: Record<Lang, { notice: { subject: string; body: string[] }; invitation: { subject: string; lead: string; fresh: string; renewal: string; prepared: string }; reminder: { subject: string; ask: string; missing: string }; missingDocs: { subject: string; lead: string; open: string }; courtesy: string; optout: string }> = {
  fr: {
    notice: {
      subject: "Votre déclaration d'impôt {year}",
      body: [
        "Début février, nous vous enverrons un lien vers un questionnaire en ligne pour préparer votre déclaration d'impôt {year}.",
        "Si vous préférez ne pas le recevoir, vous pouvez vous désinscrire ci-dessous.",
      ],
    },
    invitation: {
      subject: "Votre déclaration d'impôt {year}",
      lead: "Nous préparons votre déclaration d'impôt {year}.",
      fresh: "Merci de remplir votre questionnaire et d'y ajouter vos documents {year} :",
      renewal: "Votre questionnaire reprend les informations de l'an dernier. Merci de corriger ce qui a changé et d'ajouter vos documents {year} :",
      prepared: "Nous avons pré-rempli votre questionnaire avec les informations que vous nous avez transmises. Merci de les vérifier, de compléter ce qui manque et d'ajouter vos documents {year} :",
    },
    reminder: { subject: "Rappel : votre questionnaire fiscal {year}", ask: "Avez-vous pu remplir votre questionnaire {year} ?", missing: "Avez-vous pu remplir votre questionnaire {year} ? Il nous manque encore :" },
    missingDocs: { subject: "Documents pour votre déclaration {year}", lead: "Merci pour votre questionnaire {year}. Il nous manque encore :", open: "Ajouter les documents" },
    courtesy: "J'espère que vous allez bien.",
    optout: "Ne plus recevoir ces emails",
  },
  en: {
    notice: {
      subject: "Your {year} tax return",
      body: ["In early February we will send you a link to an online questionnaire to prepare your {year} tax return.", "If you would rather not receive it, you can unsubscribe below."],
    },
    invitation: {
      subject: "Your {year} tax questionnaire",
      lead: "We are preparing your {year} tax return.",
      fresh: "Please fill in your questionnaire and add your {year} documents:",
      renewal: "Your questionnaire carries over last year's information. Please correct what has changed and add your {year} documents:",
      prepared: "We have pre-filled your questionnaire with the information you sent us. Please check it, complete what is missing and add your {year} documents:",
    },
    reminder: { subject: "Reminder: your {year} tax questionnaire", ask: "Have you been able to fill in your {year} questionnaire?", missing: "Have you been able to fill in your {year} questionnaire? We are still missing:" },
    missingDocs: { subject: "Documents for your {year} tax return", lead: "Thank you for your {year} questionnaire. We are still missing:", open: "Add the documents" },
    courtesy: "I hope you are well.",
    optout: "Stop receiving these emails",
  },
  de: {
    notice: {
      subject: "Ihre Steuererklärung {year}",
      body: ["Anfang Februar senden wir Ihnen einen Link zu einem Online-Fragebogen für Ihre Steuererklärung {year}.", "Wenn Sie ihn nicht erhalten möchten, können Sie sich unten abmelden."],
    },
    invitation: {
      subject: "Ihr Steuerfragebogen {year}",
      lead: "Wir bereiten Ihre Steuererklärung {year} vor.",
      fresh: "Bitte füllen Sie Ihren Fragebogen aus und laden Sie Ihre Dokumente {year} hoch:",
      renewal: "Ihr Fragebogen übernimmt die Angaben des Vorjahres. Bitte korrigieren Sie, was sich geändert hat, und laden Sie Ihre Dokumente {year} hoch:",
      prepared: "Wir haben Ihren Fragebogen mit Ihren Angaben vorausgefüllt. Bitte prüfen und ergänzen Sie ihn und laden Sie Ihre Dokumente {year} hoch:",
    },
    reminder: { subject: "Erinnerung: Ihr Steuerfragebogen {year}", ask: "Konnten Sie Ihren Fragebogen {year} ausfüllen?", missing: "Konnten Sie Ihren Fragebogen {year} ausfüllen? Es fehlen uns noch:" },
    missingDocs: { subject: "Dokumente für Ihre Steuererklärung {year}", lead: "Vielen Dank für Ihren Fragebogen {year}. Es fehlen uns noch:", open: "Dokumente hinzufügen" },
    courtesy: "Ich hoffe, es geht Ihnen gut.",
    optout: "Keine solchen E-Mails mehr erhalten",
  },
};


export interface CampaignMailOptions {
  /** Recipient's first name (greeting). */
  firstName?: string;
  /** Invitation: carried over from this year's return (renewal) or prepared by Ark. */
  variant?: "fresh" | "renewal" | "prepared";
  /** Reminder: documents still missing (labels), at most a few. */
  missing?: string[];
}

export function campaignMail(kind: "notice" | "invitation" | "reminder" | "missing", language: Lang, to: string, taxYear: number, link: string | null, optoutLink: string, options: CampaignMailOptions = {}): MailMessage {
  const text = TEXT[language];
  const voice = VOICE[language];
  const fill = (s: string) => s.replace(/\{year\}/g, String(taxYear));
  const hello = voice.hello(options.firstName || "");
  const linkBlock: MailBlock[] = link ? [{ link, label: voice.open }] : [];
  let blocks: MailBlock[];
  if (kind === "notice") {
    blocks = [hello, text.courtesy, ...text.notice.body.map(fill), voice.available, voice.bye, voice.sign];
  } else if (kind === "invitation") {
    const variant = options.variant || "fresh";
    blocks = [hello, text.courtesy, fill(text.invitation.lead), fill(text.invitation[variant]), ...linkBlock, voice.codeNote, voice.available, voice.bye, voice.sign];
  } else if (kind === "missing") {
    const list = (options.missing || []).slice(0, 12);
    blocks = [hello, fill(text.missingDocs.lead), { list }, ...(link ? [{ link, label: text.missingDocs.open }] : []), voice.codeNote, voice.bye, voice.sign];
  } else {
    const missing = (options.missing || []).slice(0, 8);
    blocks = missing.length
      ? [hello, fill(text.reminder.missing), { list: missing }, ...linkBlock, voice.bye, voice.sign]
      : [hello, fill(text.reminder.ask), ...linkBlock, voice.bye, voice.sign];
  }
  const subject = kind === "notice" ? text.notice.subject : kind === "invitation" ? text.invitation.subject : kind === "missing" ? text.missingDocs.subject : text.reminder.subject;
  const cfg = mailConfig();
  return { from: cfg.from, to: [to], cc: [], replyTo: cfg.replyTo, subject: fill(subject), html: plainHtml(blocks, `<a href="${escapeHtml(optoutLink)}" style="color:#6b7280">${escapeHtml(text.optout)}</a>`) };
}

// ---- audience -----------------------------------------------------------------------------------

async function audience(deps: CampaignDeps, planned: ReturnRecord[], current: ReturnRecord[]): Promise<Member[]> {
  const members = new Map<string, Member>();
  for (const client of await deps.registry.listTaxClients()) {
    if (!client.email) continue;
    const key = computeClientKey(client.email, client.lastName, client.firstName);
    const prefs = await deps.prefs.get(key);
    if (prefs?.excluded) continue;
    members.set(key, { clientKey: key, email: client.email, name: personName(client.lastName, client.firstName), language: lang(prefs?.language), prefs });
  }
  for (const prefs of await deps.prefs.listOptedIn()) {
    if (prefs.excluded || !prefs.email || members.has(prefs.clientKey)) continue;
    members.set(prefs.clientKey, { clientKey: prefs.clientKey, email: prefs.email, name: prefs.name, language: lang(prefs.language), prefs });
  }
  // CRM and opted-in clients: an e-mail already here is the same person.
  const people = [...members.values()];
  // Planned rows: once staff validated them (status other than "À valider") and gave an e-mail.
  // Two planned rows may share an e-mail (one family member handles both returns): each is its
  // own client.
  for (const row of planned) {
    if (!row.email || row.excludedFromCampaign || row.state === "declined" || row.staffStatus === PLANNED_PENDING) continue;
    const key = row.clientKey || plannedKey(row);
    if (members.has(key) || people.some((m) => sameEmail(m.email, row.email))) continue;
    const prefs = await deps.prefs.get(key);
    if (prefs?.excluded) continue;
    members.set(key, { clientKey: key, email: row.email, name: row.name, language: lang(row.language || prefs?.language), prefs, planned: row });
  }
  // Returns created by the campaign for this year (e.g. from a planned row): their reminders go on
  // even when the client is neither in the CRM audience nor opted in.
  for (const row of current) {
    if (!row.email || !row.clientKey || members.has(row.clientKey) || people.some((m) => sameEmail(m.email, row.email))) continue;
    const prefs = await deps.prefs.get(row.clientKey);
    if (prefs?.excluded) continue;
    members.set(row.clientKey, { clientKey: row.clientKey, email: row.email, name: row.name, language: lang(row.language || prefs?.language), prefs });
  }
  return [...members.values()];
}

// ---- run ----------------------------------------------------------------------------------------

export type ReminderKind = "first" | "d30" | "d10";

/** Which reminder (if any) is due today for an invited, open return. */
export function dueReminder(record: ReturnRecord, stop: Date, now: Date): ReminderKind | null {
  if (!record.invitedAt) return null;
  const invited = new Date(record.invitedAt);
  const last = record.lastReminderAt ? new Date(record.lastReminderAt) : null;
  const sent = record.remindersSent || 0;
  // Never two campaign mails within three days (e.g. a late invitation right before D-30).
  if (daysBetween(last || invited, now) < 3) return null;
  const d30 = new Date(utcDay(stop) - 30 * DAY);
  const d10 = new Date(utcDay(stop) - 10 * DAY);
  if (utcDay(now) >= utcDay(d10) && (!last || utcDay(last) < utcDay(d10))) return "d10";
  if (utcDay(now) >= utcDay(d30) && (!last || utcDay(last) < utcDay(d30))) return "d30";
  if (sent === 0 && daysBetween(invited, now) >= 14) return "first";
  return null;
}

/** Staff statuses that end the missing-documents reminders. */
export const MISSING_STOP_STATUSES = ["Dossier complet", "Déposé", "Clos"];

/** Missing-documents reminder due: 7 days after submission, then every 14 days. */
export function dueMissingReminder(record: ReturnRecord, now: Date): boolean {
  if (!record.submittedAt) return false;
  const sent = record.missingRemindersSent || 0;
  if (sent === 0) return daysBetween(new Date(record.submittedAt), now) >= 7;
  return daysBetween(new Date(record.lastMissingReminderAt || record.submittedAt), now) >= 14;
}

export const isClosed = (record: ReturnRecord) =>
  record.state === "submitted" || record.state === "declined" || (!!record.staffStatus && STOP_STATUSES.includes(record.staffStatus));

/**
 * Invitation for one client and tax year (campaign from 1 February, or a manual invitation by
 * staff): creates the year's return pre-filled from the latest submitted one (unless retrying a
 * return whose e-mail failed), issues the link and sends the e-mail.
 */
export async function inviteMember(
  deps: CampaignDeps,
  member: Member,
  taxYear: number,
  opts: {
    now: Date;
    origin?: string;
    previous?: ReturnRecord;
    existing?: ReturnRecord;
    /** false: no e-mail, the link is returned for staff to hand over (still opened with a code). */
    send?: boolean;
    prefillAnswers?: Record<string, unknown>;
    notes?: string[];
    ttlMs?: number;
    /** Planned tracker row to turn into this return (no duplicate row). */
    planned?: ReturnRecord;
    /** Runs before the return is marked invited (e.g. staff hand-over file): a failure leaves it retryable. */
    beforeMark?: (record: ReturnRecord, link: string) => Promise<void>;
  },
): Promise<{ record: ReturnRecord; link: string }> {
  const record =
    opts.existing ||
    (await deps.createInvitedReturn({ clientKey: member.clientKey, email: member.email, name: member.name, language: member.language, taxYear, prefillFrom: opts.prefillAnswers ? undefined : opts.previous, prefillAnswers: opts.prefillAnswers, notes: opts.notes, planned: opts.planned }));
  const link = await deps.issueLink({ caseId: record.caseId, emailHash: record.emailHash, scope: "edit", purpose: "invitation", ttlMs: opts.ttlMs || INVITATION_TTL, origin: opts.origin, locale: member.language });
  if (opts.send !== false) {
    const optout = await deps.issueLink({ caseId: `client:${member.clientKey}`, emailHash: (deps.hashEmail || emailHashOf)(member.email), scope: "status", purpose: "optout", ttlMs: OPTOUT_TTL, origin: opts.origin, locale: member.language });
    const variant = opts.prefillAnswers ? "prepared" : opts.previous ? "renewal" : "fresh";
    await deps.sendMail(campaignMail("invitation", member.language, member.email, taxYear, link, optout, { firstName: firstNameOf(member.name), variant }));
  }
  if (opts.beforeMark) await opts.beforeMark(record, link);
  // invitedAt also when the link is handed over by staff: the campaign does not re-invite.
  const invited = { ...record, state: "invited" as const, invitedAt: iso(opts.now), remindersSent: 0 };
  await deps.tracker.upsert(invited);
  return { record: invited, link };
}

/** Latest submitted return before a tax year (the renewal source). */
export const previousReturn = (returns: ReturnRecord[], taxYear: number) =>
  returns.filter((r) => r.state === "submitted" && r.taxYear < taxYear).sort((x, y) => y.taxYear - x.taxYear)[0];

export async function runCampaign(deps: CampaignDeps, opts: { now: Date; dryRun?: boolean; maxActions?: number; origin?: string }): Promise<CampaignSummary> {
  const { now } = opts;
  const dryRun = !!opts.dryRun;
  const maxActions = opts.maxActions ?? 40;
  const year = now.getUTCFullYear();
  const taxYear = year - 1;
  const month = now.getUTCMonth(); // 0 = January
  const summary: CampaignSummary = { notices: 0, invitations: 0, reminders: 0, missingReminders: 0, escalations: 0, skipped: 0, dryRun };
  let actions = 0;
  const budget = () => actions < maxActions;
  const escalate: string[] = [];
  const escalateInternal = new Set<string>();

  const optoutLink = (member: Member) =>
    deps.issueLink({ caseId: `client:${member.clientKey}`, emailHash: (deps.hashEmail || emailHashOf)(member.email), scope: "status", purpose: "optout", ttlMs: OPTOUT_TTL, origin: opts.origin, locale: member.language });

  const yearRows = await deps.tracker.listByYear(taxYear);
  const plannedRows = yearRows.filter((r) => isPlanned(r) && r.state !== "declined");
  const campaignRows = yearRows.filter((r) => !isPlanned(r) && r.source === "campaign" && !isClosed(r));
  const usedPlanned = new Set<string>();
  for (const member of await audience(deps, plannedRows, campaignRows)) {
    const all = await deps.tracker.findByClientKey(member.clientKey);
    const returns = all.filter((r) => !isPlanned(r));
    let planned = member.planned || plannedFor(plannedRows, member);
    // One planned row serves one client only (a second match is left to staff).
    if (planned?.trackerId && usedPlanned.has(planned.trackerId)) planned = undefined;
    if (planned?.trackerId) usedPlanned.add(planned.trackerId);
    // Staff exclusion, or an inventory row staff has not validated yet: nothing is sent.
    if (planned && (planned.excludedFromCampaign || planned.staffStatus === PLANNED_PENDING) && !returns.some((r) => r.taxYear === taxYear)) {
      summary.skipped++;
      continue;
    }
    const current = returns.find((r) => r.taxYear === taxYear);
    // Staff exclusion on any of the client's tracker rows ("Exclure de la campagne").
    if (returns.some((r) => r.excludedFromCampaign)) {
      summary.skipped++;
      continue;
    }
    const previous = previousReturn(returns, taxYear);

    // Advance notice (January, first year only: never used the questionnaire).
    if (month === 0 && now.getUTCDate() >= 5) {
      if (returns.length === 0 && member.prefs?.noticeSentYear !== year) {
        if (!budget()) {
          summary.skipped++;
          continue;
        }
        actions++;
        summary.notices++;
        if (!dryRun) {
          await deps.sendMail(campaignMail("notice", member.language, member.email, taxYear, null, await optoutLink(member), { firstName: firstNameOf(member.name) }));
          await deps.prefs.upsert({
            clientKey: member.clientKey,
            email: member.email,
            name: member.name,
            language: member.language,
            optIn: member.prefs?.optIn ?? false,
            excluded: false,
            noticeSentYear: year,
          });
        }
      }
      continue;
    }
    if (month === 0) continue; // before 1 February: nothing else

    // Invitation (from 1 February); also retried when a created return's invitation mail failed.
    const pendingInvitation = current && current.state === "invited" && !current.invitedAt;
    if (!current || pendingInvitation) {
      const stop = campaignStopDate({ canton: previous?.canton || "", regime: previous?.regime }, taxYear);
      if (utcDay(now) > utcDay(stop)) continue;
      if (!budget()) {
        summary.skipped++;
        continue;
      }
      actions++;
      summary.invitations++;
      if (!dryRun) await inviteMember(deps, member, taxYear, { now, origin: opts.origin, previous, existing: pendingInvitation && current ? current : undefined, planned });
      continue;
    }

    // Reminders for an open, campaign-invited return.
    if (isClosed(current)) continue;
    const stop = campaignStopDate({ canton: current.canton, regime: current.regime }, taxYear, current.extendedTo);
    if (utcDay(now) > utcDay(stop)) continue;
    const daysLeft = daysBetween(now, stop);
    const due = dueReminder(current, stop, now);
    if (due) {
      if (!budget()) {
        summary.skipped++;
      } else {
        actions++;
        summary.reminders++;
        if (!dryRun) {
          const link = await deps.issueLink({ caseId: current.caseId, emailHash: current.emailHash, scope: "edit", purpose: "invitation", ttlMs: INVITATION_TTL, origin: opts.origin, locale: member.language });
          const reminderLang = lang(current.language || member.language);
          const missing = deps.missingDocuments ? await deps.missingDocuments(current, reminderLang).catch(() => []) : [];
          await deps.sendMail(campaignMail("reminder", reminderLang, current.email || member.email, taxYear, link, await optoutLink(member), { firstName: firstNameOf(current.name || member.name), missing }));
          await deps.tracker.upsert({ ...current, remindersSent: (current.remindersSent || 0) + 1, lastReminderAt: iso(now) });
        }
      }
    }
    const unanswered = (current.remindersSent || 0) + (due && !dryRun ? 1 : 0);
    const before = escalate.length;
    if (daysLeft === 30 || daysLeft === 10) escalate.push(`${current.name} – ${taxYear} – J-${daysLeft} (${current.state})`);
    else if (unanswered >= 2 && due) escalate.push(`${current.name} – ${taxYear} – ${unanswered} rappels sans réponse`);
    if (escalate.length > before && isInternalCase({ email: current.email || member.email, name: current.name })) escalate.slice(before).forEach((line) => escalateInternal.add(line));
  }

  // Submitted returns with documents still missing: a short reminder 7 days after submission,
  // then every 14 days, until complete, a staff stop status, the deadline or an opt-out.
  for (const original of yearRows.filter((r) => !isPlanned(r) && r.state === "submitted")) {
    // Filed or closed by staff: nothing more (no recount, no reminder).
    if (original.staffStatus === "Déposé" || original.staffStatus === "Clos") continue;
    const stop = campaignStopDate({ canton: original.canton, regime: original.regime }, taxYear, original.extendedTo);
    if (utcDay(now) > utcDay(stop)) continue;
    // Daily recount (files, statuses, staff items) on real runs; the tracker and status follow.
    let missing = (original.missingDocs || "").split("\n").filter(Boolean);
    let record = original;
    if (!dryRun && deps.refreshMissing) {
      const fresh = await deps.refreshMissing(original).catch(() => null);
      if (fresh) missing = fresh;
      const reread = (await deps.tracker.findByCase(original.caseId)).find((r) => r.trackerId === original.trackerId);
      if (reread) record = reread;
    }
    if (record.staffStatus && MISSING_STOP_STATUSES.includes(record.staffStatus)) continue;
    const prefs = record.clientKey ? await deps.prefs.get(record.clientKey) : null;
    if (prefs?.excluded || record.excludedFromCampaign) continue;
    const due = dueMissingReminder(record, now);
    const daysLeft = daysBetween(now, stop);
    if (!due && daysLeft !== 30 && daysLeft !== 10) continue;
    if (!missing.length) continue;
    let sent = record.missingRemindersSent || 0;
    if (due) {
      if (!budget()) summary.skipped++;
      else {
        actions++;
        summary.missingReminders++;
        if (!dryRun) {
          const language = lang(record.language);
          const link = await deps.issueLink({ caseId: record.caseId, emailHash: record.emailHash, scope: "status", purpose: "status", ttlMs: 30 * DAY, origin: opts.origin, locale: language });
          const optout = await deps.issueLink({ caseId: `client:${record.clientKey}`, emailHash: (deps.hashEmail || emailHashOf)(record.email), scope: "status", purpose: "optout", ttlMs: OPTOUT_TTL, origin: opts.origin, locale: language });
          await deps.sendMail(campaignMail("missing", language, record.email, taxYear, link, optout, { firstName: firstNameOf(record.name), missing }));
          sent += 1;
          if (record.trackerId) await deps.tracker.markMissingReminder(record.trackerId, sent, iso(now));
        }
      }
    }
    const before = escalate.length;
    if (daysLeft === 30 || daysLeft === 10) escalate.push(`${record.name} – ${taxYear} – J-${daysLeft} – ${missing.length} document(s) manquant(s)`);
    else if (due && sent >= 2) escalate.push(`${record.name} – ${taxYear} – ${missing.length} document(s) manquant(s), ${sent} rappels sans réponse`);
    if (escalate.length > before && isInternalCase({ email: record.email, name: record.name })) escalate.slice(before).forEach((line) => escalateInternal.add(line));
  }

  // One staff digest per run (and per day when a ledger is available).
  if (escalate.length && deps.staffRecipients.length) {
    const key = `escalation:${new Date(utcDay(now)).toISOString().slice(0, 10)}`;
    const already = deps.ledger ? await deps.ledger.has(key) : false;
    if (!already) {
      summary.escalations = escalate.length;
      if (!dryRun) {
        const cfg = mailConfig();
        const digest = (to: string[], lines: string[]) =>
          deps.sendMail({
            from: cfg.from,
            to,
            cc: [],
            subject: `Questionnaires fiscaux ${taxYear} – suivi des relances (${lines.length})`,
            html: `<!doctype html><html><body style="font-family:Arial,Helvetica,sans-serif;font-size:14px"><p>Questionnaires à suivre :</p><ul>${lines.map((line) => `<li>${escapeHtml(line)}</li>`).join("")}</ul><p>Détail dans la liste « Suivi questionnaires ».</p></body></html>`,
          });
        // Owner rule: real clients to the staff list; test / demo cases to the main recipient only.
        const real = escalate.filter((line) => !escalateInternal.has(line));
        const internal = escalate.filter((line) => escalateInternal.has(line));
        if (real.length) await digest(deps.staffRecipients, real);
        if (internal.length) await digest(cfg.to, internal);
        await deps.ledger?.add(key);
      }
    }
  }
  return summary;
}
