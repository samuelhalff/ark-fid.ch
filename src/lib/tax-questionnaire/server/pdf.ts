import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { attentionPoints } from "../attention";
import { renewalContext, renewalStatusFr } from "../renewal";
import { DOC_CATEGORIES, selectedYears, taxYearOf } from "../documents";
import { nowSwiss, personName } from "../format";
import { displayValue, getField, isBlockVisible, isRowFieldVisible, label, visibleSteps } from "../logic";
import { ROUTER_GROUPS, ROUTER_OPTIONS, routerItems, rowsOf } from "../schema";
import type { Answers, DocStatus } from "../types";
import { regimeSummary, STATUS_FR, type SubmissionRecord } from "./excel";

/**
 * PDF summary (A4, French): a read-only snapshot of a submission for the client file. Same data
 * as the Excel workbook. All content is drawn as plain text with a standard font (no links, no
 * forms, no scripts), so client input cannot inject anything into the document.
 */

const A4: [number, number] = [595.28, 841.89];
const MARGIN = 50;
const FOOTER = 30;
const KEY_WIDTH = 175;
const NAVY = rgb(0.12, 0.165, 0.267);
const GREY = rgb(0.42, 0.45, 0.5);
const RED = rgb(0.72, 0.11, 0.11);
const BLACK = rgb(0.1, 0.1, 0.12);

// Characters outside WinAnsi are mapped to close equivalents, the rest dropped.
const MAP: Record<string, string> = {
  "‛": "'",
  "′": "'",
  "−": "-",
  "≥": ">=",
  "≤": "<=",
  "→": "->",
  "←": "<-",
  " ": " ",
  " ": " ",
  " ": " ",
  "​": "",
  "\t": "  ",
};
// WinAnsi (cp1252) characters outside Latin-1, incl. typographic quotes, dashes and ellipsis.
const WINANSI_EXTRA = new Set("€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ");

/** Text safe for the standard Helvetica (WinAnsi) encoding. */
export function toWinAnsi(input: string): string {
  let out = "";
  for (const ch of input.normalize("NFC")) {
    if (ch in MAP) {
      out += MAP[ch];
      continue;
    }
    const code = ch.codePointAt(0) || 0;
    if ((code >= 0x20 && code <= 0x7e) || (code >= 0xa0 && code <= 0xff) || WINANSI_EXTRA.has(ch)) out += ch;
    else if (ch === "\n") out += "\n";
    else {
      // Try the base letter of an accented character (e.g. "ł" stays dropped, "ō" → "o").
      const base = ch.normalize("NFD").replace(/[̀-ͯ]/g, "");
      out += base.length === 1 && base.charCodeAt(0) >= 0x20 && base.charCodeAt(0) < 0x7f ? base : "";
    }
  }
  return out;
}

const str = (v: unknown) => (typeof v === "string" ? v : "");

class Writer {
  page!: PDFPage;
  y = 0;
  pages: PDFPage[] = [];
  readonly doc: PDFDocument;
  readonly regular: PDFFont;
  readonly bold: PDFFont;
  constructor(doc: PDFDocument, regular: PDFFont, bold: PDFFont) {
    this.doc = doc;
    this.regular = regular;
    this.bold = bold;
    this.newPage();
  }
  get width() {
    return A4[0] - 2 * MARGIN;
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
    const lines: string[] = [];
    for (const paragraph of toWinAnsi(text).split("\n")) {
      let line = "";
      for (const word of paragraph.split(/ +/)) {
        const candidate = line ? `${line} ${word}` : word;
        if (font.widthOfTextAtSize(candidate, size) <= width) {
          line = candidate;
          continue;
        }
        if (line) lines.push(line);
        // Break words longer than the column.
        let rest = word;
        while (font.widthOfTextAtSize(rest, size) > width && rest.length > 1) {
          let cut = rest.length - 1;
          while (cut > 1 && font.widthOfTextAtSize(rest.slice(0, cut), size) > width) cut--;
          lines.push(rest.slice(0, cut));
          rest = rest.slice(cut);
        }
        line = rest;
      }
      lines.push(line);
    }
    return lines;
  }
  text(text: string, opts: { size?: number; font?: PDFFont; color?: ReturnType<typeof rgb>; indent?: number; gapAfter?: number } = {}) {
    const size = opts.size ?? 9.5;
    const font = opts.font ?? this.regular;
    const indent = opts.indent ?? 0;
    const lineHeight = size * 1.35;
    for (const line of this.wrap(text, font, size, this.width - indent)) {
      this.ensure(lineHeight);
      this.page.drawText(line, { x: MARGIN + indent, y: this.y - size, size, font, color: opts.color ?? BLACK });
      this.y -= lineHeight;
    }
    this.y -= opts.gapAfter ?? 0;
  }
  heading(text: string, size = 12.5) {
    this.ensure(size * 3);
    this.y -= size * 0.8;
    this.text(text, { size, font: this.bold, color: NAVY });
    this.page.drawLine({ start: { x: MARGIN, y: this.y + 2 }, end: { x: MARGIN + this.width, y: this.y + 2 }, thickness: 0.6, color: NAVY });
    this.y -= 6;
  }
  subheading(text: string) {
    this.ensure(30);
    this.y -= 4;
    this.text(text, { size: 10, font: this.bold, color: NAVY, gapAfter: 1 });
  }
  kv(key: string, value: string, indent = 0) {
    if (!value) return;
    const size = 9.5;
    const lineHeight = size * 1.35;
    const keyLines = this.wrap(key, this.bold, size, KEY_WIDTH - indent - 8);
    const valueLines = this.wrap(value, this.regular, size, this.width - KEY_WIDTH);
    const rows = Math.max(keyLines.length, valueLines.length);
    for (let i = 0; i < rows; i++) {
      this.ensure(lineHeight);
      if (keyLines[i]) this.page.drawText(keyLines[i], { x: MARGIN + indent, y: this.y - size, size, font: this.bold, color: GREY });
      if (valueLines[i]) this.page.drawText(valueLines[i], { x: MARGIN + KEY_WIDTH, y: this.y - size, size, font: this.regular, color: BLACK });
      this.y -= lineHeight;
    }
    this.y -= 1.5;
  }
}

