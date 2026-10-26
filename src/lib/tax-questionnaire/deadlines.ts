/**
 * Deadline engine. The table below is yearly, sourced and editable: re-check it every January
 * (verifiedOn). Only verified cantons carry a date; elsewhere the client is told to look at the
 * date on the tax return / letter from the administration. Staff can override per return
 * ("délai obtenu jusqu'au", ReturnRecord.extendedTo), which takes precedence.
 */
import { taxYearOf } from "./documents";
import { formatDate, parseDate } from "./format";
import { livesAbroadAllYear, sourceTaxed } from "./schema";
import { t, type Answers, type L } from "./types";

export interface CantonDeadline {
  canton: string;
  /** Ordinary filing deadline in year N+1, "MM-DD"; null = not verified (see note). */
  ordinary: string | null;
  extension: L;
  source: string;
  verifiedOn: string;
}

const VERIFIED_ON = "2026-10-26";

export const CANTON_DEADLINES: CantonDeadline[] = [
  {
    canton: "GE",
    ordinary: "03-31",
    extension: t(
      "Prolongation possible en ligne (pour la déclaration 2025 : jusqu'au 30.10.2026).",
      "Extension possible online (for the 2025 return: until 30.10.2026).",
      "Fristerstreckung online möglich (für die Steuererklärung 2025: bis 30.10.2026).",
    ),
    source: "https://www.ge.ch/document/42643/telecharger",
    verifiedOn: VERIFIED_ON,
  },
  {
    canton: "VD",
    ordinary: "03-15",
    extension: t(
      "Tolérance jusqu'au 30 juin ; prolongation gratuite possible jusqu'au 30 septembre.",
      "Tolerance until 30 June; free extension possible until 30 September.",
      "Toleranz bis 30. Juni; kostenlose Fristerstreckung bis 30. September möglich.",
    ),
    source: "https://www.vd.ch/e-delai",
    verifiedOn: VERIFIED_ON,
  },
];

const UNKNOWN_NOTE = t(
  "Date indiquée sur votre déclaration ou sur le courrier de l'administration fiscale.",
  "Date shown on your tax return or on the tax authority's letter.",
  "Datum gemäss Steuererklärung oder Schreiben der Steuerverwaltung.",
);

export interface Deadline {
  id: string;
  label: L;
  date: string | null; // dd.mm.yyyy
  level: "high" | "normal";
  note?: L;
  source?: string;
}

const str = (v: unknown) => (typeof v === "string" ? v : "");
const pad = (n: number) => String(n).padStart(2, "0");

export const cantonDeadline = (canton: string) => CANTON_DEADLINES.find((c) => c.canton === canton) || null;

function ordinaryDate(canton: string, taxYear: number): string | null {
  const entry = cantonDeadline(canton);
  if (!entry?.ordinary) return null;
  const [month, day] = entry.ordinary.split("-").map(Number);
  return `${pad(day)}.${pad(month)}.${taxYear + 1}`;
}

function addDays(ddmmyyyy: string, days: number): string | null {
  const parts = parseDate(ddmmyyyy);
  if (!parts) return null;
  const d = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + days));
  return formatDate({ day: d.getUTCDate(), month: d.getUTCMonth() + 1, year: d.getUTCFullYear() });
}

export function deadlinesFor(a: Answers, opts: { extendedTo?: string; now?: Date } = {}): Deadline[] {
  const year = taxYearOf(a);
  const canton = str(a["start.canton"]);
  const out: Deadline[] = [];

  if (sourceTaxed(a)) {
    out.push({
      id: "tou",
      label: t(
        "Demande de taxation ordinaire ultérieure ou de rectification de l'impôt à la source",
        "Request for subsequent ordinary assessment or correction of the tax at source",
        "Antrag auf nachträgliche ordentliche Veranlagung oder Berichtigung der Quellensteuer",
      ),
      date: `31.03.${year + 1}`,
      level: "high",
      note: t("Non prolongeable.", "Cannot be extended.", "Nicht erstreckbar."),
    });
  }

  if (a["start.avisReceived"] === "yes") {
    const date = addDays(str(a["start.avisDate"]), 30);
    out.push({
      id: "reclamation",
      label: t("Délai de réclamation (30 jours dès la notification)", "Objection deadline (30 days from notification)", "Einsprachefrist (30 Tage ab Zustellung)"),
      date,
      level: "high",
      note: t("À vérifier selon la date de notification effective.", "To be checked against the actual notification date.", "Gemäss tatsächlichem Zustelldatum zu prüfen."),
    });
  }

  const extended = opts.extendedTo && parseDate(opts.extendedTo) ? formatDate(parseDate(opts.extendedTo)!) : null;
  if (extended) {
    out.push({
      id: "extension",
      label: t("Délai de dépôt prolongé", "Extended filing deadline", "Erstreckte Einreichefrist"),
      date: extended,
      level: "normal",
      note: t("Prolongation obtenue par Ark.", "Extension obtained by Ark.", "Von Ark erwirkte Fristerstreckung."),
    });
  } else if (livesAbroadAllYear(a) || !canton || canton === "ABROAD") {
    out.push({ id: "ordinary", label: t("Dépôt de la déclaration", "Filing the tax return", "Einreichung der Steuererklärung"), date: null, level: "normal", note: UNKNOWN_NOTE });
  } else {
    const entry = cantonDeadline(canton);
    out.push({
      id: "ordinary",
      label: t("Dépôt de la déclaration (délai ordinaire)", "Filing the tax return (ordinary deadline)", "Einreichung der Steuererklärung (ordentliche Frist)"),
      date: ordinaryDate(canton, year),
      level: "normal",
      note: entry ? entry.extension : UNKNOWN_NOTE,
      source: entry?.source,
    });
  }
  return out;
}

const toUtc = (ddmmyyyy: string | null) => {
  const p = ddmmyyyy ? parseDate(ddmmyyyy) : null;
  return p ? new Date(Date.UTC(p.year, p.month - 1, p.day)) : null;
};

/**
 * Date after which campaign reminders stop for a return: staff extension, else the canton's
 * ordinary deadline, else (unknown canton) 31 March N+1; source-taxed returns: 31 March N+1.
 */
export function campaignStopDate(input: Answers | { canton: string; regime?: string }, taxYear: number, extendedTo?: string): Date {
  const extended = extendedTo ? toUtc(extendedTo) : null;
  if (extended) return extended;
  // A tracker record ({canton, regime}) or questionnaire answers ("start.canton"…).
  const plain = typeof (input as { canton?: unknown }).canton === "string";
  const canton = plain ? (input as { canton: string }).canton : str((input as Answers)["start.canton"]);
  // Tracker regime text comes from regimeSummary() ("… impôt à la source …").
  const source = plain ? /source/i.test((input as { regime?: string }).regime || "") : sourceTaxed(input as Answers);
  if (source) return new Date(Date.UTC(taxYear + 1, 2, 31));
  return toUtc(ordinaryDate(canton, taxYear)) || new Date(Date.UTC(taxYear + 1, 2, 31));
}
