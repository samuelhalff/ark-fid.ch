import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { toWinAnsi } from "../../tax-questionnaire/server/pdf";
import { displayValue, fieldText, isBlockVisible, isRowFieldVisible, label, rowsOf, rowTitle, visibleSteps } from "../engine";
import { declarations, isPM, isPP } from "../schema";
import type { Answers, KycLocale } from "../types";
import type { SubmissionRecord } from "./service";

/**
 * The KYC form to sign (A4, client's language), laid out like Dima's Word form: Ark letterhead,
 * sections A–I, declarations and signature blocks. Every page carries the declaration reference
 * (case, revision, start of the SHA-256 of the submitted JSON) so a signed scan can be matched to
 * the exact version. Plain text only (no links, forms or scripts): client input cannot inject
 * anything into the document.
 */

const A4: [number, number] = [595.28, 841.89];
const MARGIN = 50;
const FOOTER = 34;
const KEY_WIDTH = 190;
const NAVY = rgb(0.12, 0.165, 0.267);
const GREY = rgb(0.42, 0.45, 0.5);
const BLACK = rgb(0.1, 0.1, 0.12);
const LINE = rgb(0.75, 0.77, 0.8);

const TEXT = {
  title: { fr: "Questionnaire client", en: "Client questionnaire" },
  pp: { fr: "Personnes physiques", en: "Natural persons" },
  pmOp: { fr: "Personnes morales", en: "Legal entities" },
  pmNonOp: { fr: "Personnes morales – sociétés non opérationnelles", en: "Legal entities – non-operating companies" },
  ref: { fr: "Réf.", en: "Ref." },
  sent: { fr: "Envoyé en ligne le", en: "Submitted online on" },
  page: { fr: "Page", en: "Page" },
  confidential: { fr: "Confidentiel", en: "Confidential" },
  documents: { fr: "Documents", en: "Documents" },
  uploaded: { fr: "joint", en: "attached" },
  later: { fr: "transmis séparément", en: "sent separately" },
  na: { fr: "sans objet", en: "not applicable" },
  place: { fr: "Lieu et date", en: "Place and date" },
  name: { fr: "Nom, prénom et fonction", en: "Name, first name and position" },
  namePp: { fr: "Nom et prénom", en: "Name and first name" },
  clientDeclarationTitle: { fr: "Déclaration et engagement du client", en: "Declaration and undertaking by the client" },
  clientDeclarationBody: {
    fr: "Je soussigné(e), agissant en mon nom propre ou en qualité de représentant(e) dûment habilité(e) de l'entité concernée, confirme que les informations communiquées dans le présent questionnaire, y compris celles préremplies par Ark Fiduciaire SA, sont, à ma connaissance, exactes, complètes et à jour.\n\nJe confirme notamment l'exactitude des informations relatives aux activités de l'entité, à sa structure de propriété et de contrôle ainsi qu'à ses ayants droit économiques.\n\nJe m'engage à informer spontanément Ark Fiduciaire SA, sans délai, de toute modification pertinente de ces informations pendant la durée de notre relation, notamment en cas de changement d'ayant droit économique, d'actionnariat ou de contrôle, de représentant ou de pouvoir de signature, d'activité, de structure ou de situation susceptible d'influencer les obligations de diligence d'Ark Fiduciaire SA.",
    en: "I, the undersigned, acting in my own name or as the duly authorised representative of the entity concerned, confirm that the information provided in this questionnaire, including the information pre-filled by Ark Fiduciaire SA, is, to the best of my knowledge, accurate, complete and up to date.\n\nI confirm in particular the accuracy of the information relating to the entity's activities, its ownership and control structure and its beneficial owners.\n\nI undertake to inform Ark Fiduciaire SA spontaneously and without delay of any relevant change to this information during our relationship, in particular any change of beneficial owner, shareholding or control, of representative or signing authority, of activity, of structure or of any situation likely to affect Ark Fiduciaire SA's due diligence obligations.",
  },
  signature: { fr: "Signature", en: "Signature" },
  onlineSignature: { fr: "Signature en ligne : voir la dernière page", en: "Online signature: see the final page" },
  instructions: {
    fr: "Merci de vérifier et de signer ce document, puis d'en déposer sur kyc.ark-fid.ch une copie numérisée ou une photo lisible de toutes les pages.",
    en: "Please check and sign this document, then upload a legible scanned copy or photograph of every page to kyc.ark-fid.ch.",
  },
  instructionsOnline: {
    fr: "Merci de vérifier ce document, puis de le signer en ligne sur kyc.ark-fid.ch, ou de le signer sur papier et d'y déposer une copie numérisée ou une photo lisible de toutes les pages.",
    en: "Please check this document, then sign it online at kyc.ark-fid.ch, or sign it on paper and upload a legible scanned copy or photograph of every page there.",
  },
  online: {
    title: { fr: "Signature en ligne", en: "Online signature" },
    intro: {
      fr: "Le présent formulaire a été signé en ligne sur kyc.ark-fid.ch. Chaque signataire ci-dessous a utilisé sa propre session, ouverte avec un code envoyé à son adresse e-mail, puis a confirmé les déclarations et saisi son nom. Son tracé manuscrit figure ci-dessous lorsqu'il a été recueilli. Il ne s'agit pas d'une signature électronique qualifiée.",
      en: "This form was signed online at kyc.ark-fid.ch. Each signatory below used their own session, opened with a code sent to their e-mail address, then confirmed the declarations and typed their name. Their drawn signature appears below when one was captured. This is not a qualified electronic signature.",
    },
    signer: { fr: "Signataire déclaré", en: "Declared signatory" },
    typed: { fr: "Nom saisi", en: "Name typed" },
    drawn: { fr: "Signature tracée", en: "Drawn signature" },
    email: { fr: "Adresse e-mail du code", en: "E-mail address of the code" },
    byArk: { fr: " (adresse indiquée par Ark)", en: " (address given by Ark)" },
    at: { fr: "Date et heure (Suisse)", en: "Date and time (Swiss time)" },
    pdf: { fr: "SHA-256 du formulaire signé (pages précédentes)", en: "SHA-256 of the form signed (previous pages)" },
    json: { fr: "SHA-256 des réponses (questionnaire.json)", en: "SHA-256 of the answers (questionnaire.json)" },
  },
} as const;

