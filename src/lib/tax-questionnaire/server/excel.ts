import ExcelJS from "exceljs";
import { renewalContext, renewalStatusFr } from "../renewal";
import type { Row } from "../types";
import { attentionPoints } from "../attention";
import { DOC_CATEGORIES, selectedYears, taxYearOf } from "../documents";
import { dateToUtc, nowSwiss, parseAmount, parseDate } from "../format";
import { displayValue, getField, isBlockVisible, isRowFieldVisible, label, visibleSteps } from "../logic";
import { ROUTER_GROUPS, ROUTER_OPTIONS, routerItems, rowsOf } from "../schema";
import type { Answers, DocItem, DocStatus, FieldDef, QfLocale } from "../types";
import type { StoredFile } from "./storage";

/**
 * Workbook for the team: "Synthèse", "Points d'attention", one sheet per answered screen (French
 * labels whatever the client's language), "Documents" (every file name and link, so the workbook
 * is self-sufficient for recipients outside the tenant) and "À demander". No price, no score.
 */

export interface DocResult {
  item: DocItem;
  status: DocStatus;
  files: StoredFile[];
}

export interface SubmissionRecord {
  sid: string;
  clientKey: string;
  locale: QfLocale;
  submittedAt: Date;
  answers: Answers;
  docs: DocResult[];
  extras: StoredFile[];
  flagged: { file: StoredFile; reason: string }[];
  folderName: string;
  folderUrl: string;
  privacyVersion: string;
}

const LANG_FR: Record<QfLocale, string> = { fr: "Français", en: "Anglais", de: "Allemand" };
export const STATUS_FR: Record<DocStatus, string> = {
  uploaded: "Reçu",
  later: "Envoi ultérieur annoncé",
  na: "Non applicable (selon le client)",
  missing: "Non reçu",
};

const NAVY = "FF1F2A44";
const LIGHT = "FFF2F4F8";
const MONEY = "#,##0.00";

const str = (v: unknown) => (typeof v === "string" ? v : "");

/** Regime summary in one line (French). */
export function regimeSummary(a: Answers): string {
  const parts: string[] = [];
  const residence = displayValue(getField("regime.residence")!, a["regime.residence"], "fr", a);
  if (residence) parts.push(residence);
  if (a["regime.lumpSum"] === "yes") parts.push("imposition d'après la dépense");
  if (a["regime.sourceTax"] === "yes") parts.push("impôt à la source");
  if (a["regime.over120k"] === "yes") parts.push("TOU obligatoire");
  else if (a["regime.sourceRequest"]) parts.push(`souhait : ${displayValue(getField("regime.sourceRequest")!, a["regime.sourceRequest"], "fr", a)}`);
  return parts.join(" · ");
}

function cellValue(field: FieldDef, raw: unknown, a: Answers): ExcelJS.CellValue {
  if (raw === undefined || raw === null || raw === "") return null;
  if (typeof raw === "string") {
    if (field.type === "money" || field.type === "percent") {
      const n = parseAmount(raw.replace("%", ""));
      if (n !== null) return n;
    }
    if (field.type === "integer" && /^\d+$/.test(raw.replace(/['’\s]/g, ""))) return Number(raw.replace(/['’\s]/g, ""));
    if (field.type === "date") {
      const parts = parseDate(raw);
      if (parts) return dateToUtc(parts);
    }
  }
  return displayValue(field, raw, "fr", a);
}

function styleCell(cell: ExcelJS.Cell, field?: FieldDef) {
  if (!field) return;
  if (field.type === "money") cell.numFmt = MONEY;
  if (field.type === "date") cell.numFmt = "dd.mm.yyyy";
  if (field.type === "percent") cell.numFmt = "0.##";
}

function title(ws: ExcelJS.Worksheet, text: string, subtitle?: string) {
  ws.addRow([text]).font = { bold: true, size: 14, color: { argb: NAVY } };
  if (subtitle) ws.addRow([subtitle]).font = { italic: true, color: { argb: "FF6B7280" } };
  ws.addRow([]);
}

function headerRow(ws: ExcelJS.Worksheet, values: string[]) {
  const row = ws.addRow(values);
  row.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: NAVY } };
    cell.alignment = { vertical: "middle", wrapText: true };
  });
  return row;
}

