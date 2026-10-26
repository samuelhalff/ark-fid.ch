/**
 * Document checklist. Each rule turns answers into documents to provide. Labels use {year}
 * (main tax year), so recurring documents follow the year automatically. Edit here; the
 * upload screens, the Excel sheets and the client email follow.
 */
import {
  arrived,
  has,
  isLumpSum,
  left,
  previouslyTaxed,
  residentPartOfYear,
  rowsOf,
  sourceTaxed,
  sourceTaxedResident,
  worksInSwitzerlandFromAbroad,
} from "./schema";
import { t, type Answers, type DocCategory, type DocItem, type DocRule, type L, type QfLocale, type Row } from "./types";

export const DOC_CATEGORIES: Record<DocCategory, { folder: string; label: L }> = {
  base: { folder: "00 Documents de base", label: t("Documents de base", "Key documents", "Grundlagen") },
  personal: { folder: "01 Famille", label: t("Famille", "Family", "Familie") },
  work: { folder: "02 Activité lucrative", label: t("Activité et revenus", "Work and income", "Erwerb und Einkommen") },
  pensions: { folder: "03 Rentes et prestations", label: t("Rentes, indemnités et capitaux", "Pensions, allowances and lump sums", "Renten, Taggelder und Kapitalleistungen") },
  wealth: { folder: "04 Comptes et placements", label: t("Comptes et placements", "Accounts and investments", "Konten und Anlagen") },
  property: { folder: "05 Immobilier", label: t("Immobilier", "Real estate", "Liegenschaften") },
  debts: { folder: "06 Dettes", label: t("Dettes", "Debts", "Schulden") },
  deductions: { folder: "07 Déductions", label: t("Prévoyance et déductions", "Pension savings and deductions", "Vorsorge und Abzüge") },
  admin: { folder: "08 Administration fiscale", label: t("Administration fiscale", "Tax administration", "Steuerverwaltung") },
  other: { folder: "09 Autres", label: t("Autres situations", "Other situations", "Weitere Situationen") },
  extra: { folder: "10 Documents complémentaires", label: t("Documents complémentaires", "Additional documents", "Weitere Dokumente") },
};

const str = (value: unknown) => (typeof value === "string" ? value : "");
const arr = (value: unknown): string[] => (Array.isArray(value) ? (value as string[]) : []);
const yes = (id: string) => (a: Answers) => a[id] === "yes";
const rowIn = (field: string, ...values: string[]) => (row: Row) => values.includes(str(row[field]));
const rowHas = (field: string, ...values: string[]) => (row: Row) => arr(row[field]).some((v) => values.includes(v));
const rowYes = (field: string) => rowIn(field, "yes");
const positive = (value: unknown) => Number(str(value).replace(/[^0-9.]/g, "")) > 0;

/** The ordinary return needs health-premium certificates etc. (not lump-sum or source tax only). */
export const filesOrdinaryReturn = (a: Answers) =>
  residentPartOfYear(a) && !isLumpSum(a) && (!sourceTaxedResident(a) || a["regime.over120k"] === "yes" || ["tou", "advise"].includes(str(a["regime.sourceRequest"])));

const benefit = (type: string, label: L): DocRule => ({
  id: `benefit-${type}`,
  category: "pensions",
  when: (a) => has("benefits")(a) && arr(a["work.benefitTypes"]).includes(type),
  label,
});