const swissDate = (iso: string) => {
  const d = new Date(iso);
  const parts = new Intl.DateTimeFormat("fr-CH", { timeZone: "Europe/Zurich", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }).formatToParts(d);
  const get = (type: string) => parts.find((p) => p.type === type)?.value || "";
  return `${get("day")}.${get("month")}.${get("year")} ${get("hour")}:${get("minute")}`;
};

class Writer {
  page!: PDFPage;
  y = 0;
  pages: PDFPage[] = [];
  private readonly doc: PDFDocument;
  readonly font: PDFFont;
  readonly bold: PDFFont;
  constructor(doc: PDFDocument, font: PDFFont, bold: PDFFont) {
    this.doc = doc;
    this.font = font;
    this.bold = bold;
    this.newPage();
  }
  newPage() {
    this.page = this.doc.addPage(A4);
    this.pages.push(this.page);
    this.y = A4[1] - MARGIN;
  }
  ensure(height: number) {
    if (this.y - height < MARGIN + FOOTER) this.newPage();
  }
  wrap(text: string, font: PDFFont, size: number, width: number): string[] {
    const out: string[] = [];
    for (const paragraph of toWinAnsi(text).split("\n")) {
      let line = "";
      for (const word of paragraph.split(/\s+/).filter(Boolean)) {
        const candidate = line ? `${line} ${word}` : word;
        if (font.widthOfTextAtSize(candidate, size) <= width) {
          line = candidate;
          continue;
        }
        if (line) out.push(line);
        // A single word longer than the line is cut.
        let rest = word;
        while (font.widthOfTextAtSize(rest, size) > width) {
          let cut = rest.length - 1;
          while (cut > 1 && font.widthOfTextAtSize(rest.slice(0, cut), size) > width) cut--;
          out.push(rest.slice(0, cut));
          rest = rest.slice(cut);
        }
        line = rest;
      }
      out.push(line);
    }
    return out;
  }
  text(text: string, opts: { size?: number; bold?: boolean; color?: ReturnType<typeof rgb>; x?: number; width?: number; gap?: number } = {}) {
    const size = opts.size || 9.5;
    const font = opts.bold ? this.bold : this.font;
    const x = opts.x ?? MARGIN;
    const width = opts.width ?? A4[0] - MARGIN - x;
    for (const line of this.wrap(text, font, size, width)) {
      this.ensure(size + 3);
      this.page.drawText(line, { x, y: this.y - size, size, font, color: opts.color || BLACK });
      this.y -= size + 3;
    }
    this.y -= opts.gap ?? 2;
  }
  pair(key: string, value: string, indent = 0) {
    const size = 9.5;
    const keyLines = this.wrap(key, this.font, size, KEY_WIDTH - 8 - indent);
    const valueLines = this.wrap(value || "–", this.bold, size, A4[0] - 2 * MARGIN - KEY_WIDTH);
    const rows = Math.max(keyLines.length, valueLines.length);
    for (let i = 0; i < rows; i++) {
      this.ensure(size + 3);
      if (keyLines[i]) this.page.drawText(keyLines[i], { x: MARGIN + indent, y: this.y - size, size, font: this.font, color: GREY });
      if (valueLines[i]) this.page.drawText(valueLines[i], { x: MARGIN + KEY_WIDTH, y: this.y - size, size, font: this.bold, color: BLACK });
      this.y -= size + 3;
    }
    this.y -= 2;
  }
  heading(text: string) {
    this.ensure(40);
    this.y -= 8;
    this.page.drawText(toWinAnsi(text), { x: MARGIN, y: this.y - 11, size: 11, font: this.bold, color: NAVY });
    this.y -= 15;
    this.page.drawLine({ start: { x: MARGIN, y: this.y }, end: { x: A4[0] - MARGIN, y: this.y }, thickness: 0.6, color: NAVY });
    this.y -= 6;
  }
  rule(x1: number, x2: number) {
    this.page.drawLine({ start: { x: x1, y: this.y }, end: { x: x2, y: this.y }, thickness: 0.5, color: LINE });
  }
}

