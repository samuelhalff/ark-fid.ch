import { attentionPoints } from "../attention";
import { DOC_CATEGORIES, selectedYears, taxYearOf } from "../documents";
import { nowSwiss } from "../format";
import { displayValue, getField } from "../logic";
import { CONTACT } from "../ui";
import type { QfLocale } from "../types";
import { regimeSummary, STATUS_FR, type SubmissionRecord } from "./excel";
import type { MailMessage } from "./storage";

const env = (name: string) => (process.env[name] || "").trim();
const list = (value: string, fallback: string[]) => (value ? value.split(",").map((v) => v.trim()).filter(Boolean) : fallback);

/** Recipients (owner decision); overridable by env for tests. */
export const mailConfig = () => ({
  from: env("TAX_QF_MAIL_SENDER") || "info@ark-fid.ch",
  to: list(env("TAX_QF_MAIL_TO"), ["samuel.halff@ark-fid.ch"]),
  cc: list(env("TAX_QF_MAIL_CC"), ["sebastien.gallie@ark-fid.ch", "lassana.dioum@pbm.law"]),
  replyTo: env("TAX_QF_MAIL_REPLY_TO") || CONTACT.email,
});

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
  return {
    from: cfg.from,
    to: cfg.to,
    cc: cfg.cc,
    replyTo: str(a["start.email"]) || undefined,
    subject: `Questionnaire fiscal ${year} – ${name} (${str(a["start.canton"])}) – ${record.sid}`,
    html,
    attachments: excel
      ? [{ name: excelName, contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", bytes: excel }]
      : [],
  };
}

const CLIENT_TEXT: Record<QfLocale, { subject: string; hello: string; thanks: string; received: string; files: string; pending: string; noPending: string; howTo: string; contact: string; sign: string }> = {
  fr: {
    subject: "Votre questionnaire fiscal {year} – Ark Fiduciaire",
    hello: "Bonjour {name},",
    thanks: "Merci, nous avons bien reçu votre questionnaire fiscal {year}. Nous reviendrons vers vous rapidement.",
    received: "Documents reçus",
    files: "{n} fichier(s)",
    pending: "Documents encore attendus",
    noPending: "Nous n'attendons pas d'autre document pour le moment.",
    howTo: "Vous pouvez nous transmettre les documents manquants en répondant à cet e-mail. Votre dossier peut nécessiter d'autres pièces : nous vous le dirons après examen.",
    contact: "Une question ? Contactez-nous :",
    sign: "Ark Fiduciaire SA",
  },
  en: {
    subject: "Your {year} tax questionnaire – Ark Fiduciaire",
    hello: "Dear {name},",
    thanks: "Thank you, we have received your {year} tax questionnaire. We will get back to you shortly.",
    received: "Documents received",
    files: "{n} file(s)",
    pending: "Documents still expected",
    noPending: "We are not expecting any other document for now.",
    howTo: "You can send us the missing documents by replying to this email. Your file may require other documents: we will let you know after our review.",
    contact: "Any questions? Contact us:",
    sign: "Ark Fiduciaire SA",
  },
  de: {
    subject: "Ihr Steuerfragebogen {year} – Ark Fiduciaire",
    hello: "Guten Tag {name}",
    thanks: "Vielen Dank, wir haben Ihren Steuerfragebogen {year} erhalten. Wir melden uns in Kürze bei Ihnen.",
    received: "Erhaltene Dokumente",
    files: "{n} Datei(en)",
    pending: "Noch ausstehende Dokumente",
    noPending: "Wir erwarten derzeit keine weiteren Dokumente.",
    howTo: "Sie können uns die fehlenden Dokumente als Antwort auf diese E-Mail zusenden. Eventuell benötigen wir weitere Unterlagen: Wir melden uns nach unserer Prüfung.",
    contact: "Fragen? Kontaktieren Sie uns:",
    sign: "Ark Fiduciaire SA",
  },
};

/** Confirmation to the client: no Excel, no documents, no file names; checklist labels only. */
export function clientMail(record: SubmissionRecord): MailMessage {
  const a = record.answers;
  const cfg = mailConfig();
  const text = CLIENT_TEXT[record.locale];
  const year = String(taxYearOf(a));
  const fill = (s: string, values: Record<string, string>) => s.replace(/\{(\w+)\}/g, (_m, k: string) => values[k] ?? "");
  const received = record.docs.filter((d) => d.status === "uploaded");
  const pending = record.docs.filter((d) => d.status === "later" || d.status === "missing");
  const li = (items: string[]) => `<ul>${items.map((i) => `<li>${escapeHtml(i)}</li>`).join("")}</ul>`;
  const extraLine = record.extras.length ? [`${DOC_CATEGORIES.extra.label[record.locale]} (${fill(text.files, { n: String(record.extras.length) })})`] : [];
  const html = wrap(
    `<p>${escapeHtml(fill(text.hello, { name: str(a["start.firstName"]) }))}</p><p>${escapeHtml(fill(text.thanks, { year }))}</p>` +
      (received.length || extraLine.length
        ? `<p><strong>${escapeHtml(text.received)}</strong></p>${li([
            ...received.map((d) => `${d.item.label[record.locale]} (${fill(text.files, { n: String(d.files.length) })})`),
            ...extraLine,
          ])}`
        : "") +
      (pending.length ? `<p><strong>${escapeHtml(text.pending)}</strong></p>${li(pending.map((d) => d.item.label[record.locale]))}<p>${escapeHtml(text.howTo)}</p>` : `<p>${escapeHtml(text.noPending)}</p>`) +
      `<p>${escapeHtml(text.contact)}<br>${escapeHtml(CONTACT.name)} · ${escapeHtml(CONTACT.phone)} · <a href="mailto:${CONTACT.email}">${CONTACT.email}</a></p><p>${escapeHtml(text.sign)}</p>`,
  );
  return {
    from: cfg.from,
    to: [str(a["start.email"])],
    cc: [],
    replyTo: cfg.replyTo,
    subject: fill(text.subject, { year }),
    html,
  };
}