function fieldText(a: Answers, id: string): string {
  const def = getField(id);
  return def ? displayValue(def, a[id], "fr", a) : "";
}

export async function buildPdf(record: SubmissionRecord): Promise<Uint8Array> {
  const a = record.answers;
  const L = (text: Parameters<typeof label>[0]) => label(text, "fr", a);
  const year = taxYearOf(a);
  const fullName = personName(str(a["start.lastName"]), str(a["start.firstName"]));

  const doc = await PDFDocument.create();
  doc.setTitle(toWinAnsi(`Questionnaire fiscal ${year} - ${fullName}`));
  doc.setAuthor("Ark Fiduciaire SA");
  doc.setProducer("tax.ark-fid.ch");
  doc.setCreationDate(record.submittedAt);
  const w = new Writer(doc, await doc.embedFont(StandardFonts.Helvetica), await doc.embedFont(StandardFonts.HelveticaBold));

  // ---- header
  w.text("Ark Fiduciaire SA", { size: 10, font: w.bold, color: NAVY });
  w.y -= 4;
  w.text(`Questionnaire fiscal ${year} – ${fullName}`, { size: 17, font: w.bold, color: NAVY, gapAfter: 2 });
  w.text(`Reçu le ${nowSwiss(record.submittedAt)} · réf. ${record.sid}`, { size: 9.5, color: GREY, gapAfter: 4 });

  // ---- Synthèse
  w.heading("Synthèse");
  w.subheading("Client");
  w.kv("Nom, prénom", fullName);
  w.kv("Conjoint(e)", personName(str(a["start.spouseLastName"]), str(a["start.spouseFirstName"])));
  w.kv("Ménage", fieldText(a, "start.household"));
  w.kv("E-mail", str(a["start.email"]));
  w.kv("Téléphone", str(a["start.phone"]));
  w.kv("Langue des réponses", { fr: "Français", en: "Anglais", de: "Allemand" }[record.locale]);
  w.kv("Dernière déclaration", fieldText(a, "start.status"));
  w.kv("N° de contribuable", str(a["base.taxNumber"]));
  w.subheading("Période et régime");
  w.kv("Année(s) fiscale(s)", selectedYears(a).join(", "));
  w.kv("Canton au 31.12", fieldText(a, "start.canton"));
  w.kv("Commune", str(a["start.commune"]));
  w.kv("Régime", regimeSummary(a));
  w.kv("Permis", fieldText(a, "regime.permit"));
  w.kv("Arrivée", [str(a["regime.arrivalDate"]), str(a["regime.arrivalFrom"])].filter(Boolean).join(" – depuis "));
  w.kv("Départ", [str(a["regime.departureDate"]), str(a["regime.departureTo"])].filter(Boolean).join(" – vers "));
  w.kv("Pays de domicile", str(a["regime.country"]));
  w.subheading("Situation déclarée");
  const items = new Set(routerItems(a));
  const unchanged = Array.isArray(a["router.unchanged"]) ? (a["router.unchanged"] as string[]) : [];
  for (const group of ROUTER_GROUPS) {
    const selected = ROUTER_OPTIONS.filter((o) => o.group === group.id && items.has(o.value)).map((o) => L(o.label));
    w.kv(group.label.fr, [unchanged.includes(group.id) ? "Inchangé depuis la dernière déclaration" : "", ...selected].filter(Boolean).join(" ; ") || "—");
  }
  w.subheading("Documents");
  const count = (status: DocStatus) => record.docs.filter((d) => d.status === status).length;
  w.kv("Reçus", String(count("uploaded")));
  w.kv("Envoi ultérieur annoncé", String(count("later")));
  w.kv("Non applicable (selon le client)", String(count("na")));
  w.kv("Non reçus", String(count("missing")));
  if (record.extras.length) w.kv("Documents complémentaires", String(record.extras.length));
  if (record.flagged.length) w.kv("Fichiers à vérifier", String(record.flagged.length));
  w.kv("Dossier SharePoint", record.folderName);

  // ---- Points d'attention
  const points = attentionPoints(a);
  w.heading("Points d'attention");
  if (points.length === 0) w.text("Aucun point particulier signalé par les réponses.", { color: GREY });
  for (const point of points) {
    w.text(`${point.level === "high" ? "[Priorité élevée] " : "- "}${point.text}`, { color: point.level === "high" ? RED : BLACK, gapAfter: 2 });
  }

  // ---- answers per screen
  for (const step of visibleSteps(a)) {
    if (step.id === "start" || step.id === "router" || step.special === "documents") continue;
    const blocks = step.blocks.filter((b) => isBlockVisible(b, a));
    const hasContent = blocks.some(
      (b) => (b.kind === "field" && !b.hidden && displayValue(b, a[b.id], "fr", a)) || (b.kind === "group" && !b.hidden && rowsOf(a, b.id).length > 0),
    );
    if (!hasContent) continue;
    w.heading(L(step.title));
    for (const block of blocks) {
      if (block.kind === "heading") w.subheading(L(block.label));
      else if (block.kind === "field" && !block.hidden) w.kv(L(block.label), displayValue(block, a[block.id], "fr", a));
      else if (block.kind === "group" && !block.hidden) {
        rowsOf(a, block.id).forEach((row, index) => {
          w.subheading(`${L(block.itemLabel)} ${index + 1}${renewalContext(a) ? ` – ${renewalStatusFr(row)}` : ""}`);
          for (const f of block.fields.filter((x) => !x.hidden)) {
            if (!isRowFieldVisible(f, a, row)) continue;
            w.kv(L(f.label), displayValue(f, row[f.id], "fr", a), 10);
          }
        });
      }
    }
  }

  // ---- documents
  w.heading("Documents");
  for (const d of record.docs) {
    w.text(d.item.label.fr, { font: w.bold, size: 9.5 });
    w.text(`${DOC_CATEGORIES[d.item.category].label.fr} · ${STATUS_FR[d.status]}`, { color: d.status === "missing" ? RED : GREY, size: 8.5, indent: 10 });
    for (const f of d.files) w.text(`- ${f.name}`, { size: 8.5, indent: 10 });
    w.y -= 3;
  }
  if (record.extras.length) {
    w.subheading(DOC_CATEGORIES.extra.label.fr);
    for (const f of record.extras) w.text(`- ${f.name}`, { size: 8.5, indent: 10 });
  }
  if (record.flagged.length) {
    w.subheading("Fichiers à vérifier (écartés, sous-dossier _A verifier)");
    for (const f of record.flagged) w.text(`- ${f.file.name} : ${f.reason}`, { size: 8.5, indent: 10, color: RED });
  }

  // ---- À demander
  w.heading("À demander");
  const pending = record.docs.filter((d) => d.status === "later" || d.status === "missing" || d.status === "na");
  if (pending.length === 0) w.text("Aucun document attendu.", { color: GREY });
  for (const d of pending) w.text(`- ${d.item.label.fr} (${d.status === "na" ? "déclaré non applicable par le client, à vérifier" : STATUS_FR[d.status]})`, { gapAfter: 1 });

  // ---- certification
  w.heading("Certification");
  w.text(
    `Le client a certifié l'exactitude et l'intégralité de ses réponses le ${nowSwiss(record.submittedAt)} et accepté la notice de confidentialité (version ${record.privacyVersion}).`,
  );

  // ---- footers
  const total = w.pages.length;
  w.pages.forEach((page, index) => {
    const footer = toWinAnsi(`Ark Fiduciaire SA · Questionnaire fiscal ${year} – ${fullName} · réf. ${record.sid}`);
    const pageLabel = `page ${index + 1} / ${total}`;
    page.drawLine({ start: { x: MARGIN, y: MARGIN + 6 }, end: { x: A4[0] - MARGIN, y: MARGIN + 6 }, thickness: 0.4, color: GREY });
    const maxFooter = A4[0] - 2 * MARGIN - w.regular.widthOfTextAtSize(pageLabel, 8) - 12;
    const shown = w.wrap(footer, w.regular, 8, maxFooter)[0] || "";
    page.drawText(shown, { x: MARGIN, y: MARGIN - 6, size: 8, font: w.regular, color: GREY });
    page.drawText(pageLabel, { x: A4[0] - MARGIN - w.regular.widthOfTextAtSize(pageLabel, 8), y: MARGIN - 6, size: 8, font: w.regular, color: GREY });
  });

  return doc.save({ useObjectStreams: true });
}

export const pdfFileName = (a: Answers) =>
  `Résumé questionnaire fiscal ${taxYearOf(a)} - ${personName(str(a["start.lastName"]), str(a["start.firstName"]))}`;
