/**
 * "Où le trouver ?" hints for checklist items, institution-specific hints for common Swiss banks,
 * insurers and pension providers, and a copyable request e-mail. Pure content, kept generic and
 * prudent: we never claim exact menu paths of a provider's e-banking.
 */
import type { DocItem, L, QfLocale } from "./types";

const t = (fr: string, en: string, de: string): L => ({ fr, en, de });

/** Generic hint per checklist rule id. */
const RULE_HINTS: Record<string, L> = {
  "last-return": t("Copie gardée lors du dépôt (PDF de la déclaration en ligne) ou demandée à votre précédent mandataire.", "Copy kept when filing (PDF of the online return) or requested from your previous adviser.", "Beim Einreichen gespeicherte Kopie (PDF der Online-Erklärung) oder bei der früheren Vertretung anfordern."),
  "last-assessment": t("Courrier de l'administration fiscale avec le bordereau ; souvent aussi disponible dans l'espace en ligne du canton.", "Letter from the tax authority with the tax bill; often also available in the canton's online portal.", "Schreiben der Steuerverwaltung mit der Rechnung; oft auch im Online-Portal des Kantons."),
  "access-letter": t("Envoyé par l'administration fiscale au début de l'année avec la déclaration ou les codes d'accès.", "Sent by the tax authority early in the year with the return or the access codes.", "Von der Steuerverwaltung Anfang Jahr mit der Steuererklärung oder den Zugangscodes zugestellt."),
  permit: t("Recto et verso du titre de séjour (photo ou scan).", "Both sides of the residence permit (photo or scan).", "Vorder- und Rückseite des Ausweises (Foto oder Scan)."),
  arrival: t("Délivrée par l'office de la population ou la commune lors de l'annonce d'arrivée.", "Issued by the population office or municipality at registration.", "Von der Einwohnerkontrolle bzw. Gemeinde bei der Anmeldung ausgestellt."),
  departure: t("Délivrée par la commune lors de l'annonce de départ.", "Issued by the municipality when you deregistered.", "Von der Gemeinde bei der Abmeldung ausgestellt."),
  "avis-received": t("Le courrier reçu de l'administration fiscale pour cette année.", "The letter received from the tax authority for that year.", "Das Schreiben der Steuerverwaltung für dieses Jahr."),
  "previous-file": t("À demander à votre précédent mandataire (déclaration complète et annexes).", "Ask your previous adviser (full return and schedules).", "Bei der früheren Vertretung anfordern (vollständige Erklärung mit Beilagen)."),
  "civil-change": t("Acte de l'état civil, jugement ou convention homologuée.", "Civil status certificate, judgment or approved agreement.", "Zivilstandsurkunde, Urteil oder genehmigte Vereinbarung."),
  childcare: t("Factures de la crèche, du parascolaire ou de la maman de jour, avec les preuves de paiement.", "Invoices from the day care, after-school care or childminder, with proof of payment.", "Rechnungen von Kita, Hort oder Tagesmutter mit Zahlungsbelegen."),
  "child-salary": t("Remis par l'employeur de l'enfant en début d'année.", "Given by the child's employer early in the year.", "Vom Arbeitgeber des Kindes Anfang Jahr ausgestellt."),
  dependant: t("Ordres de virement ou relevés bancaires montrant les montants versés.", "Transfer orders or bank statements showing the amounts paid.", "Zahlungsaufträge oder Kontoauszüge mit den bezahlten Beträgen."),
  alimony: t("Jugement ou convention, plus relevés bancaires des versements de l'année.", "Judgment or agreement, plus bank statements of the year's payments.", "Urteil oder Vereinbarung sowie Kontoauszüge der Zahlungen des Jahres."),
  salary: t("Remis par l'employeur en début d'année (souvent avec la fiche de salaire de janvier ou de février).", "Given by the employer early in the year (often with the January or February payslip).", "Vom Arbeitgeber Anfang Jahr ausgestellt (oft mit der Lohnabrechnung Januar oder Februar)."),
  "source-tax": t("Le certificat de salaire indique souvent l'impôt retenu ; sinon, demandez l'attestation à l'employeur.", "The salary certificate often shows the tax withheld; otherwise ask your employer.", "Der Lohnausweis zeigt oft die abgezogene Steuer; sonst beim Arbeitgeber anfordern."),
  "residence-certificate": t("À demander à l'administration fiscale de votre pays de domicile.", "Ask the tax authority of your country of residence.", "Bei der Steuerbehörde Ihres Wohnsitzstaats anfordern."),
  "household-world-income": t("Fiches de salaire, avis d'imposition ou relevés du pays concerné.", "Payslips, tax notices or statements from the country concerned.", "Lohnabrechnungen, Steuerbescheide oder Auszüge aus dem betreffenden Land."),
  "board-fees": t("Attestation ou certificat de salaire remis par la société.", "Statement or salary certificate from the company.", "Bescheinigung oder Lohnausweis der Gesellschaft."),
  expat: t("Lettre de détachement de l'employeur et liste des frais pris en charge.", "Employer's secondment letter and list of expenses covered.", "Entsendungsschreiben des Arbeitgebers und Liste der übernommenen Kosten."),
  "days-abroad": t("Votre agenda ou un relevé de l'employeur des jours travaillés hors de Suisse.", "Your calendar or an employer record of days worked outside Switzerland.", "Ihr Kalender oder eine Aufstellung des Arbeitgebers der Arbeitstage im Ausland."),
  equity: t("Relevés annuels de la plateforme du plan (souvent dans l'espace salarié du courtier) et attestation de l'employeur.", "Annual statements from the plan platform (often in the broker's employee portal) and employer statement.", "Jahresauszüge der Planplattform (oft im Mitarbeiterportal des Brokers) und Arbeitgeberbescheinigung."),
  "self-accounts": t("Bilan et compte de résultat de l'année, établis par vous ou votre comptable.", "Balance sheet and profit and loss account for the year, by you or your accountant.", "Bilanz und Erfolgsrechnung des Jahres, von Ihnen oder Ihrer Buchhaltung."),
  "self-records": t("Relevés du compte professionnel et factures émises et reçues de l'année.", "Business account statements and invoices issued and received for the year.", "Geschäftskontoauszüge sowie Ausgangs- und Eingangsrechnungen des Jahres."),
  "self-avs": t("Décomptes et décision de cotisations de votre caisse de compensation AVS.", "Contribution statements and decision from your AHV compensation fund.", "Beitragsabrechnungen und -verfügung Ihrer AHV-Ausgleichskasse."),
  "company-accounts": t("Comptes approuvés par l'assemblée générale, ou les derniers disponibles.", "Accounts approved by the general meeting, or the latest available.", "Von der Generalversammlung genehmigte Jahresrechnung oder die letzte verfügbare."),
  "company-dividend": t("Procès-verbal de l'assemblée et formulaire d'impôt anticipé remis par la société.", "General meeting minutes and withholding tax form from the company.", "GV-Protokoll und Verrechnungssteuerformular der Gesellschaft."),
  "company-loan": t("Extrait du compte courant actionnaire dans la comptabilité de la société.", "Extract of the shareholder current account in the company's books.", "Auszug des Aktionärskontokorrents aus der Buchhaltung der Gesellschaft."),
  "avs-non-employed": t("Décision de cotisations de votre caisse de compensation AVS.", "Contribution decision from your AHV compensation fund.", "Beitragsverfügung Ihrer AHV-Ausgleichskasse."),
  "benefit-unemployment": t("Attestation annuelle envoyée par la caisse de chômage.", "Annual statement sent by the unemployment fund.", "Jahresbescheinigung der Arbeitslosenkasse."),
  "benefit-sickness": t("Attestation de l'assurance qui a versé les indemnités (sauf si elles figurent sur le certificat de salaire).", "Statement from the insurer that paid (unless shown on the salary certificate).", "Bescheinigung der zahlenden Versicherung (ausser sie stehen im Lohnausweis)."),
  "benefit-maternity": t("Attestation de la caisse de compensation (sauf si versé par l'employeur).", "Statement from the compensation fund (unless paid by the employer).", "Bescheinigung der Ausgleichskasse (ausser vom Arbeitgeber ausbezahlt)."),
  "benefit-eo": t("Attestation de la caisse de compensation ou de l'employeur.", "Statement from the compensation fund or the employer.", "Bescheinigung der Ausgleichskasse oder des Arbeitgebers."),
  "benefit-ai": t("Attestation de l'office AI ou de la caisse de compensation.", "Statement from the IV office or compensation fund.", "Bescheinigung der IV-Stelle oder der Ausgleichskasse."),
  pension: t("Caisse de pension : attestation envoyée en janvier. AVS/AI : disponible sur demande auprès de la caisse de compensation. Rente étrangère : relevé annuel de l'organisme.", "Pension fund: statement sent in January. AHV/IV: available on request from the compensation office. Foreign pension: annual statement from the payer.", "Pensionskasse: Bescheinigung im Januar. AHV/IV: auf Anfrage bei der Ausgleichskasse. Ausländische Rente: Jahresauszug der Zahlstelle."),
  "child-studies": t("Attestation remise par l'école, l'université ou l'employeur d'apprentissage.", "Certificate from the school, university or training employer.", "Bestätigung der Schule, Hochschule oder des Lehrbetriebs."),
  capital: t("Décompte de versement envoyé par l'institution lors du paiement.", "Payment statement sent by the institution when it paid.", "Auszahlungsabrechnung der Einrichtung."),
  severance: t("Convention de fin de contrat et décompte final de salaire.", "Termination agreement and final salary statement.", "Aufhebungsvereinbarung und Schlussabrechnung."),
  "foreign-income": t("Relevé ou avis d'imposition du pays d'où vient le revenu.", "Statement or tax notice from the country where the income comes from.", "Auszug oder Steuerbescheid des Herkunftslands."),
  "lump-sum-ruling": t("Courrier de l'administration fiscale confirmant l'accord.", "Tax authority letter confirming the agreement.", "Schreiben der Steuerverwaltung mit der Vereinbarung."),
  "lump-sum-swiss": t("Relevés fiscaux des banques suisses, attestations de rentes suisses, avis d'estimation des immeubles.", "Tax statements from Swiss banks, Swiss pension statements, property valuation notices.", "Steuerauszüge Schweizer Banken, Schweizer Rentenbescheinigungen, Schätzungsverfügungen."),
  bank: t("Relevé fiscal annuel de la banque (souvent disponible dans l'e-banking en début d'année, parfois payant) ; à défaut, attestation de solde et d'intérêts au 31.12.", "The bank's annual tax statement (often in e-banking early in the year, sometimes for a fee); otherwise a balance and interest certificate at 31.12.", "Jährlicher Steuerauszug der Bank (oft Anfang Jahr im E-Banking, teils kostenpflichtig); sonst Saldo- und Zinsbestätigung per 31.12."),
  "bank-statements": t("Relevés de compte de décembre (et de toute l'année si demandé), avec solde et intérêts.", "December account statements (and the whole year if requested), with balance and interest.", "Kontoauszüge Dezember (auf Anfrage des ganzen Jahres) mit Saldo und Zinsen."),
  "foreign-withholding": t("Dans le relevé fiscal de la banque ou sur les avis de dividendes.", "In the bank's tax statement or on the dividend notices.", "Im Steuerauszug der Bank oder auf den Dividendenabrechnungen."),
  trading: t("Relevé des transactions de l'année dans l'e-banking ou la plateforme de courtage.", "The year's transaction statement in e-banking or the broker's platform.", "Transaktionsauszug des Jahres im E-Banking oder auf der Broker-Plattform."),
  crypto: t("Export de la plateforme (soldes au 31.12 et revenus) ; pour un wallet personnel, une capture des soldes au 31.12.", "Platform export (balances at 31.12 and income); for a personal wallet, a screenshot of balances at 31.12.", "Export der Plattform (Bestände per 31.12. und Erträge); bei eigenem Wallet ein Screenshot der Bestände per 31.12."),
  "life-insurance": t("Attestation fiscale annuelle de l'assureur (valeur de rachat au 31.12).", "Insurer's annual tax certificate (surrender value at 31.12).", "Jährliche Steuerbescheinigung der Versicherung (Rückkaufswert per 31.12.)."),
  "loan-given": t("Contrat de prêt ou échange écrit fixant le montant et l'intérêt.", "Loan agreement or written exchange setting the amount and interest.", "Darlehensvertrag oder schriftliche Vereinbarung über Betrag und Zins."),
  "debt-bank": t("Attestation annuelle de solde et d'intérêts envoyée par le prêteur.", "Annual balance and interest certificate from the lender.", "Jährliche Saldo- und Zinsbestätigung des Kreditgebers."),
  "debt-private": t("Contrat de prêt et preuves des intérêts payés (virements).", "Loan agreement and proof of interest paid (transfers).", "Darlehensvertrag und Belege der bezahlten Zinsen (Überweisungen)."),
  "property-value": t("Dernier avis (ou décision) de taxation ou d'estimation mentionnant la valeur du bien.", "Latest assessment or valuation notice showing the property value.", "Letzte Veranlagungs- oder Schätzungsverfügung mit dem Wert der Liegenschaft."),
  "property-purchase": t("Acte notarié et décompte final du notaire.", "Notarial deed and the notary's final statement.", "Notarielle Urkunde und Schlussabrechnung des Notariats."),
  "property-sale": t("Acte de vente, acte d'achat d'origine et factures des travaux à plus-value conservées.", "Sale deed, original purchase deed and kept invoices for value-adding works.", "Verkaufsurkunde, ursprünglicher Kaufvertrag und aufbewahrte Rechnungen wertvermehrender Arbeiten."),
  "property-inherited": t("Certificat d'héritier et acte de partage, ou acte de donation.", "Certificate of inheritance and partition deed, or deed of gift.", "Erbbescheinigung und Teilungsvertrag oder Schenkungsvertrag."),
  "property-works": t("Autorisation de construire et décompte de l'entreprise ou de l'architecte.", "Building permit and the contractor's or architect's statement.", "Baubewilligung und Abrechnung des Unternehmens oder der Architektin."),
  "property-mortgage": t("Attestation annuelle d'intérêts et de solde de la banque (souvent dans l'e-banking ou envoyée en janvier).", "The bank's annual interest and balance certificate (often in e-banking or sent in January).", "Jährliche Zins- und Saldobestätigung der Bank (oft im E-Banking oder im Januar zugestellt)."),
  "property-private-loan": t("Contrat de prêt et preuves des intérêts versés.", "Loan agreement and proof of interest paid.", "Darlehensvertrag und Belege der bezahlten Zinsen."),
  "property-ppe": t("Décompte annuel de l'administrateur de la PPE (charges et fonds de rénovation).", "Annual statement from the condominium manager (charges and renovation fund).", "Jahresabrechnung der STWE-Verwaltung (Nebenkosten und Erneuerungsfonds)."),
  "property-agency": t("Décompte annuel de gérance envoyé par la régie.", "Annual management statement from the agency.", "Jährliche Verwaltungsabrechnung der Liegenschaftsverwaltung."),
  "property-leases": t("Baux en cours et relevé des loyers encaissés dans l'année.", "Current leases and record of rent received during the year.", "Laufende Mietverträge und Aufstellung der Mieteinnahmen des Jahres."),
  "property-invoices": t("Factures des entreprises et preuves de paiement, de préférence classées par nature.", "Contractors' invoices and proof of payment, ideally sorted by type.", "Rechnungen der Unternehmen und Zahlungsbelege, möglichst nach Art sortiert."),
  "property-subsidies": t("Décision du programme de subvention (ex. Programme Bâtiments).", "Decision from the subsidy programme (e.g. Buildings Programme).", "Förderentscheid (z. B. Gebäudeprogramm)."),
  "property-other-canton": t("Avis d'estimation ou de taxation du canton où se trouve le bien.", "Valuation or assessment notice from the canton where the property is located.", "Schätzungs- oder Veranlagungsverfügung des Kantons, in dem die Liegenschaft liegt."),
  "property-foreign-tax": t("Avis d'imposition foncière ou sur le revenu du pays où se trouve le bien.", "Property or income tax notice from the country where the property is located.", "Grund- oder Einkommensteuerbescheid des Belegenheitsstaats."),
  "lamal-subsidy": t("Décision du service cantonal de l'assurance maladie ou mention sur les factures de primes.", "Decision from the cantonal health insurance office or note on premium invoices.", "Verfügung der kantonalen Stelle oder Vermerk auf den Prämienrechnungen."),
  "health-premiums": t("Attestation fiscale annuelle envoyée par votre caisse maladie (souvent dans l'espace client en ligne).", "Annual tax statement from your health insurer (often in the online customer portal).", "Jährliche Steuerbescheinigung Ihrer Krankenkasse (oft im Online-Kundenportal)."),
  p3a: t("Attestation annuelle de la banque ou de l'assurance du 3e pilier (envoyée en début d'année).", "Annual certificate from the pillar 3a bank or insurer (sent early in the year).", "Jahresbescheinigung der Säule-3a-Bank oder -Versicherung (Anfang Jahr zugestellt)."),
  "lpp-buyin": t("Attestation de rachat envoyée par votre caisse de pension.", "Buy-in certificate from your pension fund.", "Einkaufsbestätigung Ihrer Pensionskasse."),
  donations: t("Reçus fiscaux envoyés par les organisations (souvent en début d'année).", "Tax receipts sent by the organisations (often early in the year).", "Spendenbestätigungen der Organisationen (oft Anfang Jahr)."),
  medical: t("Factures et décomptes de remboursement de la caisse maladie (souvent dans l'espace client).", "Invoices and the health insurer's reimbursement statements (often in the customer portal).", "Rechnungen und Leistungsabrechnungen der Krankenkasse (oft im Kundenportal)."),
  training: t("Factures de l'organisme de formation et preuves de paiement.", "Invoices from the training provider and proof of payment.", "Rechnungen des Bildungsanbieters und Zahlungsbelege."),
  inheritance: t("Documents remis par le notaire ou l'exécuteur testamentaire.", "Documents from the notary or executor.", "Unterlagen des Notariats oder der Willensvollstreckung."),
  winnings: t("Attestation de gain de la loterie ou du casino ; pour un site en ligne, relevé du compte joueur.", "Win certificate from the lottery or casino; for an online site, the player account statement.", "Gewinnbestätigung der Lotterie oder des Casinos; bei Online-Seiten der Spielerkontoauszug."),
  regularisation: t("Rassemblez ce que vous avez ; nous verrons ensemble ce qui manque.", "Gather what you have; we will see together what is missing.", "Sammeln Sie, was Sie haben; wir klären gemeinsam, was fehlt."),
  trust: t("Acte de trust ou statuts, et lettre annuelle du trustee ou relevés des distributions.", "Trust deed or charter, and the trustee's annual letter or distribution statements.", "Trusturkunde oder Statuten sowie Jahresbrief des Trustees oder Ausschüttungsbelege."),
  "ark-doc": t("Document demandé par Ark à partir de nos échanges ; en cas de doute, appelez-nous.", "Document requested by Ark from our exchanges; if in doubt, call us.", "Von Ark aufgrund unseres Austauschs angefordertes Dokument; rufen Sie uns im Zweifel an."),
  "older-years": t("Les mêmes documents que pour l'année principale, pour l'année indiquée.", "The same documents as for the main year, for the year shown.", "Dieselben Dokumente wie für das Hauptjahr, für das angegebene Jahr."),
};

