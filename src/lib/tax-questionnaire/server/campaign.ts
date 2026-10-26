/**
 * Annual campaign (DECISIONS §E 19): advance notice in January for clients who never used the
 * questionnaire, invitation from 1 February for the previous tax year (pre-filled when a
 * previous return exists), reminder 14 days later, then at D-30 and D-10 before the deadline,
 * and one staff digest per run. Every decision is derived from tracker / preference fields, so
 * re-running the same day sends nothing twice. Called by the daily cron route.
 */
import { createHash } from "node:crypto";
import { campaignStopDate } from "../deadlines";
import type { IssueLinkOptions } from "./access";
import { escapeHtml, mailConfig } from "./email";
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
  /** Optional cleanup of abandoned drafts (cron task "cleanup"); implemented by the app. */
  cleanupAbandonedDrafts?: () => Promise<{ deleted: number }>;
}

export interface CampaignSummary {
  notices: number;
  invitations: number;
  reminders: number;
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
const lang = (value: string | undefined): Lang => (value === "en" || value === "de" ? value : "fr");

/** Fallback fingerprint (tests); production passes the keyed access.emailHash via deps.hashEmail. */
export const emailHashOf = (email: string) =>
  createHash("sha256").update(`ark-tax-qf-email|${email.trim().toLowerCase()}`).digest("hex").slice(0, 32);

const utcDay = (d: Date) => Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
const daysBetween = (from: Date, to: Date) => Math.round((utcDay(to) - utcDay(from)) / DAY);
const iso = (d: Date) => d.toISOString();

interface Member {
  clientKey: string;
  email: string;
  name: string;
  language: Lang;
  prefs: ClientPreferences | null;
}

// ---- mails --------------------------------------------------------------------------------------

const TEXT: Record<Lang, Record<"notice" | "invitation" | "reminder", { subject: string; body: string }> & { cta: string; optout: string; sign: string }> = {
  fr: {
    notice: {
      subject: "Votre déclaration d'impôt {year} : un questionnaire en ligne",
      body: "Bonjour,\n\nDès le 1er février, nous vous enverrons un lien vers notre questionnaire fiscal en ligne pour préparer votre déclaration {year}. Si vous ne souhaitez pas le recevoir, cliquez sur le lien de désinscription ci-dessous.",
    },
    invitation: {
      subject: "Votre questionnaire fiscal {year}",
      body: "Bonjour,\n\nVotre questionnaire fiscal {year} est prêt. Il ne prend que quelques minutes, et vous pouvez y déposer vos documents.",
    },
    reminder: {
      subject: "Rappel : votre questionnaire fiscal {year}",
      body: "Bonjour,\n\nPetit rappel : votre questionnaire fiscal {year} n'est pas encore envoyé. Vous pouvez le reprendre où vous l'avez laissé.",
    },
    cta: "Ouvrir mon questionnaire",
    optout: "Ne plus recevoir ces messages",
    sign: "Ark Fiduciaire SA · +41 22 512 50 50 · info@ark-fid.ch",
  },
  en: {
    notice: {
      subject: "Your {year} tax return: an online questionnaire",
      body: "Hello,\n\nFrom 1 February we will send you a link to our online tax questionnaire to prepare your {year} return. If you would rather not receive it, use the unsubscribe link below.",
    },
    invitation: {
      subject: "Your {year} tax questionnaire",
      body: "Hello,\n\nYour {year} tax questionnaire is ready. It only takes a few minutes, and you can upload your documents there.",
    },
    reminder: {
      subject: "Reminder: your {year} tax questionnaire",
      body: "Hello,\n\nA quick reminder: your {year} tax questionnaire has not been sent yet. You can continue where you left off.",
    },
    cta: "Open my questionnaire",
    optout: "Stop receiving these messages",
    sign: "Ark Fiduciaire SA · +41 22 512 50 50 · info@ark-fid.ch",
  },
  de: {
    notice: {
      subject: "Ihre Steuererklärung {year}: ein Online-Fragebogen",
      body: "Guten Tag\n\nAb dem 1. Februar senden wir Ihnen einen Link zu unserem Online-Steuerfragebogen für Ihre Steuererklärung {year}. Wenn Sie ihn nicht erhalten möchten, nutzen Sie den Abmeldelink unten.",
    },
    invitation: {
      subject: "Ihr Steuerfragebogen {year}",
      body: "Guten Tag\n\nIhr Steuerfragebogen {year} ist bereit. Er dauert nur wenige Minuten, und Sie können dort Ihre Dokumente hochladen.",
    },
    reminder: {
      subject: "Erinnerung: Ihr Steuerfragebogen {year}",
      body: "Guten Tag\n\nEine kurze Erinnerung: Ihr Steuerfragebogen {year} wurde noch nicht gesendet. Sie können dort weitermachen, wo Sie aufgehört haben.",
    },
    cta: "Meinen Fragebogen öffnen",
    optout: "Keine solchen Nachrichten mehr erhalten",
    sign: "Ark Fiduciaire SA · +41 22 512 50 50 · info@ark-fid.ch",
  },
};

export function campaignMail(kind: "notice" | "invitation" | "reminder", language: Lang, to: string, taxYear: number, link: string | null, optoutLink: string): MailMessage {
  const text = TEXT[language];
  const fill = (s: string) => s.replace(/\{year\}/g, String(taxYear));
  const paragraphs = fill(text[kind].body)
    .split("\n\n")
    .map((p) => `<p>${escapeHtml(p)}</p>`)
    .join("");
  const cta = link ? `<p><a href="${escapeHtml(link)}" style="display:inline-block;padding:10px 16px;background:#1f2a44;color:#fff;border-radius:6px;text-decoration:none">${escapeHtml(text.cta)}</a></p>` : "";
  const html = `<!doctype html><html><body style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.5;color:#1f2937;max-width:640px">${paragraphs}${cta}<p>${escapeHtml(text.sign)}</p><p style="font-size:12px;color:#6b7280"><a href="${escapeHtml(optoutLink)}">${escapeHtml(text.optout)}</a></p></body></html>`;
  const cfg = mailConfig();
  return { from: cfg.from, to: [to], cc: [], replyTo: cfg.replyTo, subject: fill(text[kind].subject), html };
}

// ---- audience -----------------------------------------------------------------------------------

async function audience(deps: CampaignDeps): Promise<Member[]> {
  const members = new Map<string, Member>();
  for (const client of await deps.registry.listTaxClients()) {
    if (!client.email) continue;
    const key = computeClientKey(client.email, client.lastName, client.firstName);
    const prefs = await deps.prefs.get(key);
    if (prefs?.excluded) continue;
    members.set(key, { clientKey: key, email: client.email, name: `${client.lastName.toUpperCase()} ${client.firstName}`.trim(), language: lang(prefs?.language), prefs });
  }
  for (const prefs of await deps.prefs.listOptedIn()) {
    if (prefs.excluded || !prefs.email || members.has(prefs.clientKey)) continue;
    members.set(prefs.clientKey, { clientKey: prefs.clientKey, email: prefs.email, name: prefs.name, language: lang(prefs.language), prefs });
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

export const isClosed = (record: ReturnRecord) =>
  record.state === "submitted" || record.state === "declined" || (!!record.staffStatus && STOP_STATUSES.includes(record.staffStatus));

export async function runCampaign(deps: CampaignDeps, opts: { now: Date; dryRun?: boolean; maxActions?: number; origin?: string }): Promise<CampaignSummary> {
  const { now } = opts;
  const dryRun = !!opts.dryRun;
  const maxActions = opts.maxActions ?? 40;
  const year = now.getUTCFullYear();
  const taxYear = year - 1;
  const month = now.getUTCMonth(); // 0 = January
  const summary: CampaignSummary = { notices: 0, invitations: 0, reminders: 0, escalations: 0, skipped: 0, dryRun };
  let actions = 0;
  const budget = () => actions < maxActions;
  const escalate: string[] = [];

  const optoutLink = (member: Member) =>
    deps.issueLink({ caseId: `client:${member.clientKey}`, emailHash: (deps.hashEmail || emailHashOf)(member.email), scope: "status", purpose: "optout", ttlMs: OPTOUT_TTL, origin: opts.origin, locale: member.language });

  for (const member of await audience(deps)) {
    const returns = await deps.tracker.findByClientKey(member.clientKey);
    const current = returns.find((r) => r.taxYear === taxYear);
    const previous = returns
      .filter((r) => r.state === "submitted" && r.taxYear < taxYear)
      .sort((x, y) => y.taxYear - x.taxYear)[0];

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
          await deps.sendMail(campaignMail("notice", member.language, member.email, taxYear, null, await optoutLink(member)));
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

    // Invitation (from 1 February).
    if (!current) {
      const stop = campaignStopDate({ canton: previous?.canton || "", regime: previous?.regime }, taxYear);
      if (utcDay(now) > utcDay(stop)) continue;
      if (!budget()) {
        summary.skipped++;
        continue;
      }
      actions++;
      summary.invitations++;
      if (!dryRun) {
        const record = await deps.createInvitedReturn({ clientKey: member.clientKey, email: member.email, name: member.name, language: member.language, taxYear, prefillFrom: previous });
        const link = await deps.issueLink({ caseId: record.caseId, emailHash: record.emailHash, scope: "edit", purpose: "invitation", ttlMs: INVITATION_TTL, origin: opts.origin, locale: member.language });
        await deps.sendMail(campaignMail("invitation", member.language, member.email, taxYear, link, await optoutLink(member)));
        await deps.tracker.upsert({ ...record, state: "invited", invitedAt: iso(now), remindersSent: 0 });
      }
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
          await deps.sendMail(campaignMail("reminder", lang(current.language || member.language), current.email || member.email, taxYear, link, await optoutLink(member)));
          await deps.tracker.upsert({ ...current, remindersSent: (current.remindersSent || 0) + 1, lastReminderAt: iso(now) });
        }
      }
    }
    const unanswered = (current.remindersSent || 0) + (due && !dryRun ? 1 : 0);
    if (daysLeft === 30 || daysLeft === 10) escalate.push(`${current.name} – ${taxYear} – J-${daysLeft} (${current.state})`);
    else if (unanswered >= 2 && due) escalate.push(`${current.name} – ${taxYear} – ${unanswered} rappels sans réponse`);
  }

  // One staff digest per run (and per day when a ledger is available).
  if (escalate.length && deps.staffRecipients.length) {
    const key = `escalation:${new Date(utcDay(now)).toISOString().slice(0, 10)}`;
    const already = deps.ledger ? await deps.ledger.has(key) : false;
    if (!already) {
      summary.escalations = escalate.length;
      if (!dryRun) {
        const cfg = mailConfig();
        await deps.sendMail({
          from: cfg.from,
          to: deps.staffRecipients,
          cc: [],
          subject: `Questionnaires fiscaux ${taxYear} – suivi des relances (${escalate.length})`,
          html: `<!doctype html><html><body style="font-family:Arial,Helvetica,sans-serif;font-size:14px"><p>Questionnaires à suivre :</p><ul>${escalate.map((line) => `<li>${escapeHtml(line)}</li>`).join("")}</ul><p>Détail dans la liste « Suivi questionnaires ».</p></body></html>`,
        });
        await deps.ledger?.add(key);
      }
    }
  }
  return summary;
}
