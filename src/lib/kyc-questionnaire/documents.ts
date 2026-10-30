/**
 * Section H: the documents asked for, from the route and the answers. One item per person where
 * the Word form asked for "each person" (signatories' certified IDs, IDs of section B persons).
 * Pure module.
 */
import { clientName, isListed, isPM, isPP, sectionBPersons } from "./schema";
import { t, type Answers, type DocItem, type L, type Row } from "./types";

const CERTIFIED_HINT = t(
  "Copie certifiée conforme par un notaire, votre commune ou Ark Fiduciaire SA (sur présentation de l'original). Joignez-en ici une copie numérisée et envoyez l'exemplaire certifié original par courrier à Ark Fiduciaire SA, boulevard Georges-Favon 26, 1204 Genève.",
  "Copy certified by a notary, your municipality or Ark Fiduciaire SA (on presentation of the original). Attach a scanned copy here and send the original certified copy by post to Ark Fiduciaire SA, boulevard Georges-Favon 26, 1204 Geneva, Switzerland.",
);

/** Accepted uploads: PDF and images only (no office documents, which may carry macros). */
export const KYC_UPLOAD_TYPES = new Set(["pdf", "jpg", "jpeg", "png", "heic", "heif"]);
export const KYC_ACCEPT_ATTRIBUTE = [...KYC_UPLOAD_TYPES].map((ext) => `.${ext}`).join(",");

const fnv = (key: string, seed: number) => {
  let h = seed >>> 0;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
};

/**
 * Code (12 hex) put in the uploaded file names, stable for a key (two FNV-1a passes, browser and
 * Node). The server refuses an upload when two documents of a revision share a code.
 */
export const docCode = (key: string): string => (fnv(key, 0x811c9dc5) + fnv(key, 0x050c5d1f)).slice(0, 12);

const item = (key: string, label: L, required: boolean, hint?: L): DocItem => ({ key, code: docCode(key), label, required, hint });
const personLabel = (row: Row) => [String(row.lastName || "").toLocaleUpperCase("fr-CH"), String(row.firstName || "")].join(" ").trim();
const rows = (a: Answers, id: string): Row[] => (Array.isArray(a[id]) ? (a[id] as Row[]) : []);

export function documentsFor(a: Answers): DocItem[] {
  const out: DocItem[] = [];
  if (isPP(a)) {
    out.push(item("pp.id", t("Copie certifiée conforme de votre passeport ou de votre carte d'identité", "Certified copy of your passport or identity card"), true, CERTIFIED_HINT));
    out.push(item("pp.address", t("Justificatif de domicile de moins de 3 mois (facture d'électricité ou de téléphone, attestation de domicile)", "Proof of address less than 3 months old (utility or phone bill, certificate of residence)"), true));
    out.push(item("pp.wealth", t("Justificatifs de l'origine de votre fortune (p. ex. contrat de travail, acte de vente, succession)", "Evidence of the origin of your wealth (e.g. employment contract, deed of sale, estate documents)"), true));
    for (const { row } of sectionBPersons(a)) {
      out.push(item(`pp.ubo:${row._id}`, t(`Copie de la pièce d'identité de ${personLabel(row)} (uniquement si Ark Fiduciaire SA vous la demande)`, `Copy of the identity document of ${personLabel(row)} (only if requested by Ark Fiduciaire SA)`), false));
    }
  }
  if (isPM(a)) {
    out.push(item("pm.rc", t("Extrait du registre du commerce de moins de 12 mois (ou équivalent étranger)", "Commercial register extract less than 12 months old (or foreign equivalent)"), true));
    out.push(item("pm.statutes", t("Statuts", "Articles of association"), true));
    if (!isListed(a)) out.push(item("pm.shareholders", t("Liste des actionnaires avec leur nombre d'actions (registre des actions)", "List of shareholders with their number of shares (share register)"), true));
    if (a["b.structure"] === "yes" || String(a["d.group"] || "").trim()) out.push(item("pm.chart", t("Organigramme du groupe ou de la chaîne de détention", "Chart of the group or ownership chain"), true));
    if (isListed(a)) out.push(item("pm.listed", t("Preuve de la cotation (ou de la détention majoritaire par une société cotée)", "Evidence of the listing (or of majority ownership by a listed company)"), true));
    for (const row of rows(a, "i.signers")) {
      out.push(item(`pm.signer:${row._id}`, t(`Copie certifiée conforme de la pièce d'identité de ${personLabel(row)} (signataire du formulaire)`, `Certified copy of the identity document of ${personLabel(row)} (form signatory)`), true, CERTIFIED_HINT));
    }
    for (const { row } of sectionBPersons(a)) {
      out.push(item(`pm.person:${row._id}`, t(`Copie de la pièce d'identité de ${personLabel(row)} (personne indiquée au point B)`, `Copy of the identity document of ${personLabel(row)} (person listed in section B)`), true));
    }
    if (a["b.transparency"] === "done") out.push(item("pm.transparency", t("Extrait du registre de transparence", "Transparency register extract"), true));
    if (a["a.activityKind"] === "notStarted") out.push(item("pm.plan", t("Plan d'affaires ou description de l'activité prévue", "Business plan or description of the planned activity"), true));
    else out.push(item("pm.financials", t("Derniers états financiers", "Latest financial statements"), true));
  }
  if (a["f.funds"] === "yes") out.push(item("funds", t("Justificatifs de l'origine des fonds (p. ex. relevé du compte depuis lequel l'argent sera versé)", "Evidence of the origin of funds (e.g. statement of the account the money will come from)"), true));
  out.push(item("other", t("Autre document utile (facultatif)", "Other useful document (optional)"), false));
  return out;
}

/** Name prefix of the case's documents folder files: "[code] ". */
export const DOCS_FOLDER = "Documents";
export const fileTitle = (a: Answers) => clientName(a) || "Client";