function kv(ws: ExcelJS.Worksheet, key: string, value: ExcelJS.CellValue, field?: FieldDef) {
  if (value === null || value === undefined || value === "") return;
  const row = ws.addRow([key, value]);
  row.getCell(1).font = { bold: true };
  row.getCell(1).alignment = { vertical: "top", wrapText: true };
  row.getCell(2).alignment = { vertical: "top", wrapText: true };
  styleCell(row.getCell(2), field);
}

const link = (text: string, url: string): ExcelJS.CellValue => (url.startsWith("https://") ? { text, hyperlink: url } : text);

function sheetName(wb: ExcelJS.Workbook, wanted: string) {
  const base = wanted.replace(/[[\]:*?/\\]/g, " ").slice(0, 31).trim() || "Feuille";
  let name = base;
  for (let i = 2; wb.getWorksheet(name); i++) name = `${base.slice(0, 28)} ${i}`;
  return name;
}

export const excelFileName = (a: Answers) =>
  `Questionnaire fiscal ${taxYearOf(a)} - ${str(a["start.lastName"]).toUpperCase()} ${str(a["start.firstName"])}`.trim();

export async function buildWorkbook(record: SubmissionRecord): Promise<Uint8Array> {
  const a = record.answers;
  const L = (text: Parameters<typeof label>[0]) => label(text, "fr", a);
  const wb = new ExcelJS.Workbook();
  wb.creator = "Ark Fiduciaire – questionnaire fiscal";
  wb.created = record.submittedAt;
  const year = taxYearOf(a);
  const fullName = `${str(a["start.lastName"]).toUpperCase()} ${str(a["start.firstName"])}`.trim();
  const fv = (id: string) => {
    const def = getField(id);
    return def ? cellValue(def, a[id], a) : null;
  };

  // ---- Synthèse
  const summary = wb.addWorksheet("Synthèse", { views: [{ state: "frozen", ySplit: 3 }] });
  summary.columns = [{ width: 38 }, { width: 80 }];
  title(summary, `Questionnaire fiscal ${year} – ${fullName}`, `Reçu le ${nowSwiss(record.submittedAt)} · réf. ${record.sid}`);
  const section = (text: string) => {
    summary.addRow([]);
    const row = summary.addRow([text, ""]);
    row.font = { bold: true, color: { argb: NAVY } };
    row.eachCell((cell) => (cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: LIGHT } }));
  };
  section("Client");
  kv(summary, "Nom, prénom", fullName);
  kv(summary, "Conjoint(e)", `${str(a["start.spouseLastName"]).toUpperCase()} ${str(a["start.spouseFirstName"])}`.trim());
  kv(summary, "Ménage", fv("start.household"));
  kv(summary, "E-mail", str(a["start.email"]));
  kv(summary, "Téléphone", str(a["start.phone"]));
  kv(summary, "Langue des réponses", LANG_FR[record.locale]);
  kv(summary, "Dernière déclaration", fv("start.status"));
  kv(summary, "Précédent mandataire", str(a["start.previousPreparer"]));
  kv(summary, "N° de contribuable", str(a["base.taxNumber"]));
  kv(summary, "Clé client", record.clientKey);
  section("Période et régime");
  kv(summary, "Année(s) fiscale(s)", selectedYears(a).join(", "));
  kv(summary, "Canton au 31.12", fv("start.canton"));
  kv(summary, "Commune", str(a["start.commune"]));
  kv(summary, "Régime", regimeSummary(a));
  kv(summary, "Permis", fv("regime.permit"));
  kv(summary, "Arrivée", [str(a["regime.arrivalDate"]), str(a["regime.arrivalFrom"])].filter(Boolean).join(" – depuis "));
  kv(summary, "Départ", [str(a["regime.departureDate"]), str(a["regime.departureTo"])].filter(Boolean).join(" – vers "));
  kv(summary, "Pays de domicile", str(a["regime.country"]));
  section("Situation déclarée");
  const items = new Set(routerItems(a));
  const unchangedGroups = Array.isArray(a["router.unchanged"]) ? (a["router.unchanged"] as string[]) : [];
  for (const group of ROUTER_GROUPS) {
    const selected = ROUTER_OPTIONS.filter((o) => o.group === group.id && items.has(o.value)).map((o) => L(o.label));
    const value = [unchangedGroups.includes(group.id) ? "Inchangé depuis la dernière déclaration" : "", ...selected].filter(Boolean).join(" ; ");
    kv(summary, group.label.fr, value || "—");
  }
  kv(summary, "Enfants", rowsOf(a, "family.children").length || null);
  kv(summary, "Biens immobiliers", rowsOf(a, "property.items").length || null);
  section("Documents");
  const count = (status: DocStatus) => record.docs.filter((d) => d.status === status).length;
  kv(summary, "Reçus", count("uploaded"));
  kv(summary, "Envoi ultérieur annoncé", count("later"));
  kv(summary, "Non applicable (selon le client)", count("na"));
  kv(summary, "Non reçus", count("missing"));
  kv(summary, "Documents complémentaires", record.extras.length || null);
  if (record.flagged.length) kv(summary, "Fichiers à vérifier", `${record.flagged.length} (voir feuille Documents)`);
  kv(summary, "Dossier SharePoint", link(record.folderName, record.folderUrl));
  section("Suivi");
  kv(summary, "Délai", [fv("review.deadline"), str(a["review.extendedTo"])].filter(Boolean).join(" – "));
  kv(summary, "Rappel annuel souhaité", a["review.reminder"] === "yes" ? "Oui" : "Non");
  kv(summary, "Remarques du client", str(a["review.comments"]));
  kv(summary, "Comment nous a connus", fv("review.heardFrom"));
  kv(summary, "Certification", `Exactitude et intégralité certifiées le ${nowSwiss(record.submittedAt)} ; notice de confidentialité ${record.privacyVersion} acceptée.`);

  // ---- Points d'attention
  const attention = wb.addWorksheet("Points d'attention");
  attention.columns = [{ width: 12 }, { width: 110 }];
  title(attention, "Points d'attention pour la préparation");
  headerRow(attention, ["Priorité", "Point"]);
  const points = attentionPoints(a);
  for (const point of points) {
    const row = attention.addRow([point.level === "high" ? "Élevée" : "Normale", point.text]);
    row.alignment = { vertical: "top", wrapText: true };
    if (point.level === "high") row.getCell(1).font = { bold: true, color: { argb: "FFB91C1C" } };
  }
  if (points.length === 0) attention.addRow(["", "Aucun point particulier signalé par les réponses."]).font = { italic: true };

  // ---- One sheet per answered screen
  for (const step of visibleSteps(a)) {
    if (step.id === "start" || step.special === "documents" || step.id === "router") continue;
    const ws = wb.addWorksheet(sheetName(wb, step.sheet));
    ws.columns = [{ width: 50 }, { width: 50 }];
    title(ws, L(step.title));
    let wrote = false;
    for (const block of step.blocks) {
      if (!isBlockVisible(block, a)) continue;
      if (block.kind === "heading") {
        ws.addRow([L(block.label)]).font = { bold: true, color: { argb: NAVY } };
        continue;
      }
      if (block.kind === "field") {
        if (block.hidden) continue;
        const value = cellValue(block, a[block.id], a);
        if (value !== null && value !== "") {
          kv(ws, L(block.label), value, block);
          wrote = true;
        }
        continue;
      }
      if (block.kind !== "group" || block.hidden) continue;
      const list = rowsOf(a, block.id);
      if (list.length === 0) continue;
      wrote = true;
      ws.addRow([]);
      ws.addRow([L(block.label)]).font = { bold: true };
      const columns = block.fields.filter((f) => !f.hidden && list.some((row) => isRowFieldVisible(f, a, row) && row[f.id] !== undefined));
      // Renewal: reconduit / nouveau / terminé (date) / modifié, per item.
      const status = renewalContext(a) ? (row: Row) => renewalStatusFr(row) : null;
      if (columns.length > 8) {
        // Wide cards (real estate): one label/value block per row, easier to read than 40 columns.
        list.forEach((row, index) => {
          ws.addRow([`${L(block.itemLabel)} ${index + 1}${status ? ` – ${status(row)}` : ""}`]).font = { bold: true, color: { argb: NAVY } };
          for (const f of columns) if (isRowFieldVisible(f, a, row)) kv(ws, L(f.label), cellValue(f, row[f.id], a), f);
        });
        continue;
      }
      headerRow(ws, ["#", ...(status ? ["Statut"] : []), ...columns.map((f) => L(f.label))]);
      list.forEach((row, index) => {
        const excelRow = ws.addRow([index + 1, ...(status ? [status(row)] : []), ...columns.map((f) => (isRowFieldVisible(f, a, row) ? cellValue(f, row[f.id], a) : null))]);
        columns.forEach((f, i) => styleCell(excelRow.getCell(i + 2 + (status ? 1 : 0)), f));
        excelRow.alignment = { vertical: "top", wrapText: true };
      });
      for (let i = 2; i <= columns.length + 1 + (status ? 1 : 0); i++) ws.getColumn(i).width = Math.max(ws.getColumn(i).width || 0, 20);
    }
    if (!wrote) ws.addRow(["(aucune réponse)"]).font = { italic: true };
  }

  // ---- Documents
  const docs = wb.addWorksheet("Documents", { views: [{ state: "frozen", ySplit: 4 }] });
  docs.columns = [{ width: 24 }, { width: 70 }, { width: 26 }, { width: 60 }, { width: 12 }];
  title(docs, "Documents", `Dossier : ${record.folderName}`);
  headerRow(docs, ["Catégorie", "Document", "Statut", "Fichier (lien SharePoint)", "Taille (Ko)"]);
  const flaggedIds = new Map(record.flagged.map((f) => [f.file.id, f.reason]));
  const fileRow = (category: string, docLabel: string, status: string, file?: StoredFile) => {
    const reason = file ? flaggedIds.get(file.id) : undefined;
    const row = docs.addRow([category, docLabel, reason ? `${status} – À VÉRIFIER : ${reason}` : status, file ? link(file.name, file.webUrl) : "", file ? Math.max(1, Math.round(file.size / 1024)) : null]);
    row.alignment = { vertical: "top", wrapText: true };
    if (reason) row.getCell(3).font = { bold: true, color: { argb: "FFB91C1C" } };
    if (file?.webUrl.startsWith("https://")) row.getCell(4).font = { color: { argb: "FF1D4ED8" }, underline: true };
  };
  for (const doc of record.docs) {
    const category = DOC_CATEGORIES[doc.item.category].label.fr;
    if (doc.files.length === 0) fileRow(category, doc.item.label.fr, STATUS_FR[doc.status]);
    for (const file of doc.files) fileRow(category, doc.item.label.fr, STATUS_FR[doc.status], file);
  }
  for (const file of record.extras) fileRow(DOC_CATEGORIES.extra.label.fr, "Document ajouté par le client", "Reçu", file);
  for (const { file } of record.flagged) fileRow("Fichiers à vérifier", "Fichier écarté du dossier (sous-dossier _A verifier)", "À vérifier", file);
  docs.autoFilter = { from: { row: 4, column: 1 }, to: { row: 4, column: 5 } };

  // ---- À demander
  const todo = wb.addWorksheet("À demander");
  todo.columns = [{ width: 30 }, { width: 80 }, { width: 28 }];
  title(todo, `Documents à demander – ${fullName}`, `${str(a["start.email"])} · ${str(a["start.phone"])}`);
  headerRow(todo, ["Catégorie", "Document", "Statut"]);
  const pending = record.docs.filter((d) => d.status === "later" || d.status === "missing");
  for (const doc of pending) todo.addRow([DOC_CATEGORIES[doc.item.category].label.fr, doc.item.label.fr, STATUS_FR[doc.status]]).alignment = { vertical: "top", wrapText: true };
  if (pending.length === 0) todo.addRow(["", "Aucun document attendu."]).font = { italic: true };

  const buffer = await wb.xlsx.writeBuffer();
  return new Uint8Array(buffer as ArrayBuffer);
}