const BANK_HINT = t(
  "Dans l'e-banking, rubrique documents (relevé fiscal / attestation fiscale), ou sur demande à votre conseiller.",
  "In e-banking, documents section (tax statement), or on request from your adviser.",
  "Im E-Banking unter Dokumente (Steuerauszug), oder auf Anfrage bei Ihrer Beraterin / Ihrem Berater.",
);
const INSURER_HINT = t(
  "Dans votre espace client en ligne, rubrique documents, ou sur demande au service clients.",
  "In your online customer portal, documents section, or on request from customer service.",
  "Im Online-Kundenportal unter Dokumente, oder auf Anfrage beim Kundendienst.",
);
const APP_HINT = t(
  "Dans l'application ou l'espace en ligne, rubrique documents (attestation fiscale annuelle).",
  "In the app or online portal, documents section (annual tax certificate).",
  "In der App oder im Online-Portal unter Dokumente (jährliche Steuerbescheinigung).",
);

interface Institution {
  name: string;
  aliases: string[];
  hint: L;
  extra?: L;
}

export const INSTITUTIONS: Institution[] = [
  { name: "UBS", aliases: ["ubs", "credit suisse", "credit-suisse", "cs"], hint: BANK_HINT, extra: t("Les anciens comptes Credit Suisse sont repris par UBS.", "Former Credit Suisse accounts are now with UBS.", "Frühere Credit-Suisse-Konten werden von der UBS geführt.") },
  { name: "PostFinance", aliases: ["postfinance", "post finance", "la poste"], hint: BANK_HINT },
  { name: "Raiffeisen", aliases: ["raiffeisen"], hint: BANK_HINT },
  { name: "BCGE", aliases: ["bcge", "banque cantonale de geneve"], hint: BANK_HINT },
  { name: "BCV", aliases: ["bcv", "banque cantonale vaudoise"], hint: BANK_HINT },
  { name: "ZKB", aliases: ["zkb", "zurcher kantonalbank", "zuercher kantonalbank", "zurich cantonal bank"], hint: BANK_HINT },
  { name: "Swissquote", aliases: ["swissquote"], hint: BANK_HINT },
  { name: "Banque Migros", aliases: ["migros bank", "migrosbank", "banque migros"], hint: BANK_HINT },
  { name: "Swiss Life", aliases: ["swiss life", "swisslife"], hint: INSURER_HINT },
  { name: "AXA", aliases: ["axa"], hint: INSURER_HINT },
  { name: "Helvetia", aliases: ["helvetia"], hint: INSURER_HINT },
  { name: "Zurich", aliases: ["zurich assurance", "zurich insurance", "zurich versicherung", "zurich"], hint: INSURER_HINT },
  { name: "VIAC", aliases: ["viac"], hint: APP_HINT },
  { name: "frankly", aliases: ["frankly"], hint: APP_HINT },
  { name: "Finpension", aliases: ["finpension"], hint: APP_HINT },
];

