/**
 * Section H: the documents asked for, from the route and the answers. One item per person where
 * the Word form asked for "each person" (signatories' certified IDs, IDs of section B persons).
 * Pure module.
 */
import { holderKinds } from "./holders";
import { personKey } from "./people";
import { clientName, isListed, isPM, isPP, sectionBPersons } from "./schema";
import { t, type Answers, type DocItem, type ExtraDocument, type L, type Row } from "./types";

const CERTIFIED_HINT = t(
  "Copie certifiée par un notaire, votre commune, ou par nous sur présentation de l’original. Joignez un scan ici et envoyez la copie certifiée par la poste : Ark Fiduciaire SA, boulevard Georges-Favon 26, 1204 Genève.",
  "Copy certified by a notary, your municipality, or by us on presentation of the original. Attach a scan here and send the certified copy by post: Ark Fiduciaire SA, boulevard Georges-Favon 26, 1204 Geneva, Switzerland.",
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

/** Does a file (by the code in its name) belong to this item: its own code, or that of an item folded into it. */
export const holdsFile = (doc: Pick<DocItem, "code" | "also">, code: string | null | undefined): boolean => !!code && (code === doc.code || !!doc.also?.some((key) => docCode(key) === code));
/** The item's key and the keys folded into it (carried files, declarations). */
export const itemKeys = (doc: Pick<DocItem, "key" | "also">): string[] => [doc.key, ...(doc.also || [])];
/** The client's declaration for the item (« plus tard », « sans objet »), made under its key or under a key folded into it. */
export const declaredFor = <T,>(doc: Pick<DocItem, "key" | "also">, declared: Readonly<Record<string, T>> | undefined): T | undefined => {
  for (const key of itemKeys(doc)) if (declared?.[key]) return declared[key];
  return undefined;
};

/**
 * The same person, named in two places: same name whatever the case or spacing, and birth dates
 * that do not differ (one may be missing: the signers' list asks none).
 */
export function samePerson(x: Record<string, unknown>, y: Record<string, unknown>): boolean {
  const key = personKey(x.lastName, x.firstName);
  if (!key || !String(x.lastName || "").trim() || !String(x.firstName || "").trim() || key !== personKey(y.lastName, y.firstName)) return false;
  const bx = String(x.birthDate || "").replace(/\s/g, "");
  const by = String(y.birthDate || "").replace(/\s/g, "");
  return !bx || !by || bx === by;
}

/** A Swiss UID as the register writes it (CHE-123.456.789), spaces and separators tolerated. */
const SWISS_UID = /^CHE[-.\s]?\d{3}[.\s]?\d{3}[.\s]?\d{3}$/i;

/**
 * A company registered in Switzerland: its register extract and its articles are online at the
 * register, so they are not on its list at all (Sam, 2026-11-13: « en Suisse tout est en ligne au RC »).
 */
export const swissCompany = (a: Answers): boolean => isPM(a) && SWISS_UID.test(String(a["a.uid"] || "").trim());

/**
 * Why a document of the list is not asked of the client: Ark took it off this case's list
 * (`removed`), or the office already holds it, received another way (`office`, Cadence « Ajouter »).
 */
export type Withheld = "removed" | "office";

/**
 * Every document the route and answers call for, each marked `withheld` when Ark took it off this
 * case's list (`skipped`) or holds it (`office`); both are Cadence's keys. Taken off wins.
 * `extra`: the documents Ark asked for on this case only, after the standard ones.
 */
export function documentList(a: Answers, skipped: readonly string[] = [], office: readonly string[] = [], extra: readonly ExtraDocument[] = []): (DocItem & { withheld: Withheld | null })[] {
  const removed = new Set(skipped);
  const held = new Set(office);
  const asked = extra.map((doc) => item(doc.key, t(doc.label, doc.label), doc.required, doc.help ? t(doc.help, doc.help) : undefined));
  return [...allDocuments(a, removed), ...asked].map((doc) => ({ ...doc, withheld: removed.has(doc.key) ? "removed" : held.has(doc.key) ? "office" : null }));
}

/** The documents asked of the client: the list without what Ark took off or already holds. */
export function documentsFor(a: Answers, skipped: readonly string[] = [], office: readonly string[] = [], extra: readonly ExtraDocument[] = []): DocItem[] {
  return documentList(a, skipped, office, extra).filter((doc) => doc.withheld === null).map(({ withheld: _w, ...doc }) => doc);
}
const personLabel = (row: Row) => [String(row.lastName || "").toLocaleUpperCase("fr-CH"), String(row.firstName || "")].join(" ").trim();
const rows = (a: Answers, id: string): Row[] => (Array.isArray(a[id]) ? (a[id] as Row[]) : []);

function allDocuments(a: Answers, removed: ReadonlySet<string> = new Set()): DocItem[] {
  const out: DocItem[] = [];
  if (isPP(a)) {
    out.push(item("pp.id", t("Copie certifiée de votre passeport ou carte d’identité", "Certified copy of your passport or identity card"), true, CERTIFIED_HINT));
    out.push(item("pp.address", t("Justificatif de domicile de moins de 3 mois (facture d’électricité ou de téléphone, attestation de la commune)", "Proof of address less than 3 months old (utility or phone bill, certificate from the municipality)"), true));
    out.push(item("pp.wealth", t("Justificatifs de l’origine de votre fortune (p. ex. contrat de travail, acte de vente, succession)", "Evidence of the origin of your wealth (e.g. employment contract, deed of sale, estate documents)"), true));
    const self = { lastName: a["a.lastName"] as string, firstName: a["a.firstName"] as string, birthDate: a["a.birthDate"] as string };
    for (const { row } of sectionBPersons(a)) {
      // The client named among the persons behind the assets: their certified ID above covers it.
      if (samePerson(row, self)) {
        out[0].also = [...(out[0].also || []), `pp.ubo:${row._id}`];
        continue;
      }
      out.push(item(`pp.ubo:${row._id}`, t(`Pièce d’identité de ${personLabel(row)} (seulement si nous vous la demandons)`, `Identity document of ${personLabel(row)} (only if we ask for it)`), false));
    }
  }
  if (isPM(a)) {
    if (!swissCompany(a)) out.push(item("pm.rc", t("Extrait du registre du commerce de moins de 12 mois (ou équivalent étranger)", "Commercial register extract less than 12 months old (or foreign equivalent)"), true));
    if (!swissCompany(a)) out.push(item("pm.statutes", t("Statuts", "Articles of association"), true));
    if (!isListed(a)) out.push(item("pm.shareholders", t("Registre des actions", "Share register"), true));
    if ((a["b.structure"] === "yes" && !Array.isArray(a["b.holders"])) || holderKinds(a).some((kind) => kind !== "person") || String(a["d.group"] || "").trim()) out.push(item("pm.chart", t("Schéma de qui détient la société", "Chart of who owns the company"), true));
    // One ID per person (Sam 2026-11-15: « We're asking for ID twice »): a person of section B who
    // also signs gives the signer's certified copy only (it covers a plain copy); both roles are said.
    const signers = rows(a, "i.signers").map((row) => ({ row, doc: item(`pm.signer:${row._id}`, t(`Copie certifiée de la pièce d’identité de ${personLabel(row)}`, `Certified copy of the identity document of ${personLabel(row)}`), true, CERTIFIED_HINT) }));
    const plain: DocItem[] = [];
    const bPersons = sectionBPersons(a).map(({ row }) => row);
    for (const row of bPersons) {
      // Folded only into a signer's ID Ark still asks, and only when the name points to one person of section B
      // (the signers' list asks no birth date: a father and son of the same name keep their own IDs).
      const signer = signers.find((s) => !removed.has(s.doc.key) && samePerson(s.row, row) && bPersons.filter((other) => samePerson(s.row, other)).length === 1);
      if (!signer) {
        plain.push(item(`pm.person:${row._id}`, t(`Pièce d’identité de ${personLabel(row)}`, `Identity document of ${personLabel(row)}`), true));
        continue;
      }
      signer.doc.also = [...(signer.doc.also || []), `pm.person:${row._id}`];
      const role = String(signer.row.function || "").trim();
      signer.doc.hint = t(
        `Pour : ${role || "signataire"}, personne citée au point B. ${CERTIFIED_HINT.fr}`,
        `For: ${role || "signatory"}, person named in section B. ${CERTIFIED_HINT.en}`,
      );
    }
    out.push(...signers.map((s) => s.doc), ...plain);
    if (a["b.transparency"] === "done") out.push(item("pm.transparency", t("Extrait du registre de transparence", "Transparency register extract"), true));
    if (a["a.activityKind"] === "notStarted") out.push(item("pm.plan", t("Plan d’affaires ou description de l’activité prévue", "Business plan or description of the planned activity"), true));
    else out.push(item("pm.financials", t("Derniers comptes annuels", "Latest annual accounts"), true));
  }
  if (a["f.funds"] === "yes") out.push(item("funds", t("Preuve de l’origine du versement (p. ex. relevé du compte d’où part l’argent)", "Evidence of the origin of the payment (e.g. statement of the account the money comes from)"), true));
  out.push(item("other", t("Autre document", "Other document"), false));
  return out;
}

/**
 * Documents earlier versions of the form asked for and the current one no longer does (proof of
 * listing: public, Ark finds it). Kept so the files of earlier cases still show in the staff view.
 */
export const RETIRED_DOCUMENTS: Record<string, L> = {
  "pm.listed": t("Preuve de la cotation (ou de la détention majoritaire par une société cotée)", "Evidence of the listing (or of majority ownership by a listed company)"),
};

/** A retired document an earlier case holds files or an answer for, as an item of its list. */
export const retiredDocument = (key: string): DocItem | null => (RETIRED_DOCUMENTS[key] ? item(key, RETIRED_DOCUMENTS[key], false) : null);

/** Name prefix of the case's documents folder files: "[code] ". */
export const DOCS_FOLDER = "Documents";
export const fileTitle = (a: Answers) => clientName(a) || "Client";
