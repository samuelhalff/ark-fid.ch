import { attentionPoints } from "../attention";
import { DOC_CATEGORIES, selectedYears, taxYearOf } from "../documents";
import { nowSwiss } from "../format";
import { displayValue, getField } from "../logic";
import { CONTACT } from "../ui";
import type { QfLocale } from "../types";
import { regimeSummary, STATUS_FR, type SubmissionRecord } from "./excel";
import type { MailMessage } from "./storage";

const env = (name: string) => (process.env[name] || "").trim();
/** Comma-separated list; "none" means an empty list (tests: no cc). */
const list = (value: string, fallback: string[]) => (value === "none" ? [] : value ? value.split(",").map((v) => v.trim()).filter(Boolean) : fallback);

/** Recipients (owner decision); overridable by env for tests. */
export const mailConfig = () => ({
  from: env("TAX_QF_MAIL_SENDER") || "info@ark-fid.ch",
  to: list(env("TAX_QF_MAIL_TO"), ["samuel.halff@ark-fid.ch"]),
  cc: list(env("TAX_QF_MAIL_CC"), ["sebastien.gallie@ark-fid.ch", "lassana.dioum@pbm.law"]),
  // Client mails are signed by Samuel: replies go to him.
  replyTo: env("TAX_QF_MAIL_REPLY_TO") || "samuel.halff@ark-fid.ch",
});

// ---- client mails: plain, short, in Samuel's voice (owner rule, see the e-mail style guide) ----------

/** One paragraph, a link on its own line, or a hyphen list. */
export type MailBlock = string | { link: string; label: string } | { list: string[] };

const FONT = "Aptos, Calibri, 'Segoe UI', Helvetica, Arial, sans-serif";

/** Plain HTML like a typed e-mail: no banner, no button, one idea per paragraph. */
export function plainHtml(blocks: MailBlock[], footer = ""): string {
  const p = (inner: string) => `<p style="margin:0 0 14px 0">${inner}</p>`;
  const body = blocks
    .map((b) => {
      if (typeof b === "string") return p(escapeHtml(b).replace(/\n/g, "<br>"));
      if ("link" in b) return p(`<a href="${escapeHtml(b.link)}" style="color:#0f5bd8">${escapeHtml(b.label)}</a>`);
      return `<ul style="margin:0 0 14px 0;padding-left:20px">${b.list.map((i) => `<li>${escapeHtml(i)}</li>`).join("")}</ul>`;
    })
    .join("");
  const foot = footer ? `<p style="margin:24px 0 0 0;font-size:12px;color:#6b7280">${footer}</p>` : "";
  return `<!doctype html><html><body style="font-family:${FONT};font-size:15px;line-height:1.45;color:#1f1f1f;max-width:620px">${body}${foot}</body></html>`;
}

type ClientLocale = "fr" | "en" | "de";
/** Greeting, availability line, closing and signature. */
export const VOICE: Record<ClientLocale, { hello: (first: string) => string; available: string; bye: string; sign: string; open: string; codeNote: string }> = {
  fr: { hello: (n) => (n ? `Bonjour ${n},` : "Bonjour,"), available: "A votre disposition pour toute question.", bye: "Bien à vous,", sign: "Samuel Halff\nArk Fiduciaire SA", open: "Ouvrir le questionnaire", codeNote: "Un code vous sera envoyé par email pour l'ouvrir." },
  en: { hello: (n) => (n ? `Dear ${n},` : "Hello,"), available: "Let me know if you have any questions.", bye: "Kind regards,", sign: "Samuel Halff\nArk Fiduciaire SA", open: "Open the questionnaire", codeNote: "A code will be sent to you by email to open it." },
  de: { hello: (n) => (n ? `Guten Tag ${n}` : "Guten Tag"), available: "Bei Fragen stehe ich gerne zur Verfügung.", bye: "Freundliche Grüsse", sign: "Samuel Halff\nArk Fiduciaire SA", open: "Fragebogen öffnen", codeNote: "Zum Öffnen erhalten Sie einen Code per E-Mail." },
};