const norm = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

/** Finds a known institution in a free-text name (whole-word alias match, accents and case ignored). */
export function matchInstitution(text: string): Institution | null {
  const haystack = ` ${norm(text)} `;
  if (!haystack.trim()) return null;
  // Longest alias first, so "zurich cantonal bank" wins over "zurich".
  const candidates = INSTITUTIONS.flatMap((inst) => inst.aliases.map((alias) => ({ inst, alias: norm(alias) }))).sort((x, y) => y.alias.length - x.alias.length);
  for (const { inst, alias } of candidates) if (haystack.includes(` ${alias} `)) return inst;
  return null;
}

/** Row title inside a checklist label ("… – UBS"). */
export function rowTitleOf(item: DocItem): string {
  const label = item.label.fr;
  const index = label.lastIndexOf(" – ");
  return index >= 0 ? label.slice(index + 3).trim() : "";
}

const INSTITUTION_RULES = new Set(["bank", "bank-statements", "trading", "foreign-withholding", "life-insurance", "debt-bank", "property-mortgage", "pension", "capital", "p3a", "health-premiums", "lpp-buyin"]);

/** One-line "where to find it" hint, institution-specific when the row names a known provider. */
export function whereToFind(item: DocItem, locale: QfLocale): string {
  const generic = RULE_HINTS[item.ruleId]?.[locale] || "";
  if (!INSTITUTION_RULES.has(item.ruleId)) return generic;
  const inst = matchInstitution(rowTitleOf(item));
  if (!inst) return generic;
  return [`${inst.name}${locale === "fr" ? " : " : ": "}${inst.hint[locale]}`, inst.extra?.[locale]].filter(Boolean).join(" ");
}

