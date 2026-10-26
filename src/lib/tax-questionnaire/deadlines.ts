/**
 * Deadline engine. The table below is yearly, sourced and editable: re-check it every January
 * (verifiedOn). Only verified cantons carry a date; elsewhere the client is told to look at the
 * date on the tax return / letter from the administration. Staff can override per return
 * ("délai obtenu jusqu'au", ReturnRecord.extendedTo), which takes precedence.
 */
import { taxYearOf } from "./documents";
import { formatDate, parseDate } from "./format";
import { has, left, livesAbroadAllYear, sourceTaxed, sourceTaxedResident } from "./schema";
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
      "Une prolongation (payante, selon la durée) peut être demandée en ligne du 1er janvier au 31 octobre ; elle ne vaut qu'une fois confirmée par l'administration. Du 1er novembre au 31 décembre, demande motivée par courrier.",
      "An extension (fee depending on its length) can be requested online from 1 January to 31 October; it only applies once the tax authority confirms it. From 1 November to 31 December, a reasoned request by letter.",
      "Eine Fristerstreckung (Gebühr je nach Dauer) kann vom 1. Januar bis 31. Oktober online beantragt werden; sie gilt erst nach Bestätigung der Steuerverwaltung. Vom 1. November bis 31. Dezember begründetes Gesuch per Post.",
    ),
    source: "https://www.ge.ch/lc/delai-decla",
    verifiedOn: VERIFIED_ON,
  },
  {
    canton: "VD",
    ordinary: "03-15",
    extension: t(
      "Assujettissement illimité : tolérance jusqu'au 30 juin ; une demande gratuite, déposée en ligne entre le 16 mai et le 30 juin, peut être accordée jusqu'au 30 septembre. Assujettissement limité : tolérance jusqu'au 30 novembre. Départ ou forfait : demande par courrier.",
      "Unlimited tax liability: tolerance until 30 June; a free online request filed between 16 May and 30 June may be granted until 30 September. Limited liability: tolerance until 30 November. Departure or lump-sum: request by letter.",
      "Unbeschränkte Steuerpflicht: Toleranz bis 30. Juni; ein kostenloses Online-Gesuch zwischen 16. Mai und 30. Juni kann bis 30. September bewilligt werden. Beschränkte Steuerpflicht: Toleranz bis 30. November. Wegzug oder Pauschalbesteuerung: Gesuch per Post.",
    ),
    source: "https://www.vd.ch/prestation/demander-un-delai-pour-le-depot-de-la-declaration-dimpot-pour-les-individus-personnes-physiques-et-les-societes-personnes-morales",
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
  // A deadline ending on a Saturday or Sunday moves to the next Monday (public holidays not handled: indicative).
  while (d.getUTCDay() === 0 || d.getUTCDay() === 6) d.setUTCDate(d.getUTCDate() + 1);
  return formatDate({ day: d.getUTCDate(), month: d.getUTCMonth() + 1, year: d.getUTCFullYear() });
}

export function deadlinesFor(a: Answers, opts: { extendedTo?: string; now?: Date } = {}): Deadline[] {
  const year = taxYearOf(a);
  const canton = str(a["start.canton"]);
  const out: Deadline[] = [];

  // TOU d'office (resident, salary ≥ CHF 120'000): no request to file, so no 31 March request deadline.
  const touOffice = sourceTaxedResident(a) && a["regime.over120k"] === "yes";
  if (sourceTaxed(a) && !touOffice) {
    out.push({
      id: "tou",
      label: t(
        "Demande de taxation ordinaire ultérieure ou de rectification de l'impôt à la source",
        "Request for subsequent ordinary assessment or correction of the tax at source",
        "Antrag auf nachträgliche ordentliche Veranlagung oder Berichtigung der Quellensteuer",
      ),
      date: `31.03.${year + 1}`,
      level: "high",
      note: left(a)
        ? t("Non prolongeable. En cas de départ de Suisse, au plus tard au moment de l'annonce du départ.", "Cannot be extended. When leaving Switzerland, at the latest when you deregister.", "Nicht erstreckbar. Bei Wegzug spätestens mit der Abmeldung.")
        : t("Non prolongeable.", "Cannot be extended.", "Nicht erstreckbar."),
    });
  }

  if (a["start.avisReceived"] === "yes") {
    const date = addDays(str(a["start.avisDate"]), 30);
    out.push({
      id: "reclamation",
      label: t("Délai de réclamation (indicatif)", "Objection deadline (indicative)", "Einsprachefrist (Richtwert)"),
      date,
      level: "high",
      note: t(
        "30 jours dès le lendemain de la réception de l'avis ; reporté au lundi si le dernier jour tombe un samedi ou un dimanche (jours fériés : à vérifier). Conservez l'enveloppe.",
        "30 days from the day after you received the notice; moved to Monday if the last day is a Saturday or Sunday (public holidays: to be checked). Keep the envelope.",
        "30 Tage ab dem Tag nach Erhalt der Verfügung; fällt der letzte Tag auf einen Samstag oder Sonntag, auf den Montag verschoben (Feiertage: zu prüfen). Bewahren Sie den Umschlag auf.",
      ),
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
  } else if (livesAbroadAllYear(a) || !canton || canton === "ABROAD" || left(a) || (has("civilChange")(a) && a["family.changeType"] === "death")) {
    // Non-residents, departures and deaths: special deadline set by the tax authority.
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
  // A tracker record ({canton, regime}) or questionnaire answers ("start.canton"…).
  const plain = typeof (input as { canton?: unknown }).canton === "string";
  const canton = plain ? (input as { canton: string }).canton : str((input as Answers)["start.canton"]);
  // Tracker regime text comes from regimeSummary() ("… impôt à la source …").
  const source = plain
    ? /source/i.test((input as { regime?: string }).regime || "") && !/TOU obligatoire/i.test((input as { regime?: string }).regime || "")
    : sourceTaxed(input as Answers) && !(sourceTaxedResident(input as Answers) && (input as Answers)["regime.over120k"] === "yes");
  // The TOU / rectification deadline is never extended by an ordinary filing extension.
  if (source) return new Date(Date.UTC(taxYear + 1, 2, 31));
  if (extended) return extended;
  // Unverified canton: internal reminder horizon only (never shown to the client as a deadline).
  return toUtc(ordinaryDate(canton, taxYear)) || new Date(Date.UTC(taxYear + 1, 2, 31));
}