/** First name from the CRM convention "NOM COMPOSÉ Prénom" (words not in capitals). */
export function firstNameOf(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const first = words.filter((w) => w !== w.toUpperCase());
  return first.join(" ");
}

/**
 * Internal test or demo case (owner rule): submitter on an Ark or PBM address, or a client / case
 * name starting with TEST or DÉMO/DEMO. Those notify the main recipient only, never the cc list.
 */
export function isInternalCase(input: { email?: string; name?: string; folderName?: string }): boolean {
  if (/@(ark-fid\.ch|pbm\.law)$/i.test((input.email || "").trim())) return true;
  const fold = (s?: string) => (s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toUpperCase();
  return [input.name, input.folderName].some((v) => /^(TEST|DEMO)\b/.test(fold(v)));
}

/** Staff recipients for a case: everyone for a real client, the main recipient only for tests. */
export function staffRecipients(internal: boolean): { to: string[]; cc: string[] } {
  const cfg = mailConfig();
  return { to: cfg.to, cc: internal ? [] : cfg.cc };
}

export const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string);

const str = (v: unknown) => (typeof v === "string" ? v : "");
const wrap = (body: string) =>
  `<!doctype html><html><body style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.5;color:#1f2937;max-width:680px">${body}</body></html>`;
const table = (rows: [string, string][]) =>
  `<table cellpadding="6" style="border-collapse:collapse">${rows
    .filter(([, v]) => v)
    .map(([k, v]) => `<tr><td style="color:#6b7280;vertical-align:top;white-space:nowrap">${escapeHtml(k)}</td><td>${escapeHtml(v)}</td></tr>`)
    .join("")}</table>`;