export const DOC_RULES: DocRule[] = [
  // ---- key documents (asked first)
  { id: "last-return", category: "base", base: true, when: previouslyTaxed, label: t("Dernière déclaration d'impôt déposée (avec annexes)", "Last tax return filed (with schedules)", "Letzte eingereichte Steuererklärung (mit Beilagen)") },
  { id: "last-assessment", category: "base", base: true, when: previouslyTaxed, label: t("Dernier avis de taxation reçu", "Latest notice of assessment received", "Letzte erhaltene Veranlagungsverfügung") },
  {
    id: "access-letter",
    category: "base",
    base: true,
    when: (a) => previouslyTaxed(a) && residentPartOfYear(a) && (!sourceTaxedResident(a) || a["regime.over120k"] === "yes"),
    label: t("Courrier de l'administration fiscale {year} avec vos codes d'accès (si reçu)", "Tax authority letter {year} with your access codes (if received)", "Schreiben der Steuerverwaltung {year} mit Ihren Zugangscodes (falls erhalten)"),
  },
  { id: "permit", category: "base", base: true, when: (a) => !!a["regime.permit"], label: t("Permis de séjour (recto-verso) ou carte de légitimation", "Residence permit (both sides) or legitimation card", "Ausländerausweis (beidseitig) oder Legitimationskarte") },
  { id: "arrival", category: "base", base: true, when: arrived, label: t("Attestation d'arrivée de la commune", "Municipal registration certificate", "Anmeldebestätigung der Gemeinde") },
  { id: "departure", category: "base", base: true, when: left, label: t("Attestation de départ de la commune", "Municipal deregistration certificate", "Abmeldebestätigung der Gemeinde") },

  { id: "avis-received", category: "admin", when: (a) => a["start.avisReceived"] === "yes", label: t("Avis de taxation {year} déjà reçu (avec bordereau)", "{year} notice of assessment already received (with bill)", "Bereits erhaltene Veranlagungsverfügung {year} (mit Rechnung)") },
  { id: "previous-file", category: "base", when: (a) => a["start.status"] === "filedBefore" && a["start.previousFile"] === "yes", label: t("Dossier de l'an dernier remis par votre précédent mandataire", "Last year's file from your previous adviser", "Vorjahresdossier Ihrer früheren Vertretung") },

  // ---- family
  { id: "civil-change", category: "personal", when: has("civilChange"), label: t("Justificatif du changement d'état civil (acte, jugement ou convention)", "Proof of the civil status change (certificate, judgment or agreement)", "Nachweis der Zivilstandsänderung (Urkunde, Urteil oder Vereinbarung)") },
  { id: "childcare", category: "personal", forEach: "family.children", whenRow: rowYes("childcare"), label: t("Factures et preuves de paiement des frais de garde {year} – {row}", "Childcare invoices and proof of payment {year} – {row}", "Rechnungen und Zahlungsbelege Kinderbetreuung {year} – {row}") },
  { id: "child-salary", category: "personal", forEach: "family.children", whenRow: rowIn("activity", "apprenticeship", "working"), label: t("Certificat de salaire {year} de l'enfant – {row}", "Child's salary certificate {year} – {row}", "Lohnausweis {year} des Kindes – {row}") },
  { id: "dependant", category: "personal", forEach: "family.dependants", label: t("Preuves du soutien versé en {year} et, si possible, justificatif des revenus et de la fortune de la personne – {row}", "Proof of support paid in {year} and, if possible, of the person's income and assets – {row}", "Belege der Unterstützung {year} und, wenn möglich, von Einkommen und Vermögen der Person – {row}") },
  {
    id: "child-studies",
    category: "personal",
    forEach: "family.children",
    whenRow: (row, a) => ["studies", "apprenticeship"].includes(str(row.activity)) && Number(str(row.birthYear)) > 0 && taxYearOf(a) - Number(str(row.birthYear)) >= 18,
    label: t("Attestation d'études ou d'apprentissage {year} – {row}", "Proof of studies or apprenticeship {year} – {row}", "Ausbildungs- oder Lehrbestätigung {year} – {row}"),
  },
  { id: "alimony", category: "personal", forEach: "family.alimony", label: t("Jugement ou convention, et preuves des montants {year} – {row}", "Judgment or agreement, and proof of the {year} amounts – {row}", "Urteil oder Vereinbarung und Belege der Beträge {year} – {row}") },

  // ---- work
  { id: "salary", category: "work", forEach: "work.employers", label: t("Certificat de salaire {year} – {row}", "Salary certificate {year} – {row}", "Lohnausweis {year} – {row}") },
  { id: "source-tax", category: "work", when: sourceTaxed, label: t("Attestation de l'impôt à la source {year}, si elle ne figure pas sur le certificat de salaire", "Tax-at-source statement {year}, if not shown on the salary certificate", "Quellensteuerbescheinigung {year}, falls nicht im Lohnausweis"), },
  { id: "residence-certificate", category: "work", when: worksInSwitzerlandFromAbroad, label: t("Attestation de résidence fiscale {year} de votre pays de domicile", "Tax residence certificate {year} from your country of residence", "Ansässigkeitsbescheinigung {year} Ihres Wohnsitzstaats") },
  { id: "household-world-income", category: "work", when: (a) => sourceTaxed(a) && worksInSwitzerlandFromAbroad(a) && ["yes", "unknown"].includes(str(a["regime.foreignHouseholdIncome"])), label: t("Justificatifs des revenus {year} du ménage hors de Suisse (y compris du conjoint)", "Proof of the household's {year} income outside Switzerland (including spouse)", "Belege der Haushaltseinkünfte {year} ausserhalb der Schweiz (inkl. Ehegatte)") },
  { id: "board-fees", category: "work", when: yes("work.boardFees"), label: t("Attestations des honoraires d'administrateur {year}", "Director's fee statements {year}", "Bescheinigungen Verwaltungsratshonorare {year}") },
  { id: "expat", category: "work", when: (a) => a["work.expat"] === "yes", label: t("Lettre de détachement et détail des frais pris en charge par l'employeur", "Secondment letter and details of expenses covered by the employer", "Entsendungsschreiben und Aufstellung der vom Arbeitgeber getragenen Kosten") },
  { id: "days-abroad", category: "work", when: (a) => positive(a["work.daysAbroad"]), label: t("Relevé des jours de travail hors de Suisse {year}", "Record of working days outside Switzerland {year}", "Aufstellung der Arbeitstage ausserhalb der Schweiz {year}") },
  { id: "equity", category: "work", when: (a) => has("equity")(a) && !arr(a["work.equityEvents"]).every((v) => v === "none"), label: t("Relevés des plans d'actions {year} (acquisitions, exercices, ventes) et attestation de l'employeur", "Equity plan statements {year} (vesting, exercises, sales) and employer statement", "Auszüge der Beteiligungspläne {year} (Vesting, Ausübungen, Verkäufe) und Arbeitgeberbescheinigung") },
  { id: "self-accounts", category: "work", when: (a) => (has("selfEmployed")(a) || has("swissBusiness")(a)) && ["self", "accountant"].includes(str(a["work.selfBooks"])), label: t("Comptes {year} de l'activité indépendante", "{year} accounts of the self-employed activity", "Abschluss {year} der selbständigen Tätigkeit") },
  { id: "self-records", category: "work", when: (a) => (has("selfEmployed")(a) || has("swissBusiness")(a)) && !["self", "accountant"].includes(str(a["work.selfBooks"])), label: t("Pièces comptables {year} (relevés bancaires, factures émises et reçues)", "{year} bookkeeping records (bank statements, invoices issued and received)", "Buchhaltungsbelege {year} (Kontoauszüge, Ausgangs- und Eingangsrechnungen)") },
  { id: "self-avs", category: "work", when: (a) => has("selfEmployed")(a) && a["work.selfAvs"] === "yes", label: t("Décomptes de cotisations AVS {year} (indépendant)", "AHV contribution statements {year} (self-employed)", "AHV-Beitragsabrechnungen {year} (selbständig)") },
  { id: "company-accounts", category: "wealth", forEach: "work.companies", label: t("Comptes annuels {year} de la société – {row}", "Company annual accounts {year} – {row}", "Jahresrechnung {year} der Gesellschaft – {row}") },
  { id: "company-dividend", category: "wealth", forEach: "work.companies", whenRow: rowYes("dividend"), label: t("Procès-verbal de distribution et décompte de l'impôt anticipé – {row}", "Distribution minutes and withholding tax return – {row}", "Ausschüttungsprotokoll und Verrechnungssteuerabrechnung – {row}") },
  { id: "company-loan", category: "wealth", forEach: "work.companies", whenRow: rowIn("loan", "toCompany", "fromCompany"), label: t("Relevé du compte courant / prêt avec la société au 31.12.{year} – {row}", "Current account / loan statement with the company at 31.12.{year} – {row}", "Kontokorrent- / Darlehensauszug per 31.12.{year} – {row}") },
  { id: "avs-non-employed", category: "deductions", when: has("avsNonEmployed"), label: t("Décompte des cotisations AVS {year} (personne sans activité lucrative)", "AHV contribution statement {year} (non-employed person)", "AHV-Beitragsverfügung {year} (Nichterwerbstätige)") },
  benefit("unemployment", t("Attestation de la caisse de chômage {year}", "Unemployment fund statement {year}", "Bescheinigung der Arbeitslosenkasse {year}")),
  benefit("sickness", t("Attestation des indemnités maladie / accident {year}", "Sickness / accident allowance statement {year}", "Taggeldbescheinigung Krankheit / Unfall {year}")),
  benefit("maternity", t("Attestation des allocations maternité / paternité {year}", "Maternity / paternity allowance statement {year}", "Bescheinigung Mutterschafts- / Vaterschaftsentschädigung {year}")),
  benefit("eo", t("Attestation APG {year}", "EO statement {year}", "EO-Bescheinigung {year}")),
  benefit("ai", t("Attestation AI {year}", "Disability insurance statement {year}", "IV-Bescheinigung {year}")),
  { id: "pension", category: "pensions", forEach: "work.pensions", label: t("Attestation de rente {year} – {row}", "Pension statement {year} – {row}", "Rentenbescheinigung {year} – {row}") },
  { id: "capital", category: "pensions", forEach: "work.capital", label: t("Décompte du versement en capital – {row}", "Lump-sum payment statement – {row}", "Abrechnung der Kapitalauszahlung – {row}") },
  { id: "severance", category: "pensions", when: has("severance"), label: t("Convention de départ et décompte de l'indemnité", "Termination agreement and severance statement", "Aufhebungsvereinbarung und Abrechnung der Entschädigung") },
  { id: "foreign-income", category: "other", forEach: "work.foreignIncome", label: t("Justificatif du revenu et de l'impôt étranger {year} – {row}", "Proof of the income and foreign tax {year} – {row}", "Beleg der Einkunft und ausländischen Steuer {year} – {row}") },
  { id: "lump-sum-ruling", category: "admin", when: (a) => isLumpSum(a) && a["lumpSum.ruling"] === "yes", label: t("Accord ou décision d'imposition d'après la dépense", "Lump-sum taxation ruling or decision", "Ruling oder Entscheid zur Aufwandbesteuerung") },
  { id: "lump-sum-swiss", category: "wealth", when: isLumpSum, label: t("Justificatifs des revenus et biens en Suisse {year} (pour le calcul de contrôle)", "Proof of Swiss income and assets {year} (for the control calculation)", "Belege der Einkünfte und Vermögen in der Schweiz {year} (Kontrollrechnung)") },

  // ---- accounts, investments, debts
  { id: "bank", category: "wealth", forEach: "assets.banks", whenRow: (row) => row.country !== "other" || row.statement !== "no", label: t("Relevé fiscal au 31.12.{year} (soldes, revenus, impôts retenus) – {row}", "Tax statement at 31.12.{year} (balances, income, taxes withheld) – {row}", "Steuerauszug per 31.12.{year} (Saldi, Erträge, Quellensteuern) – {row}") },
  { id: "bank-statements", category: "wealth", forEach: "assets.banks", whenRow: (row) => row.country === "other" && row.statement === "no", label: t("Relevés de compte de fin d'année {year} – {row}", "Year-end account statements {year} – {row}", "Jahresend-Kontoauszüge {year} – {row}") },
  { id: "foreign-withholding", category: "wealth", when: (a) => (has("securities")(a) || has("banksForeign")(a)) && a["assets.foreignWithholding"] === "yes", label: t("Détail des impôts étrangers retenus {year} (et formulaire DA-1 si votre banque l'a préparé)", "Details of foreign taxes withheld {year} (and form DA-1 if your bank prepared it)", "Aufstellung der ausländischen Quellensteuern {year} (und Formular DA-1, falls von der Bank erstellt)") },
  { id: "trading", category: "wealth", when: (a) => has("securities")(a) && a["assets.trading"] === "yes", label: t("Relevés des transactions sur titres {year}", "Securities transaction statements {year}", "Transaktionsauszüge Wertschriften {year}") },
  { id: "crypto", category: "wealth", forEach: "assets.crypto", label: t("Relevé ou export des soldes au 31.12.{year} et des revenus – {row}", "Statement or export of balances at 31.12.{year} and income – {row}", "Auszug oder Export der Bestände per 31.12.{year} und Erträge – {row}") },
  { id: "life-insurance", category: "wealth", forEach: "assets.insurances", label: t("Attestation fiscale {year} (valeur de rachat au 31.12) – {row}", "Tax certificate {year} (surrender value at 31.12) – {row}", "Steuerbescheinigung {year} (Rückkaufswert per 31.12.) – {row}") },
  { id: "loan-given", category: "wealth", forEach: "assets.loans", label: t("Contrat de prêt – {row}", "Loan agreement – {row}", "Darlehensvertrag – {row}") },
  { id: "debt-bank", category: "debts", forEach: "assets.debts", whenRow: rowIn("kind", "bank"), label: t("Attestation de solde et d'intérêts {year} – {row}", "Balance and interest certificate {year} – {row}", "Saldo- und Zinsbestätigung {year} – {row}") },
  { id: "debt-private", category: "debts", forEach: "assets.debts", whenRow: rowIn("kind", "private"), label: t("Contrat de prêt et preuves des intérêts payés – {row}", "Loan agreement and proof of interest paid – {row}", "Darlehensvertrag und Belege der bezahlten Zinsen – {row}") },

  // ---- real estate (per property)
  { id: "property-value", category: "property", forEach: "property.items", whenRow: (row, a) => row.where === "CH" && (!previouslyTaxed(a) || ["yes", "unknown"].includes(str(row.inLastAvis))), label: t("Dernier avis indiquant la valeur fiscale / locative – {row}", "Latest notice showing the tax / rental value – {row}", "Letzte Verfügung mit Steuer- / Eigenmietwert – {row}") },
  { id: "property-purchase", category: "property", forEach: "property.items", whenRow: rowHas("events", "bought"), label: t("Acte d'achat et décompte du notaire – {row}", "Purchase deed and notary statement – {row}", "Kaufvertrag und Notariatsabrechnung – {row}") },
  { id: "property-sale", category: "property", forEach: "property.items", whenRow: rowHas("events", "sold"), label: t("Acte de vente, acte d'achat d'origine et factures des travaux à plus-value depuis l'achat – {row}", "Sale deed, original purchase deed and invoices for value-adding works since purchase – {row}", "Verkaufsvertrag, ursprünglicher Kaufvertrag und Rechnungen wertvermehrender Investitionen seit dem Kauf – {row}") },
  { id: "property-inherited", category: "property", forEach: "property.items", whenRow: rowHas("events", "inherited"), label: t("Certificat d'héritier, acte de partage ou de donation – {row}", "Certificate of inheritance, partition or gift deed – {row}", "Erbbescheinigung, Teilungs- oder Schenkungsvertrag – {row}") },
  { id: "property-works", category: "property", forEach: "property.items", whenRow: rowHas("events", "works"), label: t("Autorisation de construire et décompte des travaux – {row}", "Building permit and statement of works – {row}", "Baubewilligung und Bauabrechnung – {row}") },
  { id: "property-mortgage", category: "debts", forEach: "property.items", whenRow: rowYes("mortgage"), label: t("Attestation(s) hypothécaire(s) {year} : solde et intérêts – {row}", "Mortgage statement(s) {year}: balance and interest – {row}", "Hypothekarbestätigung(en) {year}: Saldo und Zinsen – {row}") },
  { id: "property-private-loan", category: "debts", forEach: "property.items", whenRow: rowYes("privateLoan"), label: t("Contrat du prêt privé et preuves des intérêts payés – {row}", "Private loan agreement and proof of interest paid – {row}", "Privatdarlehensvertrag und Zinsbelege – {row}") },
  { id: "property-ppe", category: "property", forEach: "property.items", whenRow: rowYes("ppe"), label: t("Décompte de charges PPE {year} (avec fonds de rénovation) – {row}", "Condominium charges statement {year} (with renovation fund) – {row}", "STWE-Abrechnung {year} (mit Erneuerungsfonds) – {row}") },
  { id: "property-agency", category: "property", forEach: "property.items", whenRow: (row) => rowHas("uses", "rented", "partlyRented")(row) && row.agency === "yes", label: t("Décomptes de gérance {year} – {row}", "Agency statements {year} – {row}", "Verwaltungsabrechnungen {year} – {row}") },
  { id: "property-leases", category: "property", forEach: "property.items", whenRow: (row) => rowHas("uses", "rented", "partlyRented")(row) && row.agency !== "yes", label: t("Baux et état des loyers encaissés {year} – {row}", "Leases and record of rent received {year} – {row}", "Mietverträge und Aufstellung der Mieteinnahmen {year} – {row}") },
  { id: "property-invoices", category: "property", forEach: "property.items", whenRow: rowYes("invoices"), label: t("Factures {year} des travaux et frais, si possible triées par nature – {row}", "{year} invoices for works and costs, sorted by type if possible – {row}", "Rechnungen {year} für Arbeiten und Kosten, wenn möglich nach Art sortiert – {row}") },
  { id: "property-subsidies", category: "property", forEach: "property.items", whenRow: rowYes("subsidies"), label: t("Décisions de subventions pour les travaux – {row}", "Subsidy decisions for the works – {row}", "Förderentscheide für die Arbeiten – {row}") },
  {
    id: "property-other-canton",
    category: "property",
    forEach: "property.items",
    whenRow: (row, a) => row.where === "CH" && !!row.canton && row.canton !== a["start.canton"] && row.inLastAvis !== "yes",
    label: t("Avis d'estimation ou de taxation du canton de situation – {row}", "Valuation or assessment notice from the canton where it is located – {row}", "Schätzungs- oder Veranlagungsverfügung des Liegenschaftskantons – {row}"),
  },
  { id: "property-foreign-tax", category: "property", forEach: "property.items", whenRow: (row) => row.where === "abroad" && row.foreignAssessment === "yes", label: t("Avis d'impôt étranger {year} – {row}", "Foreign tax notice {year} – {row}", "Ausländische Steuerveranlagung {year} – {row}") },

  // ---- deductions
  { id: "lamal-subsidy", category: "deductions", when: has("lamalSubsidy"), label: t("Décision ou attestation de subside d'assurance maladie {year}", "Health insurance subsidy decision or statement {year}", "Verfügung oder Bescheinigung Prämienverbilligung {year}") },
  { id: "health-premiums", category: "deductions", when: filesOrdinaryReturn, label: t("Attestation annuelle des primes d'assurance maladie {year} (chaque membre du ménage)", "Annual health insurance premium statement {year} (each household member)", "Jährliche Prämienbescheinigung Krankenkasse {year} (jede Person im Haushalt)") },
  { id: "p3a", category: "deductions", when: has("p3a"), label: t("Attestation(s) de versement au 3e pilier A {year}", "Pillar 3a contribution certificate(s) {year}", "Bescheinigung(en) Säule 3a {year}") },
  { id: "lpp-buyin", category: "deductions", when: has("lppBuyin"), label: t("Attestation de rachat LPP {year}", "Pension fund buy-in certificate {year}", "Bescheinigung Pensionskasseneinkauf {year}") },
  { id: "donations", category: "deductions", when: has("donations"), label: t("Reçus de dons {year}", "Donation receipts {year}", "Spendenbestätigungen {year}") },
  { id: "medical", category: "deductions", when: has("medical"), label: t("Factures médicales {year} et décomptes de remboursement de l'assurance", "Medical invoices {year} and insurer reimbursement statements", "Arztrechnungen {year} und Rückerstattungsabrechnungen der Versicherung") },
  { id: "training", category: "deductions", when: has("training"), label: t("Factures et preuves de paiement de la formation {year}", "Training invoices and proof of payment {year}", "Rechnungen und Zahlungsbelege Weiterbildung {year}") },

  // ---- other
  { id: "inheritance", category: "other", forEach: "other.inheritance", label: t("Certificat d'héritier, inventaire, convention de partage ou acte de donation – {row}", "Certificate of inheritance, inventory, partition agreement or gift deed – {row}", "Erbbescheinigung, Inventar, Teilungsvertrag oder Schenkungsvertrag – {row}") },
  { id: "winnings", category: "other", forEach: "other.winnings", label: t("Justificatif du gain – {row}", "Proof of the win – {row}", "Gewinnbeleg – {row}") },
  {
    id: "regularisation",
    category: "other",
    when: has("regularisation"),
    label: t("Relevés des comptes ou biens concernés pour les années à régulariser (en général jusqu'à dix ans), si vous les avez", "Statements of the accounts or assets concerned for the years to regularise (generally up to ten years), if you have them", "Auszüge der betroffenen Konten oder Vermögenswerte für die zu regularisierenden Jahre (in der Regel bis zehn Jahre), falls vorhanden"),
  },
  { id: "trust", category: "other", when: has("trust"), label: t("Acte de trust ou statuts de la fondation, et relevés des distributions {year}", "Trust deed or foundation charter, and distribution statements {year}", "Trusturkunde oder Stiftungsstatuten und Ausschüttungsbelege {year}") },
];

