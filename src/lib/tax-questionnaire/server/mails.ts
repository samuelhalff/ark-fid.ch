/** Short transactional e-mails (codes, links, staff alerts). Plain, no figures, no answers. */
import type { QfLocale } from "../types";
import { CONTACT } from "../ui";
import { escapeHtml, mailConfig } from "./email";
import type { MailMessage } from "./storage";

const wrap = (body: string) =>
  `<!doctype html><html><body style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.5;color:#1f2937;max-width:600px">${body}<p style="color:#6b7280;font-size:12px">${escapeHtml(CONTACT.name)} · ${escapeHtml(CONTACT.phone)} · ${escapeHtml(CONTACT.email)}</p></body></html>`;

const T = {
  otpSubject: { fr: "Votre code : {code}", en: "Your code: {code}", de: "Ihr Code: {code}" },
  otpBody: {
    fr: "Votre code pour le questionnaire fiscal d'Ark Fiduciaire : <strong style=\"font-size:20px;letter-spacing:3px\">{code}</strong><br>Il est valable 10 minutes. Si vous n'êtes pas à l'origine de cette demande, ignorez ce message.",
    en: "Your code for the Ark Fiduciaire tax questionnaire: <strong style=\"font-size:20px;letter-spacing:3px\">{code}</strong><br>It is valid for 10 minutes. If you did not request it, ignore this message.",
    de: "Ihr Code für den Steuerfragebogen von Ark Fiduciaire: <strong style=\"font-size:20px;letter-spacing:3px\">{code}</strong><br>Er ist 10 Minuten gültig. Falls Sie ihn nicht angefordert haben, ignorieren Sie diese Nachricht.",
  },
  linkSubject: {
    resume: { fr: "Reprendre votre questionnaire fiscal", en: "Continue your tax questionnaire", de: "Ihren Steuerfragebogen fortsetzen" },
    status: { fr: "Suivi de votre questionnaire fiscal", en: "Your tax questionnaire status", de: "Stand Ihres Steuerfragebogens" },
    partner: { fr: "Votre questionnaire fiscal (invitation de votre partenaire)", en: "Your tax questionnaire (invitation from your partner)", de: "Ihr Steuerfragebogen (Einladung Ihres Partners)" },
  },
  linkBody: {
    fr: "Voici votre lien personnel (valable {days} jours) :<br><a href=\"{url}\">Ouvrir mon questionnaire</a><br>Un code vous sera envoyé par e-mail à chaque ouverture. Ne transférez pas ce message.",
    en: "Here is your personal link (valid for {days} days):<br><a href=\"{url}\">Open my questionnaire</a><br>A code will be e-mailed to you each time you open it. Do not forward this message.",
    de: "Hier ist Ihr persönlicher Link ({days} Tage gültig):<br><a href=\"{url}\">Meinen Fragebogen öffnen</a><br>Bei jedem Öffnen erhalten Sie einen Code per E-Mail. Leiten Sie diese Nachricht nicht weiter.",
  },
  partnerIntro: {
    fr: "{name} vous invite à remplir votre propre questionnaire fiscal. Les informations communes (domicile, enfants, logement) sont déjà reprises.",
    en: "{name} invites you to fill in your own tax questionnaire. Shared information (residence, children, home) is already filled in.",
    de: "{name} lädt Sie ein, Ihren eigenen Steuerfragebogen auszufüllen. Gemeinsame Angaben (Wohnsitz, Kinder, Wohnung) sind bereits übernommen.",
  },
  regularisationClient: {
    fr: "Nous avons bien reçu votre demande. Nous vous appellerons rapidement, en toute confidentialité.",
    en: "We have received your request. We will call you shortly, in confidence.",
    de: "Wir haben Ihre Anfrage erhalten. Wir rufen Sie in Kürze vertraulich an.",
  },
  regularisationSubject: { fr: "Votre demande – Ark Fiduciaire", en: "Your request – Ark Fiduciaire", de: "Ihre Anfrage – Ark Fiduciaire" },
} as const;

const fill = (s: string, values: Record<string, string>) => s.replace(/\{(\w+)\}/g, (_m, k: string) => values[k] ?? "");

export function otpMail(locale: QfLocale, to: string, code: string): MailMessage {
  return {
    from: mailConfig().from,
    to: [to],
    cc: [],
    subject: fill(T.otpSubject[locale], { code }),
    html: wrap(`<p>${fill(T.otpBody[locale], { code: escapeHtml(code) })}</p>`),
  };
}

export function linkMail(locale: QfLocale, to: string, url: string, purpose: "resume" | "status" | "partner", days: number, inviterName = ""): MailMessage {
  const intro = purpose === "partner" ? `<p>${escapeHtml(fill(T.partnerIntro[locale], { name: inviterName }))}</p>` : "";
  return {
    from: mailConfig().from,
    to: [to],
    cc: [],
    replyTo: mailConfig().replyTo,
    subject: T.linkSubject[purpose][locale],
    html: wrap(`${intro}<p>${fill(T.linkBody[locale], { url: escapeHtml(url), days: String(days) })}</p>`),
  };
}

/** Client confirmation on the regularisation route: nothing beyond "request received". */
export function regularisationClientMail(locale: QfLocale, to: string): MailMessage {
  return { from: mailConfig().from, to: [to], cc: [], replyTo: mailConfig().replyTo, subject: T.regularisationSubject[locale], html: wrap(`<p>${escapeHtml(T.regularisationClient[locale])}</p>`) };
}

/** Immediate staff alert (regularisation request, source-taxed submission near 31 March…). */
export function staffAlert(subject: string, lines: string[], folderUrl: string): MailMessage {
  const cfg = mailConfig();
  return {
    from: cfg.from,
    to: cfg.to,
    cc: cfg.cc,
    subject,
    html: wrap(`${lines.map((l) => `<p>${escapeHtml(l)}</p>`).join("")}${folderUrl.startsWith("https://") ? `<p><a href="${escapeHtml(folderUrl)}">Dossier SharePoint</a></p>` : ""}`),
  };
}
