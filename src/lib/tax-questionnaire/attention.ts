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
  if (has("regularisation")(a)) {
    add("regularisation", "high", `Régularisation demandée (${str(a["regularisation.years"]) || "années non précisées"}) : appeler le client avant toute démarche. Autorité déjà en contact : ${str(a["regularisation.authorityContact"]) || "?"} ; régularisation antérieure : ${str(a["regularisation.priorDisclosure"]) || "?"} (l'exemption de peine n'est possible qu'une fois et si l'autorité n'a pas connaissance des faits — à vérifier).`);
  }
  if (a["start.yearsChanged"] === "yes" || a["start.yearsChanged"] === "unknown") add("yearsChanged", "normal", "Plusieurs années demandées et situation possiblement différente entre elles : appeler le client.");
  if (a["start.avisReceived"] === "yes") add("avisReceived", "high", `Avis de taxation ${year} déjà reçu (daté du ${str(a["start.avisDate"]) || "?"}) : il s'agit d'une réclamation (30 jours dès la notification), pas d'une déclaration.`);
  if (a["start.status"] === "filedBefore" && str(a["start.previousPreparer"])) add("previousPreparer", "normal", `Précédent mandataire : ${str(a["start.previousPreparer"])} — obtenir le dossier de l'an dernier (${str(a["start.previousFile"]) || "?"}) et vérifier une éventuelle procuration à révoquer.`);
  if (isCouple(a) && a["start.spouseAbroad"] === "yes") add("spouseAbroad", "high", "Conjoint domicilié à l'étranger : assujettissement et détermination du taux à vérifier.");

  // Regime
  if (arrived(a)) add("arrival", "normal", `Arrivée en Suisse le ${str(a["regime.arrivalDate"]) || "?"} depuis ${str(a["regime.arrivalFrom"]) || "?"} : assujettissement partiel, revenus avant l'arrivée, déclaration de départ dans l'ancien pays (${str(a["regime.exitFiled"]) || "?"}).`);
  if (left(a)) add("departure", "high", `Départ de Suisse le ${str(a["regime.departureDate"]) || "?"} vers ${str(a["regime.departureTo"]) || "?"} : assujettissement partiel, adresse de notification / représentant ; éléments conservés en Suisse : ${arr(a["regime.keepsInSwitzerland"]).join(", ") || "?"}.`);
  if (a["regime.cantonMove"] === "yes") add("cantonMove", "normal", `Changement de canton en cours d'année (depuis ${str(a["regime.fromCanton"])}, le ${str(a["regime.cantonMoveDate"]) || "?"}) : canton compétent au 31.12, règles intercantonales pour immeubles et activité indépendante.`);
  if (sourceTaxedResident(a)) {
    const mandatory = a["regime.over120k"] === "yes";
    add("tou", "high", `[TOU 31.03] Imposé(e) à la source (résident, canton employeur ${str(a["regime.employerCanton"]) || "?"}) : ${mandatory ? "TOU obligatoire (salaire ≥ CHF 120'000 indiqué)" : "TOU sur demande"} ; demande du client : ${str(a["regime.sourceRequest"]) || "non indiquée"}. Demande de TOU / rectification au plus tard le 31.03.${year + 1} (forclusion) — confirmer le mandat sans délai.`);
  }
  if (sourceTaxed(a) && worksInSwitzerlandFromAbroad(a)) {
    add("nonResidentWorker", "high", `[TOU 31.03] Travailleur non résident (${str(a["regime.country"])}, canton de travail ${str(a["regime.workCanton"])}, retour quotidien ${str(a["regime.dailyReturn"]) || "?"}, télétravail à l'étranger ${str(a["regime.homeOfficeAbroad"]) || "?"} %) : accord frontalier applicable, quasi-résidence à examiner (au moins 90 % des revenus mondiaux du ménage imposables en Suisse ; conjoint travaille en Suisse : ${str(a["regime.spouseWorksCH"]) || "?"} ; autres revenus hors CH : ${str(a["regime.foreignHouseholdIncome"]) || "?"}). Délai du 31.03.${year + 1} (forclusion).`);
  }
  if (livesAbroadAllYear(a) && !worksInSwitzerlandFromAbroad(a)) add("nonResident", "normal", `Non résident, rattachement économique : ${nonResidentReasons(a).join(", ") || "?"} ; répartition internationale et représentant fiscal à vérifier.`);
  if (isLumpSum(a)) add("lumpSum", "high", `Imposition d'après la dépense : calcul de contrôle (éléments suisses), ruling ${a["lumpSum.ruling"] === "yes" ? "disponible" : "non disponible"}, éventuel forfait modifié (CDI : ${str(a["lumpSum.treaty"]) || "?"}). Conditions à revérifier : nationalité suisse ${str(a["regime.swissNational"]) || "?"}, activité lucrative en Suisse ${str(a["regime.gainfulCH"]) || "?"}.`);

  // Family
  if (has("civilChange")(a)) add("civilChange", "high", `Changement d'état civil (${str(a["family.changeType"])}) le ${str(a["family.changeDate"])} : effet sur l'imposition commune ou séparée de toute l'année à vérifier, pensions et enfants.`);
  if (isCouple(a) && has("alimonyReceived")(a)) add("alimonyCouple", "normal", "Couple et pension reçue : vérifier s'il s'agit d'une pension d'un ex-conjoint ou pour un enfant d'une autre union.");
  if (rowsOf(a, "family.children").some((r) => r.custody === "alternating")) add("alternating", "normal", "Garde alternée : répartition des déductions pour enfants et des frais de garde entre parents.");

  // Work and pensions
  if (has("equity")(a)) add("equity", "normal", `Plans de participation : événements ${arr(a["work.equityEvents"]).join(", ") || "?"} ; vérifier l'imposition proportionnelle si travail hors de Suisse pendant l'acquisition (${str(a["work.equityAbroad"]) || "?"}).`);
  if (a["work.expat"] === "yes") add("expat", "normal", "Détachement temporaire annoncé : vérifier l'application de l'ordonnance sur les expatriés (frais particuliers).");
  if (has("selfEmployed")(a) && a["work.selfStarted"] === "yes") add("selfStart", "normal", "Début d'activité indépendante dans l'année : affiliation AVS, inscription TVA/RC, prévoyance.");
  if ((has("selfEmployed")(a) || has("swissBusiness")(a)) && a["work.selfFiscalYear"] === "other") add("selfFiscalYear", "normal", "Exercice comptable différent de l'année civile : périodes à rattacher.");
  if (has("avsNonEmployed")(a)) add("avsNonEmployed", "normal", "Cotisations AVS de personne sans activité lucrative : déduction et contrôle de l'affiliation.");
  if (has("p3a")(a) && a["other.p3aRetroInfo"] === "yes") add("p3aRetro", "normal", "Le client souhaite des informations sur les versements rétroactifs au 3e pilier A.");
  if (has("companyOwner")(a)) {
    const dividends = rowsWhere(a, "work.companies", (r) => r.dividend === "yes").length;
    const privateCosts = rowsWhere(a, "work.companies", (r) => r.privateExpenses === "yes").length;
    add("company", privateCosts ? "high" : "normal", `Participations : estimation des titres non cotés, ${dividends ? "dividendes (imposition partielle si participation qualifiée), " : ""}prêts actionnaire${privateCosts ? ", frais privés payés par la société (prestation appréciable en argent à examiner)" : ""}.`);
    if (rowsWhere(a, "work.companies", (r) => r.holdsProperty === "yes").length) add("companyProperty", "normal", "Bien détenu par la société et utilisé par l'actionnaire : vérifier le loyer / la prestation appréciable en argent.");
  }
  if (has("capital")(a)) add("capital", "normal", "Capital de prévoyance : imposition séparée ; date et motif du versement ; lien avec d'éventuels rachats LPP récents.");
  if ((has("lppBuyin")(a) && has("capital")(a)) || ["yes", "unknown"].includes(str(a["other.lpp3years"]))) add("lpp3years", "high", "Rachat LPP et retrait en capital à moins de trois ans d'intervalle (effectué ou prévu) : vérifier les conséquences sur la déduction du rachat.");
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
    if (events.includes("sold")) add(`sale:${row._id}`, "high", `Vente de ${where} : impôt sur les gains immobiliers (procédure séparée du canton/pays de situation ; déclaration déjà déposée par le notaire : ${str(row.notaryFiled) || "?"}), coûts d'acquisition et investissements à plus-value.`);
    if (events.includes("toOwnUse")) add(`toOwnUse:${row._id}`, "normal", `${where} passé de loué à usage propre : nouvelle valeur locative possiblement nécessaire (à vérifier).`);
    if (row.where === "CH" && row.canton && row.canton !== a["start.canton"]) add(`otherCanton:${row._id}`, "normal", `${where} situé hors du canton de domicile : répartition intercantonale ; valeur fiscale du canton de situation.`);
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