const RULES_BY_ID = new Map(DOC_RULES.map((rule) => [rule.id, rule]));
export const docRuleById = (id: string): DocRule | undefined => RULES_BY_ID.get(id) || (id === OLDER_YEARS_RULE.id ? { ...OLDER_YEARS_RULE, forEach: "start.years" } : undefined);

/** Earlier years selected on the start screen (arrears): one item per year, filed in that year's folder. */
const OLDER_YEARS_RULE: DocRule = {
  id: "older-years",
  category: "admin",
  label: t("Documents {years} : mêmes types que ci-dessus, pour cette année-là", "Documents for {years}: same types as above, for that year", "Dokumente {years}: gleiche Arten wie oben, für dieses Jahr"),
};

/** FNV-1a, 24 bits as 6 hex chars: short, stable code for a checklist key (used in file names). */
export function docCode(key: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < key.length; i++) {
    hash ^= key.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return (hash & 0xffffff).toString(16).padStart(6, "0");
}

export function selectedYears(answers: Answers): number[] {
  return arr(answers["start.years"])
    .map(Number)
    .filter((y) => Number.isInteger(y) && y > 2000)
    .sort((x, y) => y - x);
}

/** Main tax year: the latest one selected (default: previous calendar year). */
export function taxYearOf(answers: Answers): number {
  return selectedYears(answers)[0] || new Date().getFullYear() - 1;
}

