/**
 * "Points d'attention": special situations flagged for the preparer (Excel sheet and internal
 * email). French only, internal. Wording: things to check, not legal conclusions.
 */
import { selectedYears, taxYearOf } from "./documents";
import {
  arrived,
  has,
  isCouple,
  isLumpSum,
  left,
  livesAbroadAllYear,
  needsGeValuation,
  nonResidentReasons,
  rowsOf,
  sourceTaxed,
  sourceTaxedResident,
  worksInSwitzerlandFromAbroad,
} from "./schema";
import type { Answers, Row } from "./types";

export interface AttentionPoint {
  id: string;
  /** "high": deadline or risk; "normal": to check. */
  level: "high" | "normal";
  text: string;
}

const str = (v: unknown) => (typeof v === "string" ? v : "");
const arr = (v: unknown): string[] => (Array.isArray(v) ? (v as string[]) : []);
const rowsWhere = (a: Answers, group: string, pred: (row: Row) => boolean) => rowsOf(a, group).filter(pred);
const place = (row: Row) => (row.where === "CH" ? `${str(row.commune)} (${str(row.canton)})` : `${str(row.city)} (${str(row.country)})`);

export function attentionPoints(a: Answers): AttentionPoint[] {
  const year = taxYearOf(a);
  const out: AttentionPoint[] = [];
  const add = (id: string, level: AttentionPoint["level"], text: string) => out.push({ id, level, text });

  const older = selectedYears(a).slice(1);
  if (older.length) add("arrears", "high", `Années en retard à traiter : ${older.join(", ")} (vérifier les sommations / taxations d'office éventuelles).`);
  if (has("regularisation")(a)) add("regularisation", "high", `Régularisation demandée (${str(a["other.regularisationYears"]) || "années non précisées"}) : appeler le client avant toute démarche ; vérifier les conditions d'une dénonciation spontanée non punissable (autorité non informée, collaboration, paiement) et les années concernées.`);

  // Regime
  if (arrived(a)) add("arrival", "normal", `Arrivée en Suisse le ${str(a["regime.arrivalDate"]) || "?"} : assujettissement partiel (prorata), revenus étrangers avant l'arrivée, éventuel régime d'expatrié.`);
  if (left(a)) add("departure", "high", `Départ de Suisse le ${str(a["regime.departureDate"]) || "?"} : assujettissement partiel, capitaux de prévoyance, adresse de notification / représentant, biens restant en Suisse.`);
  if (sourceTaxedResident(a)) {
    const mandatory = a["regime.over120k"] === "yes";
    add("tou", "high", `Imposé(e) à la source (résident) : ${mandatory ? "TOU obligatoire (salaire ≥ CHF 120'000 indiqué)" : `TOU sur demande (souhait : ${str(a["regime.touWish"]) || "non indiqué"})`}. Demande de TOU / rectification au plus tard le 31.03.${year + 1} (délai non prolongeable).`);
  }
  if (sourceTaxed(a) && worksInSwitzerlandFromAbroad(a)) {
    add("nonResidentWorker", "high", `Travailleur non résident (${str(a["regime.country"])}, canton de travail ${str(a["regime.workCanton"])}) : vérifier l'accord frontalier applicable, le statut de quasi-résident (≥ 90 % des revenus mondiaux du ménage imposables en Suisse ; revenus hors CH : ${str(a["regime.foreignHouseholdIncome"]) || "?"}) et le délai du 31.03.${year + 1}.`);
  }
  if (livesAbroadAllYear(a) && !worksInSwitzerlandFromAbroad(a)) add("nonResident", "normal", `Non résident, rattachement économique : ${nonResidentReasons(a).join(", ") || "?"} ; répartition internationale et représentant fiscal à vérifier.`);
  if (isLumpSum(a)) add("lumpSum", "high", `Imposition d'après la dépense : calcul de contrôle (éléments suisses), ruling ${a["lumpSum.ruling"] === "yes" ? "disponible" : "non disponible"}, éventuel forfait modifié (CDI : ${str(a["lumpSum.treaty"]) || "?"}).`);

  // Family
  if (has("civilChange")(a)) add("civilChange", "high", `Changement d'état civil (${str(a["family.changeType"])}) le ${str(a["family.changeDate"])} : effet sur l'imposition commune ou séparée de toute l'année à vérifier, pensions et enfants.`);
  if (isCouple(a) && has("alimonyReceived")(a)) add("alimonyCouple", "normal", "Couple et pension reçue : vérifier s'il s'agit d'une pension d'un ex-conjoint ou pour un enfant d'une autre union.");
  if (rowsOf(a, "family.children").some((r) => r.custody === "alternating")) add("alternating", "normal", "Garde alternée : répartition des déductions pour enfants et des frais de garde entre parents.");

  // Work and pensions
  if (has("equity")(a)) add("equity", "normal", `Plans de participation : événements ${arr(a["work.equityEvents"]).join(", ") || "?"} ; vérifier l'imposition proportionnelle si travail hors de Suisse pendant l'acquisition (${str(a["work.equityAbroad"]) || "?"}).`);
  if (a["work.expat"] === "yes") add("expat", "normal", "Détachement temporaire annoncé : vérifier l'application de l'ordonnance sur les expatriés (frais particuliers).");
  if (has("selfEmployed")(a) && a["work.selfStarted"] === "yes") add("selfStart", "normal", "Début d'activité indépendante dans l'année : affiliation AVS, inscription TVA/RC, prévoyance.");
  if (has("companyOwner")(a)) {
    const dividends = rowsWhere(a, "work.companies", (r) => r.dividend === "yes").length;
    add("company", "normal", `Participations : estimation des titres non cotés, ${dividends ? "dividendes (imposition partielle si participation qualifiée), " : ""}prêts actionnaire / prestations appréciables en argent.`);
    if (rowsWhere(a, "work.companies", (r) => r.holdsProperty === "yes").length) add("companyProperty", "normal", "Bien détenu par la société et utilisé par l'actionnaire : vérifier le loyer / la prestation appréciable en argent.");
  }
  if (has("capital")(a)) add("capital", "normal", "Capital de prévoyance : imposition séparée ; date et motif du versement ; lien avec d'éventuels rachats LPP récents.");
  if (has("lppBuyin")(a) && (has("capital")(a) || ["yes", "unknown"].includes(str(a["other.lppPlannedWithdrawal"])))) add("lpp3years", "high", "Rachat LPP et retrait en capital (effectué ou prévu) : vérifier le délai de trois ans et ses conséquences sur la déduction.");
  if (has("severance")(a)) add("severance", "normal", "Indemnité de départ : qualifier la nature (salaire, prestation de prévoyance) pour l'imposition.");

  // Assets
  if (has("banksForeign")(a) || rowsOf(a, "assets.banks").some((r) => r.country === "other")) add("foreignAccounts", "normal", "Comptes à l'étranger : déclaration complète, revenus et impôts étrangers (DA-1 / remboursements).");
  if (has("crypto")(a)) add("crypto", "normal", `Cryptoactifs : valeurs au 31.12.${year} (cours de l'AFC), revenus de staking/lending ; qualification de commerçant à vérifier si activité soutenue.`);
  if (a["assets.trading"] === "yes") add("trader", "normal", "Transactions fréquentes avec levier : vérifier la qualification de commerçant professionnel de titres.");
  if (has("usPerson")(a)) add("usPerson", "normal", "Personne US : obligations fiscales américaines en parallèle (hors mandat suisse, à signaler).");
  if (has("trust")(a)) add("trust", "normal", "Trust / fondation : qualification (révocable, discrétionnaire…) et attribution des revenus et de la fortune.");
  if (has("inheritance")(a)) add("inheritance", "normal", "Héritage / donation : impôt sur les successions ou donations du canton concerné, hoirie non partagée, usufruit.");

  // Real estate
  for (const row of rowsOf(a, "property.items")) {
    const where = place(row);
    const events = arr(row.events);
    if (events.includes("sold")) add(`sale:${row._id}`, "high", `Vente de ${where} : impôt sur les gains immobiliers (procédure séparée du canton/pays de situation), coûts d'acquisition et investissements à plus-value.`);
    if (events.includes("bought")) add(`purchase:${row._id}`, "normal", `Achat de ${where} : droits de mutation, frais de notaire et hypothèques ; nouvelle estimation fiscale.`);
    if (events.includes("works") || arr(row.workTypes).some((w) => ["improvement", "energy", "demolition", "heritage"].includes(w))) add(`works:${row._id}`, "normal", `Travaux sur ${where} : répartir entretien / plus-value / économies d'énergie / démolition / monument historique ; report éventuel des frais sur les périodes suivantes.`);
    if (needsGeValuation(a, row)) add(`geValuation:${row._id}`, "normal", `Genève, ${where} : questionnaire de valeur locative à établir ${row.geFill === "later" ? "(données à demander au client)" : "(données fournies)"}.`);
    if (row.where === "abroad") add(`foreignProperty:${row._id}`, "normal", `Bien à l'étranger (${where}) : pris en compte pour le taux ; répartition des dettes et intérêts ; impôts étrangers.`);
    if (["usufruct", "bareOwner"].includes(str(row.ownership))) add(`usufruct:${row._id}`, "normal", `Usufruit / droit d'habitation sur ${where} : l'usufruitier déclare en général la valeur et le rendement ; à vérifier.`);
    if (row.ownership === "company") add(`companyHeld:${row._id}`, "normal", `${where} détenu par une société : vérifier le traitement dans les comptes de la société et l'usage privé.`);
    if (arr(row.uses).includes("relatives")) add(`relatives:${row._id}`, "normal", `${where} mis à disposition de proches : valeur locative ou loyer réduit à examiner.`);
    if (row.furnished === "yes") add(`furnished:${row._id}`, "normal", `${where} loué meublé / courte durée : revenus, taxe de séjour, frais.`);
  }

  return out;
}
