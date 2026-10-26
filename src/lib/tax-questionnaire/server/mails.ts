/** Short transactional e-mails (codes, links, staff alerts). Plain, no figures, no answers. */
import type { QfLocale } from "../types";
import { escapeHtml, firstNameOf, mailConfig, plainHtml, staffRecipients, VOICE } from "./email";
import type { MailMessage } from "./storage";

const T = {
  otpSubject: { fr: "Votre code : {code}", en: "Your code: {code}", de: "Ihr Code: {code}" },
  otpBody: { fr: "Votre code : {code}", en: "Your code: {code}", de: "Ihr Code: {code}" },
  otpValid: { fr: "Il est valable 10 minutes.", en: "It is valid for 10 minutes.", de: "Er ist 10 Minuten gültig." },
  linkSubject: {
    resume: { fr: "Votre questionnaire fiscal", en: "Your tax questionnaire", de: "Ihr Steuerfragebogen" },
    status: { fr: "Votre dossier fiscal", en: "Your tax file", de: "Ihr Steuerdossier" },
    partner: { fr: "Votre questionnaire fiscal", en: "Your tax questionnaire", de: "Ihr Steuerfragebogen" },
  },
  linkIntro: {
    resume: { fr: "Voici le lien pour reprendre votre questionnaire :", en: "Here is the link to continue your questionnaire:", de: "Hier ist der Link, um Ihren Fragebogen fortzusetzen:" },
    status: { fr: "Voici le lien pour suivre votre dossier et ajouter des documents :", en: "Here is the link to follow your file and add documents:", de: "Hier ist der Link, um Ihr Dossier zu verfolgen und Dokumente hinzuzufügen:" },
    partner: {
      fr: "{name} nous a demandé de vous envoyer votre propre questionnaire. Les informations communes (domicile, enfants, logement) sont déjà reprises :",
      en: "{name} asked us to send you your own questionnaire. The shared information (residence, children, home) is already filled in:",
      de: "{name} hat uns gebeten, Ihnen Ihren eigenen Fragebogen zu senden. Die gemeinsamen Angaben (Wohnsitz, Kinder, Wohnung) sind bereits übernommen:",
    },
  },
  linkValid: { fr: "Le lien est valable {days} jours. Un code vous sera envoyé par email pour l'ouvrir.", en: "The link is valid for {days} days. A code will be sent to you by email to open it.", de: "Der Link ist {days} Tage gültig. Zum Öffnen erhalten Sie einen Code per E-Mail." },
  regularisationClient: { fr: "Nous avons bien reçu votre demande. Nous vous appelons rapidement.", en: "We have received your request. We will call you shortly.", de: "Wir haben Ihre Anfrage erhalten. Wir rufen Sie in Kürze an." },
  regularisationSubject: { fr: "Votre demande", en: "Your request", de: "Ihre Anfrage" },
} as const;

const fill = (s: string, values: Record<string, string>) => s.replace(/\{(\w+)\}/g, (_m, k: string) => values[k] ?? "");

export function otpMail(locale: QfLocale, to: string, code: string): MailMessage {
  return {
    from: mailConfig().from,
    to: [to],
    cc: [],
    subject: fill(T.otpSubject[locale], { code }),
    html: plainHtml([fill(T.otpBody[locale], { code }), T.otpValid[locale]]),
  };
}

export function linkMail(locale: QfLocale, to: string, url: string, purpose: "resume" | "status" | "partner", days: number, inviterName = "", recipientName = ""): MailMessage {
  const voice = VOICE[locale];
  return {
    from: mailConfig().from,
    to: [to],
    cc: [],
    replyTo: mailConfig().replyTo,
    subject: T.linkSubject[purpose][locale],
    html: plainHtml([
      voice.hello(firstNameOf(recipientName)),
      fill(T.linkIntro[purpose][locale], { name: inviterName }),
      { link: url, label: voice.open },
      fill(T.linkValid[locale], { days: String(days) }),
      voice.bye,
      voice.sign,
    ]),
  };
}

/** Client confirmation on the regularisation route: nothing beyond "request received". */
export function regularisationClientMail(locale: QfLocale, to: string): MailMessage {
  const voice = VOICE[locale];
  return { from: mailConfig().from, to: [to], cc: [], replyTo: mailConfig().replyTo, subject: T.regularisationSubject[locale], html: plainHtml([voice.hello(""), T.regularisationClient[locale], voice.bye, voice.sign]) };
}

const staffWrap = (body: string) => `<!doctype html><html><body style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.5;color:#1f2937;max-width:600px">${body}</body></html>`;

/** Immediate staff alert (regularisation request, source-taxed submission near 31 March…). */
export function staffAlert(subject: string, lines: string[], folderUrl: string, internal = false): MailMessage {
  const cfg = mailConfig();
  const recipients = staffRecipients(internal);
  return {
    from: cfg.from,
    to: recipients.to,
    cc: recipients.cc,
    subject,
    html: staffWrap(`${lines.map((l) => `<p>${escapeHtml(l)}</p>`).join("")}${folderUrl.startsWith("https://") ? `<p><a href="${escapeHtml(folderUrl)}">Dossier SharePoint</a></p>` : ""}`),
  };
}