/** Replaces {year}, {prevYear} and {years} in a label. */
export function withYear(label: L, year: number, years = ""): L {
  const out = {} as L;
  for (const locale of Object.keys(label) as QfLocale[]) {
    out[locale] = label[locale]
      .replace(/\{year\}/g, String(year))
      .replace(/\{prevYear\}/g, String(year - 1))
      .replace(/\{years\}/g, years);
  }
  return out;
}

/** Title of a row for labels: its title field, or "n° <index>". */
export function rowTitle(row: Row, titleField: string | undefined, index: number, locale: QfLocale): string {
  // "a|b": first non-empty of several fields (e.g. commune for Swiss property, city abroad).
  const value = (titleField || "").split("|").map((field) => str(row[field]).trim()).find(Boolean) || "";
  if (value) return value.length > 60 ? `${value.slice(0, 57)}…` : value;
  return `${locale === "de" ? "Nr." : "n°"} ${index + 1}`;
}

const item = (rule: DocRule, key: string, label: L): DocItem => ({ key, code: docCode(key), ruleId: rule.id, category: rule.category, label, hint: rule.hint, base: rule.base });

/** Computes the checklist from (pruned) answers: same result on the client and the server. */
export function computeChecklist(answers: Answers, titleFields: Record<string, string | undefined>): DocItem[] {
  const year = taxYearOf(answers);
  const items: DocItem[] = [];
  for (const rule of DOC_RULES) {
    if (rule.when && !rule.when(answers)) continue;
    if (!rule.forEach) {
      items.push(item(rule, rule.id, withYear(rule.label, year)));
      continue;
    }
    rowsOf(answers, rule.forEach).forEach((row, index) => {
      if (rule.whenRow && !rule.whenRow(row, answers)) return;
      const label = withYear(rule.label, year);
      for (const locale of Object.keys(label) as QfLocale[]) {
        label[locale] = label[locale].replace(/\{row\}/g, rowTitle(row, titleFields[rule.forEach as string], index, locale));
      }
      items.push(item(rule, `${rule.id}:${row._id}`, label));
    });
  }
  for (const older of selectedYears(answers).slice(1)) {
    const key = `${OLDER_YEARS_RULE.id}:y${older}xx`;
    items.push({ ...item(OLDER_YEARS_RULE, key, withYear(OLDER_YEARS_RULE.label, year, String(older))), year: older });
  }
  return items;
}