export async function buildKycPdf(record: SubmissionRecord, declarationId: string, options: { online?: boolean } = {}): Promise<Uint8Array> {
  const L: KycLocale = record.language;
  const a: Answers = record.answers;
  const doc = await PDFDocument.create();
  doc.setTitle(`${TEXT.title[L]} – ${record.clientName}`);
  doc.setAuthor("Ark Fiduciaire SA");
  doc.setProducer("kyc.ark-fid.ch");
  // Internal metadata (not printed on the form): which answers Ark entered during an assisted session.
  const entered = Object.entries(record.enteredBy || {});
  if (entered.length) doc.setKeywords([`ark-assisted: ${entered.length} answer(s) entered by Ark (${[...new Set(entered.map(([, by]) => by))].join(", ")})`, `ark-entered-ids: ${entered.map(([id]) => id).join(" ")}`]);
  const w = new Writer(doc, await doc.embedFont(StandardFonts.Helvetica), await doc.embedFont(StandardFonts.HelveticaBold));

  // Letterhead and title.
  w.text("Ark Fiduciaire SA", { bold: true, size: 11, color: NAVY, gap: 0 });
  w.text("26, boulevard Georges-Favon · 1204 Genève · T. +41 22 512 50 50 · info@ark-fid.ch · ark-fid.ch", { size: 8.5, color: GREY, gap: 14 });
  w.text(TEXT.title[L], { bold: true, size: 15, color: NAVY, gap: 2 });
  w.text(isPP(a) ? TEXT.pp[L] : a.route === "pm-nonop" ? TEXT.pmNonOp[L] : TEXT.pmOp[L], { size: 11, color: NAVY, gap: 6 });
  w.text(`${record.clientName} · ${TEXT.ref[L]} ${declarationId} · ${TEXT.sent[L]} ${swissDate(record.submittedAt)}`, { size: 8.5, color: GREY, gap: 4 });
  w.text((options.online ? TEXT.instructionsOnline : TEXT.instructions)[L], { size: 8.5, color: GREY, gap: 6 });

  for (const step of visibleSteps(a)) {
    if (!step.section) continue;
    w.heading(`${step.section}.  ${label(step.title, L).toLocaleUpperCase(L === "fr" ? "fr-CH" : "en-GB")}`);
    if (step.special === "documents") {
      for (const d of record.documents) {
        const status = TEXT[d.status][L];
        w.pair(d.label, d.files.length ? `${status} : ${d.files.join(", ")}` : status);
      }
      continue;
    }
    for (const block of step.blocks) {
      if (!isBlockVisible(block, a)) continue;
      if (block.kind === "heading") {
        // A section starting inside a screen (F and G on the money screen) is a section here too.
        if (block.section) w.heading(`${block.section}.  ${label(block.label, L).toLocaleUpperCase(L === "fr" ? "fr-CH" : "en-GB")}`);
        else if (!block.prefill?.onlyWhenPrefilled) w.text(label(block.label, L), { bold: true, size: 10, color: NAVY, gap: 2 });
      } else if (block.kind === "field") {
        if (block.id === "i.accept") continue;
        w.pair(label(fieldText(block, a).label, L), displayValue(block, a[block.id], L));
      } else if (block.kind === "group") {
        w.text(label(block.label, L), { bold: true, size: 10, color: NAVY, gap: 1 });
        const rows = rowsOf(a, block.id);
        rows.forEach((row, index) => {
          w.text(`${label(block.itemLabel, L)} ${index + 1}${rowTitle(block, row) ? ` – ${rowTitle(block, row)}` : ""}`, { bold: true, size: 9.5, x: MARGIN + 8, gap: 1 });
          for (const field of block.fields) {
            if (!isRowFieldVisible(field, a, row)) continue;
            w.pair(label(field.label, L), displayValue(field, row[field.id], L), 8);
          }
        });
      } else if (block.kind === "note" && block.id === "i.declarations") {
        const text = declarations(a);
        w.text(label(text.intro, L), { gap: 2 });
        for (const item of text.items) w.text(`–  ${label(item, L)}`, { x: MARGIN + 10, gap: 1 });
        w.y -= 4;
        w.text(label(text.closing, L), { size: 8.5, color: GREY, gap: 6 });
      }
    }
  }

  // Declaration immediately above the signature: it is part of what is signed.
  w.ensure(120);
  w.text(TEXT.clientDeclarationTitle[L], { size: 9 });
  for (const paragraph of TEXT.clientDeclarationBody[L].split("\n\n")) {
    w.text(paragraph, { size: 8.5, color: GREY, gap: 4 });
  }
  w.y -= 8;

  // Signature blocks: one per signatory (company), or the client.
  const signers = isPM(a)
    ? rowsOf(a, "i.signers").map((r) => `${String(r.lastName || "").toLocaleUpperCase("fr-CH")} ${r.firstName || ""}, ${r.function || ""}`.trim())
    : [record.clientName];
  w.ensure(60 + signers.length * 70);
  w.y -= 10;
  w.text(`${TEXT.place[L]} : ${String(a["i.place"] || "")}, ____________________`, { gap: 18 });
  for (const signer of signers) {
    w.ensure(70);
    w.text(`${isPM(a) ? TEXT.name[L] : TEXT.namePp[L]} : ${signer}`, { gap: options.online ? 4 : 30 });
    if (options.online) {
      w.text(TEXT.onlineSignature[L], { size: 8.5, color: GREY, gap: 35 });
    } else {
      w.rule(MARGIN, MARGIN + 240);
      w.y -= 4;
      w.text(TEXT.signature[L], { size: 8.5, color: GREY, gap: 16 });
    }
  }

  // Footer with the reference on every page.
  const total = w.pages.length;
  w.pages.forEach((page, index) => {
    const footer = toWinAnsi(`${TEXT.title[L]} · ${TEXT.ref[L]} ${declarationId} · ${TEXT.confidential[L]} · ${TEXT.page[L]} ${index + 1}/${total}`);
    page.drawText(footer, { x: MARGIN, y: MARGIN - 18, size: 7.5, font: w.font, color: GREY });
  });
  return doc.save();
}