const TEMPLATE: Record<QfLocale, { subject: string; body: string }> = {
  fr: {
    subject: "Demande de document pour ma déclaration d'impôt {year}",
    body: "Bonjour,\n\nPour ma déclaration d'impôt {year}, pourriez-vous m'envoyer le document suivant :\n{document}\n\nMerci d'avance et meilleures salutations,\n{name}",
  },
  en: {
    subject: "Document request for my {year} tax return",
    body: "Hello,\n\nFor my {year} tax return, could you please send me the following document:\n{document}\n\nThank you in advance and kind regards,\n{name}",
  },
  de: {
    subject: "Dokumentenanfrage für meine Steuererklärung {year}",
    body: "Guten Tag\n\nFür meine Steuererklärung {year} bitte ich Sie um folgendes Dokument:\n{document}\n\nBesten Dank im Voraus und freundliche Grüsse\n{name}",
  },
};

/** A short, copyable e-mail asking the institution or employer for the document. */
export function requestTemplate(item: DocItem, locale: QfLocale, clientName: string, year?: number): { subject: string; body: string } {
  const y = String(year ?? (/\b(20\d{2})\b/.exec(item.label[locale])?.[1] || ""));
  const fill = (s: string) => s.replace(/\{year\}/g, y).replace(/\{document\}/g, item.label[locale]).replace(/\{name\}/g, clientName.trim());
  return { subject: fill(TEMPLATE[locale].subject).replace(/\s+/g, " ").trim(), body: fill(TEMPLATE[locale].body) };
}