export function internalMail(record: SubmissionRecord, excelName: string, excel: Uint8Array | null, notes: string[] = []): MailMessage {
  const a = record.answers;
  const cfg = mailConfig();
  const name = `${str(a["start.lastName"]).toUpperCase()} ${str(a["start.firstName"])}`.trim();
  const year = String(taxYearOf(a));
  const canton = displayValue(getField("start.canton")!, a["start.canton"], "fr", a);
  const counts = (status: string) => record.docs.filter((d) => d.status === status).length;
  const folderLink = record.folderUrl.startsWith("https://")
    ? `<p><a href="${escapeHtml(record.folderUrl)}">Ouvrir le dossier SharePoint</a> (${escapeHtml(record.folderName)})</p>`
    : `<p>Dossier : ${escapeHtml(record.folderName)}</p>`;
  const pending = record.docs.filter((d) => d.status === "later" || d.status === "missing");
  const html = wrap(
    `<p>Nouveau questionnaire fiscal reçu.</p>${table([
      ["Client", name],
      ["E-mail", str(a["start.email"])],
      ["Téléphone", str(a["start.phone"])],
      ["Type", a["start.clientType"] === "existing" ? "Client existant" : "Nouveau client"],
      ["Année(s) fiscale(s)", selectedYears(a).join(", ")],
      ["Régime", regimeSummary(a)],
      ["Canton / commune", [canton, str(a["start.commune"])].filter(Boolean).join(" / ")],
      ["Langue", record.locale.toUpperCase()],
      ["Reçu le", nowSwiss(record.submittedAt)],
      ["Référence", record.sid],
      ["Documents", `${counts("uploaded")} reçus · ${counts("later")} plus tard · ${counts("missing")} non reçus · ${counts("na")} n.a. · ${record.extras.length} complémentaires`],
    ])}${folderLink}${
      record.flagged.length
        ? `<p style="color:#b91c1c"><strong>${record.flagged.length} fichier(s) à vérifier</strong> (contenu ne correspondant pas au type annoncé), déplacé(s) dans le sous-dossier « _A verifier ».</p>`
        : ""
    }${(() => {
      const points = attentionPoints(a);
      return points.length ? `<p><strong>Points d'attention</strong></p><ul>${points.map((p) => `<li>${p.level === "high" ? "<strong>" : ""}${escapeHtml(p.text)}${p.level === "high" ? "</strong>" : ""}</li>`).join("")}</ul>` : "";
    })()}${notes.map((n) => `<p style="color:#b45309">${escapeHtml(n)}</p>`).join("")}${
      pending.length
        ? `<p><strong>À demander (${pending.length})</strong></p><ul>${pending.map((d) => `<li>${escapeHtml(d.item.label.fr)} – ${escapeHtml(STATUS_FR[d.status])}</li>`).join("")}</ul>`
        : ""
    }<p>Le détail complet (réponses, liste des fichiers par document) est dans le fichier Excel joint${excel ? "" : " (non joint : trop volumineux, voir le dossier)"}.</p>`,
  );
  const recipients = staffRecipients(isInternalCase({ email: str(a["start.email"]), name, folderName: record.folderName }));
  return {
    from: cfg.from,
    to: recipients.to,
    cc: recipients.cc,
    replyTo: str(a["start.email"]) || undefined,
    subject: `Questionnaire fiscal ${year} – ${name} (${str(a["start.canton"])}) – ${record.sid}`,
    html,
    attachments: excel
      ? [{ name: excelName, contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", bytes: excel }]
      : [],
  };
}

const CLIENT_TEXT: Record<QfLocale, { subject: string; thanks: string; received: string; pending: string; howTo: string; next: string }> = {
  fr: {
    subject: "Votre questionnaire fiscal {year}",
    thanks: "Merci, nous avons bien reçu votre questionnaire {year}.",
    received: "Documents reçus :",
    pending: "Il nous manque encore :",
    howTo: "Vous pouvez nous les envoyer en répondant à cet email, ou les ajouter dans votre questionnaire.",
    next: "Nous revenons vers vous après examen de votre dossier.",
  },
  en: {
    subject: "Your {year} tax questionnaire",
    thanks: "Thank you, we have received your {year} questionnaire.",
    received: "Documents received:",
    pending: "We are still missing:",
    howTo: "You can send them by replying to this email, or add them in your questionnaire.",
    next: "We will revert once we have reviewed your file.",
  },
  de: {
    subject: "Ihr Steuerfragebogen {year}",
    thanks: "Vielen Dank, wir haben Ihren Fragebogen {year} erhalten.",
    received: "Erhaltene Dokumente:",
    pending: "Es fehlen uns noch:",
    howTo: "Sie können sie uns als Antwort auf diese E-Mail senden oder in Ihrem Fragebogen hochladen.",
    next: "Wir melden uns nach der Prüfung Ihrer Unterlagen.",
  },
};

/** Confirmation to the client: no Excel, no documents, no file names; checklist labels only. */
export function clientMail(record: SubmissionRecord): MailMessage {
  const a = record.answers;
  const cfg = mailConfig();
  const text = CLIENT_TEXT[record.locale];
  const voice = VOICE[record.locale];
  const year = String(taxYearOf(a));
  const fill = (s: string, values: Record<string, string>) => s.replace(/\{(\w+)\}/g, (_m, k: string) => values[k] ?? "");
  const received = record.docs.filter((d) => d.status === "uploaded");
  const pending = record.docs.filter((d) => d.status === "later" || d.status === "missing");
  const extraLine = record.extras.length ? [DOC_CATEGORIES.extra.label[record.locale]] : [];
  const receivedList = [...received.map((d) => d.item.label[record.locale]), ...extraLine];
  const blocks: MailBlock[] = [voice.hello(str(a["start.firstName"])), fill(text.thanks, { year })];
  if (receivedList.length) blocks.push(text.received, { list: receivedList });
  if (pending.length) blocks.push(text.pending, { list: pending.map((d) => d.item.label[record.locale]) }, text.howTo);
  blocks.push(text.next, voice.available, voice.bye, voice.sign);
  return {
    from: cfg.from,
    to: [str(a["start.email"])],
    cc: [],
    replyTo: cfg.replyTo,
    subject: fill(text.subject, { year }),
    html: plainHtml(blocks),
  };
}