/**
 * The form signed online: the PDF the signatories checked, unchanged, plus a last page recording
 * each signature (declared signatory, name typed, code address, Swiss time) and the SHA-256 of
 * the form and of the answers.
 */
export async function appendOnlineSignatures(
  original: Uint8Array,
  info: {
    language: KycLocale;
    declarationId: string;
    signers: { name: string; typed: string; email: string; at: string; drawnPng?: string; byArk?: boolean }[];
    pdfSha256: string;
    jsonSha256: string;
  },
): Promise<Uint8Array> {
  const L = info.language;
  const T = TEXT.online;
  const doc = await PDFDocument.load(original);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const w = new Writer(doc, font, bold);
  w.heading(T.title[L]);
  w.text(T.intro[L], { gap: 10 });
  for (const signer of info.signers) {
    w.pair(T.signer[L], signer.name);
    w.pair(T.typed[L], signer.typed);
    w.pair(T.email[L], signer.email + (signer.byArk ? T.byArk[L] : ""));
    w.pair(T.at[L], swissDate(signer.at));
    if (signer.drawnPng) {
      const image = await doc.embedPng(Buffer.from(signer.drawnPng, "base64"));
      const size = image.scaleToFit(300, 90);
      w.ensure(size.height + 24);
      w.text(T.drawn[L], { size: 8.5, color: GREY, gap: 2 });
      w.page.drawImage(image, { x: MARGIN, y: w.y - size.height, width: size.width, height: size.height });
      w.y -= size.height + 10;
    } else {
      w.y -= 8;
    }
  }
  w.pair(TEXT.ref[L], info.declarationId);
  w.pair(T.pdf[L], info.pdfSha256);
  w.pair(T.json[L], info.jsonSha256);
  for (const page of w.pages) {
    page.drawText(toWinAnsi(`${TEXT.title[L]} · ${TEXT.ref[L]} ${info.declarationId} · ${TEXT.confidential[L]} · ${T.title[L]}`), { x: MARGIN, y: MARGIN - 18, size: 7.5, font, color: GREY });
  }
  return doc.save();
}
