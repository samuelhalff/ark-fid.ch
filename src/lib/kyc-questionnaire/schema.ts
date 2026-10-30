/**
 * The KYC questionnaire: Dima's Word forms (KYC PP, KYC PM operating, KYC PM non-operating,
 * 29.10.2026) turned into screens, with the corrections of the review of 30.10.2026:
 * - the form is chosen by Ark before sending (route), never by the client;
 * - operating company: art. 2a al. 3 LBA, asked step by step (25 % alone or in concert, then
 *   control by other means, then the most senior manager);
 * - non-operating company (art. 2a al. 6 LBA): every beneficial owner of the assets, no threshold;
 * - listed company: art. 4 al. 1 LBA, Ark decides whether to waive the identification;
 * - PEP categories of art. 2a al. 1 LBA; criminal question limited to relevant offences;
 * - premises and staff asked separately (indicators only, for Ark's assessment).
 * Every answer is a fact for Ark's review: the form never announces a legal qualification.
 */
import { t, type Answers, type FieldDef, type GroupDef, type Option, type Row, type StepDef } from "./types";

// ---- predicates ------------------------------------------------------------------------------------

export const routeOf = (a: Answers) => String(a.route || "");
export const isPP = (a: Answers) => routeOf(a) === "pp";
export const isPM = (a: Answers) => routeOf(a).startsWith("pm-");
export const isOp = (a: Answers) => routeOf(a) === "pm-op";
export const isNonOp = (a: Answers) => routeOf(a) === "pm-nonop";
const is = (id: string, value: string) => (a: Answers) => a[id] === value;
const has = (id: string, value: string) => (a: Answers) => Array.isArray(a[id]) && (a[id] as string[]).includes(value);
const rowIs = (id: string, value: string) => (_a: Answers, row?: Row) => row?.[id] === value;
export const isListed = (a: Answers) => isPM(a) && a["a.listed"] === "yes";
const cascade = (a: Answers) => isOp(a) && !isListed(a);
/** Art. 2a al. 3 LBA: nobody controls by 25 % or otherwise, or the controlling person cannot be identified. */
export const needsManager = (a: Answers) =>
  cascade(a) && (a["b.q25"] === "unidentified" || (a["b.q25"] === "no" && (a["b.qOther"] === "no" || a["b.qOther"] === "unidentified")));

// ---- reusable fields -------------------------------------------------------------------------------

const yesNo = (id: string, label: ReturnType<typeof t>, extra: Partial<FieldDef> = {}): FieldDef => ({ kind: "field", id, type: "yesno", label, required: true, ...extra });

const personFields = (opts: { address?: boolean; birth?: boolean } = {}): FieldDef[] => [
  { kind: "field", id: "lastName", type: "text", label: t("Nom", "Last name"), required: true, width: "half" },
  { kind: "field", id: "firstName", type: "text", label: t("Prénom(s)", "First name(s)"), required: true, width: "half" },
  ...(opts.birth === false ? [] : [{ kind: "field", id: "birthDate", type: "date", label: t("Date de naissance", "Date of birth"), required: true, width: "half" } as FieldDef]),
  { kind: "field", id: "nationality", type: "text", label: t("Nationalité(s)", "Nationality(ies)"), required: true, width: "half" },
  ...(opts.address === false
    ? []
    : [
        { kind: "field", id: "address", type: "text", label: t("Adresse de domicile (rue, n°, NPA, localité)", "Residential address (street, no., postcode, town)"), required: true, maxLength: 300 } as FieldDef,
        { kind: "field", id: "country", type: "text", label: t("Pays de domicile", "Country of residence"), required: true, width: "half" } as FieldDef,
      ]),
];

const COUNTRY_HELP = t("Par exemple : Suisse, France.", "For example: Switzerland, France.");

// ---- options ---------------------------------------------------------------------------------------

const PM_SERVICES: Option[] = [
  { value: "formation", label: t("Constitution de société ou de filiale", "Incorporation of a company or subsidiary") },
  { value: "domiciliation", label: t("Domiciliation / siège", "Domiciliation / registered office") },
  { value: "directorship", label: t("Mandat d'administrateur ou de gérant", "Director or manager mandate") },
  { value: "secretariat", label: t("Administration courante de société (secrétariat juridique)", "Day-to-day company administration (corporate secretarial services)") },
  { value: "transparency", label: t("Annonce au registre de transparence", "Filing with the transparency register") },
  { value: "accounting", label: t("Comptabilité et états financiers", "Accounting and financial statements") },
  { value: "tax", label: t("Fiscalité et TVA", "Tax and VAT") },
  { value: "payroll", label: t("Salaires", "Payroll") },
  { value: "restructuring", label: t("Restructuration, fusion ou vente de la société", "Restructuring, merger or sale of the company") },
  { value: "realEstate", label: t("Conseil pour l'achat ou la vente d'un immeuble", "Advice on buying or selling real estate") },
  { value: "payments", label: t("Trafic des paiements (gestion des paiements bancaires pour le client)", "Payment services (handling the client's bank payments)") },
  { value: "other", label: t("Autre", "Other") },
];

const PP_SERVICES: Option[] = [
  { value: "formation", label: t("Constitution de société(s)", "Incorporation of company(ies)") },
  { value: "domiciliation", label: t("Domiciliation / siège", "Domiciliation / registered office") },
  { value: "directorship", label: t("Mandat d'administrateur ou de gérant", "Director or manager mandate") },
  { value: "secretariat", label: t("Administration courante de société (secrétariat juridique)", "Day-to-day company administration (corporate secretarial services)") },
  { value: "accounting", label: t("Comptabilité et états financiers", "Accounting and financial statements") },
  { value: "tax", label: t("Fiscalité et TVA", "Tax and VAT") },
  { value: "payroll", label: t("Salaires", "Payroll") },
  { value: "restructuring", label: t("Restructuration, fusion ou vente de société", "Restructuring, merger or sale of a company") },
  { value: "realEstate", label: t("Conseil pour l'achat ou la vente d'un immeuble", "Advice on buying or selling real estate") },
  { value: "payments", label: t("Trafic des paiements (gestion des paiements bancaires)", "Payment services (handling bank payments)") },
  { value: "other", label: t("Autre", "Other") },
];

const PM_OPERATIONS: Option[] = [
  { value: "domestic", label: t("Virements en Suisse", "Transfers within Switzerland") },
  { value: "international", label: t("Virements internationaux", "International transfers") },
  { value: "trade", label: t("Paiements de clients et à des fournisseurs", "Payments from customers and to suppliers") },
  { value: "salaries", label: t("Salaires et charges sociales", "Salaries and social charges") },
  { value: "intragroup", label: t("Paiements entre sociétés du même groupe", "Payments between group companies") },
  { value: "shareholder", label: t("Prêts d'actionnaires, apports en capital ou dividendes", "Shareholder loans, capital contributions or dividends") },
  { value: "realEstate", label: t("Achats ou ventes immobiliers", "Real estate purchases or sales") },
  { value: "cash", label: t("Dépôts ou retraits en espèces", "Cash deposits or withdrawals") },
  { value: "crypto", label: t("Crypto-monnaies / crypto-actifs", "Cryptocurrencies / crypto-assets") },
  { value: "other", label: t("Autre", "Other") },
];

const PP_OPERATIONS: Option[] = [
  { value: "domestic", label: t("Virements en Suisse", "Transfers within Switzerland") },
  { value: "international", label: t("Virements internationaux", "International transfers") },
  { value: "cash", label: t("Dépôts ou retraits en espèces", "Cash deposits or withdrawals") },
  { value: "regular", label: t("Paiements réguliers (salaires, loyers, factures, honoraires)", "Regular payments (salaries, rent, invoices, fees)") },
  { value: "securities", label: t("Placements / opérations sur titres", "Investments / securities transactions") },
  { value: "realEstate", label: t("Achats ou ventes immobiliers", "Real estate purchases or sales") },
  { value: "loans", label: t("Prêts accordés ou reçus", "Loans granted or received") },
  { value: "crypto", label: t("Crypto-monnaies / crypto-actifs", "Cryptocurrencies / crypto-assets") },
  { value: "valuables", label: t("Métaux précieux, œuvres d'art ou autres biens de valeur", "Precious metals, art or other valuables") },
  { value: "other", label: t("Autre", "Other") },
];

const CURRENCIES: Option[] = ["CHF", "EUR", "USD", "GBP"].map((c) => ({ value: c, label: t(c, c) })).concat({ value: "other", label: t("Autre", "Other") });

// ---- screens ---------------------------------------------------------------------------------------

const PM_WHO = t(
  "Cette rubrique concerne la société, ses administrateurs, ses signataires, ses actionnaires et ses ayants droit économiques.",
  "This section covers the company, its directors, signatories, shareholders and beneficial owners.",
);

const controllingRowFields = (extra: FieldDef[]): FieldDef[] => [...personFields(), ...extra];

const B_OP_GROUP_25: GroupDef = {
  kind: "group",
  id: "b.controllers25",
  label: t("Personnes détenant au moins 25 %", "Persons holding at least 25%"),
  itemLabel: t("Personne", "Person"),
  titleFields: ["lastName", "firstName"],
  minRows: 1,
  maxRows: 10,
  showIf: (a) => isOp(a) && !isListed(a) && a["b.q25"] === "yes",
  fields: controllingRowFields([
    { kind: "field", id: "percent", type: "percent", label: t("Part du capital ou des voix (%)", "Share of capital or votes (%)"), required: true, width: "half" },
    {
      kind: "field",
      id: "holding",
      type: "checkboxes",
      label: t("Comment la participation est-elle détenue ? Cochez tout ce qui s'applique.", "How is the holding held? Select all that apply."),
      required: true,
      options: [
        { value: "direct", label: t("Directement", "Directly") },
        { value: "indirect", label: t("Indirectement, par une ou plusieurs entités", "Indirectly, through one or more entities") },
        { value: "concert", label: t("De concert avec un ou plusieurs tiers (accord, pacte)", "Acting together with one or more third parties (agreement, pact)") },
      ],
    },
    {
      kind: "field",
      id: "via",
      type: "text",
      label: t("Par quelle(s) entité(s) ou avec qui ?", "Through which entity(ies) or with whom?"),
      required: true,
      maxLength: 300,
      showIf: (_a, row) => Array.isArray(row?.holding) && (row.holding.includes("indirect") || row.holding.includes("concert")),
    },
  ]),
};

const B_OP_GROUP_OTHER: GroupDef = {
  kind: "group",
  id: "b.controllersOther",
  label: t("Personnes contrôlant la société d'une autre manière", "Persons controlling the company in another way"),
  itemLabel: t("Personne", "Person"),
  titleFields: ["lastName", "firstName"],
  minRows: 1,
  maxRows: 10,
  showIf: (a) => isOp(a) && !isListed(a) && a["b.q25"] === "no" && a["b.qOther"] === "yes",
  fields: controllingRowFields([
    { kind: "field", id: "controlType", type: "text", label: t("Nature du contrôle (pacte, droit de veto, droit de nommer le conseil…)", "Type of control (pact, veto right, right to appoint the board…)"), required: true, maxLength: 300 },
  ]),
};

const B_OP_GROUP_MANAGER: GroupDef = {
  kind: "group",
  id: "b.manager",
  label: t("Personne la plus haut placée de la direction", "Most senior member of management"),
  help: t(
    "Si aucune personne physique contrôlant la société par une participation d'au moins 25 % ou d'une autre manière ne peut être identifiée, indiquez le membre le plus haut placé de l'organe de direction (par exemple le directeur général ou le président du conseil d'administration).",
    "If no natural person controlling the company through a holding of at least 25% or by other means can be identified, state the most senior member of the governing body (for example the CEO or the chair of the board).",
  ),
  itemLabel: t("Dirigeant", "Senior manager"),
  titleFields: ["lastName", "firstName"],
  minRows: 1,
  maxRows: 1,
  showIf: needsManager,
  fields: controllingRowFields([{ kind: "field", id: "function", type: "text", label: t("Fonction", "Position"), required: true, width: "half" }]),
};

const B_NONOP_GROUP: GroupDef = {
  kind: "group",
  id: "b.ubos",
  label: t("Ayants droit économiques de l'argent et des biens de la société", "Beneficial owners of the company's money and assets"),
  help: t(
    "Indiquez toutes les personnes à qui appartiennent réellement l'argent et les biens de la société, sans seuil de pourcentage, même si elles n'apparaissent pas directement (par exemple via une autre société).",
    "List every person to whom the company's money and assets really belong, with no percentage threshold, even if they do not appear directly (for example through another company).",
  ),
  itemLabel: t("Ayant droit économique", "Beneficial owner"),
  titleFields: ["lastName", "firstName"],
  minRows: 1,
  maxRows: 10,
  showIf: isNonOp,
  fields: [
    ...personFields(),
    { kind: "field", id: "share", type: "text", label: t("Part ou rôle (facultatif)", "Share or role (optional)"), width: "half" },
    { kind: "field", id: "wealth", type: "textarea", label: t("Origine de sa fortune (salaire, entreprise, héritage, placements…)", "Origin of their wealth (salary, business, inheritance, investments…)"), required: true, maxLength: 1500 },
  ],
};

export const STEPS: StepDef[] = [
  {
    id: "start",
    title: t("Formulaire de connaissance du client (KYC)", "Know your customer form (KYC)"),
    intro: t(
      "Ark Fiduciaire SA est affiliée à l'organisme d'autorégulation SO-FIT. Elle recueille ces informations afin d'identifier ses clients et les ayants droit économiques, de comprendre le but de la relation et de remplir ses obligations légales, notamment celles de la loi sur le blanchiment d'argent (LBA). Les informations sont traitées de manière confidentielle, sous réserve des communications autorisées ou exigées par la loi.",
      "Ark Fiduciaire SA is affiliated with the self-regulatory organisation SO-FIT. It collects this information to identify its clients and beneficial owners, understand the purpose of the relationship and comply with its legal obligations, including those under the Anti-Money Laundering Act (AMLA). The information is handled confidentially, subject to disclosures authorised or required by law.",
    ),
    blocks: [
      // Set by the server from the case (Ark's choice), never by the client.
      { kind: "field", id: "route", type: "select", label: t("Formulaire", "Form"), options: [{ value: "pp", label: t("Personne physique", "Natural person") }, { value: "pm-op", label: t("Personne morale – société opérationnelle", "Legal entity – operating company") }, { value: "pm-nonop", label: t("Personne morale – société non opérationnelle", "Legal entity – non-operating company") }], showIf: () => false },
      {
        kind: "note",
        id: "start.how",
        text: t(
          "Ark a pré-rempli ce qu'elle sait déjà : vérifiez ces réponses et corrigez-les si nécessaire. Complétez le reste, joignez les documents demandés, puis envoyez le formulaire. Vous recevrez ensuite un PDF à imprimer, signer et déposer ici même (copie numérisée ou photo lisible).",
          "Ark has pre-filled what it already knows: check these answers and correct them if needed. Complete the rest, attach the requested documents and send the form. You will then receive a PDF to print, sign and upload here (legible scanned copy or photograph).",
        ),
      },
      {
        kind: "note",
        id: "start.save",
        text: t(
          "Vos réponses sont enregistrées au fur et à mesure : vous pouvez vous arrêter et reprendre plus tard avec le même lien.",
          "Your answers are saved as you go: you can stop and come back later with the same link.",
        ),
      },
      {
        kind: "note",
        id: "start.privacyPolicy",
        text: t(
          "Notre politique de confidentialité explique comment nous traitons vos données et comment exercer vos droits (accès, rectification).",
          "Our privacy policy explains how we process your data and how to exercise your rights (access, rectification).",
        ),
        link: {
          href: t("https://ark-fid.ch/fr/legal/privacy/", "https://ark-fid.ch/en/legal/privacy/"),
          label: t("Politique de confidentialité", "Privacy policy"),
        },
      },
      {
        kind: "field",
        id: "start.privacy",
        type: "boolean",
        required: true,
        label: t(
          "J'ai pris connaissance que ces informations sont traitées par Ark Fiduciaire SA aux fins indiquées ci-dessus. Les documents soumis à l'obligation de conservation de la LBA sont conservés pendant dix ans après la fin de la relation d'affaires ou de la transaction.",
          "I acknowledge that Ark Fiduciaire SA processes this information for the purposes stated above. Documents subject to the AMLA retention requirement are kept for ten years after the business relationship ends or the transaction is completed.",
        ),
      },
    ],
  },

  // ---- A: identification ---------------------------------------------------------------------------
  {
    id: "a.pp",
    section: "A",
    title: t("Vos informations", "Your details"),
    showIf: isPP,
    blocks: [
      { kind: "field", id: "a.lastName", type: "text", label: t("Nom", "Last name"), required: true, width: "half" },
      { kind: "field", id: "a.firstName", type: "text", label: t("Prénom(s)", "First name(s)"), required: true, width: "half" },
      { kind: "field", id: "a.birthDate", type: "date", label: t("Date de naissance", "Date of birth"), required: true, width: "half" },
      { kind: "field", id: "a.birthPlace", type: "text", label: t("Lieu de naissance", "Place of birth"), required: true, width: "half" },
      { kind: "field", id: "a.nationality", type: "text", label: t("Nationalité(s)", "Nationality(ies)"), required: true, width: "half", help: COUNTRY_HELP },
      { kind: "field", id: "a.taxCountry", type: "text", label: t("Pays où vous payez vos impôts", "Country where you pay tax"), required: true, width: "half" },
      { kind: "field", id: "a.address", type: "text", label: t("Adresse de domicile (rue, n°, NPA, localité)", "Residential address (street, no., postcode, town)"), required: true, maxLength: 300 },
      { kind: "field", id: "a.country", type: "text", label: t("Pays de domicile", "Country of residence"), required: true, width: "half" },
      { kind: "field", id: "a.tin", type: "text", label: t("Numéro(s) d'identification fiscale", "Tax identification number(s)"), width: "half" },
      { kind: "field", id: "a.corrAddress", type: "text", label: t("Adresse de correspondance (si différente)", "Correspondence address (if different)"), maxLength: 300 },
      {
        kind: "field",
        id: "a.idType",
        type: "radio",
        label: t("Pièce d'identité", "Identity document"),
        required: true,
        options: [
          { value: "passport", label: t("Passeport", "Passport") },
          { value: "idcard", label: t("Carte d'identité", "Identity card") },
        ],
      },
      { kind: "field", id: "a.idNumber", type: "text", label: t("Numéro de la pièce", "Document number"), required: true, width: "half" },
      { kind: "field", id: "a.idExpiry", type: "date", label: t("Date d'échéance", "Expiry date"), required: true, width: "half" },
      { kind: "field", id: "a.profession", type: "text", label: t("Activité professionnelle", "Occupation"), required: true, width: "half" },
      { kind: "field", id: "a.employer", type: "text", label: t("Employeur / entreprise", "Employer / business"), width: "half" },
      { kind: "field", id: "a.email", type: "email", label: t("E-mail", "Email"), required: true, width: "half" },
      { kind: "field", id: "a.phone", type: "tel", label: t("Téléphone", "Phone"), required: true, width: "half" },
    ],
  },
  {
    id: "a.pm",
    section: "A",
    title: t("La société", "The company"),
    showIf: isPM,
    blocks: [
      { kind: "field", id: "a.name", type: "text", label: t("Raison sociale", "Company name"), required: true },
      { kind: "field", id: "a.legalForm", type: "text", label: t("Forme juridique", "Legal form"), required: true, width: "half" },
      { kind: "field", id: "a.uid", type: "text", label: t("N° IDE (CHE-…) ou n° d'enregistrement étranger", "UID (CHE-…) or foreign registration number"), required: true, width: "half" },
      { kind: "field", id: "a.incorporationDate", type: "date", label: t("Date de constitution", "Date of incorporation"), required: true, width: "half" },
      { kind: "field", id: "a.incorporationCountry", type: "text", label: t("Pays de constitution", "Country of incorporation"), required: true, width: "half" },
      { kind: "field", id: "a.seat", type: "text", label: t("Adresse du siège", "Registered office address"), required: true, maxLength: 300 },
      { kind: "field", id: "a.companyTaxCountry", type: "text", label: t("Pays où la société paie ses impôts", "Country where the company pays tax"), required: true, width: "half" },
      { kind: "field", id: "a.website", type: "text", label: t("Site internet", "Website"), width: "half" },
      { kind: "field", id: "a.contactName", type: "text", label: t("Personne de contact", "Contact person"), required: true, width: "half" },
      { kind: "field", id: "a.contactEmail", type: "email", label: t("E-mail", "Email"), required: true, width: "half" },
      { kind: "field", id: "a.contactPhone", type: "tel", label: t("Téléphone", "Phone"), required: true, width: "half" },
      { kind: "heading", id: "a.activityHeading", label: t("Activité et organisation", "Activity and organisation") },
      {
        kind: "field",
        id: "a.activityKind",
        type: "radio",
        required: true,
        label: t("Laquelle de ces descriptions correspond le mieux à la société ?", "Which of these descriptions fits the company best?"),
        help: t("Ark se fonde sur vos réponses pour son analyse ; elle vous contactera si une précision est nécessaire.", "Ark relies on your answers for its assessment and will contact you if anything needs clarifying."),
        options: [
          { value: "operates", label: t("Elle exerce elle-même une activité commerciale", "It runs a business of its own"), hint: t("Elle vend des biens ou des services, produit, fournit des prestations à des clients.", "It sells goods or services, manufactures, or serves customers.") },
          { value: "supports", label: t("Elle soutient l'activité d'un groupe", "It supports the business of a group"), hint: t("Par exemple : société faîtière qui dirige des sociétés actives, société de financement ou de services du groupe.", "For example: a holding company that manages active companies, a group financing or services company.") },
          { value: "assets", label: t("Elle détient ou gère des avoirs, sans exploiter ni soutenir l'activité d'une entreprise ou d'un groupe", "It holds or manages assets, without running or supporting the business of a company or group"), hint: t("Par exemple : participations, immeubles, titres ou comptes bancaires détenus pour leurs propriétaires.", "For example: shareholdings, real estate, securities or bank accounts held for their owners.") },
          { value: "notStarted", label: t("Elle n'a pas encore commencé son activité", "It has not started its activity yet"), hint: t("Société en création ou récemment constituée.", "Company being formed or recently incorporated.") },
        ],
      },
      yesNo("a.ownPremises", t("La société dispose-t-elle de ses propres locaux (bureaux, atelier, magasin) ?", "Does the company have its own premises (offices, workshop, shop)?"), { width: "half" }),
      { kind: "field", id: "a.activityAddress", type: "text", label: t("Adresse principale où l'activité est exercée, si elle est différente du siège", "Main address where the activity is carried out, if different from the registered office"), maxLength: 300 },
      yesNo("a.ownStaff", t("La société a-t-elle ses propres employés ?", "Does the company have its own employees?"), { width: "half" }),
      { kind: "field", id: "a.staffCount", type: "integer", label: t("Nombre d'employés", "Number of employees"), required: true, width: "half", showIf: is("a.ownStaff", "yes") },
      yesNo("a.listed", t("La société est-elle cotée en bourse, ou détenue majoritairement par une société cotée ?", "Is the company listed on a stock exchange, or majority-owned by a listed company?")),
      { kind: "field", id: "a.listedWhere", type: "text", label: t("Quelle société et sur quelle bourse ?", "Which company and on which exchange?"), required: true, showIf: is("a.listed", "yes") },
      {
        kind: "group",
        id: "a.directors",
        label: t("Administrateurs / gérants", "Directors / managers"),
        itemLabel: t("Administrateur / gérant", "Director / manager"),
        titleFields: ["lastName", "firstName"],
        minRows: 1,
        maxRows: 15,
        fields: [
          { kind: "field", id: "lastName", type: "text", label: t("Nom", "Last name"), required: true, width: "half" },
          { kind: "field", id: "firstName", type: "text", label: t("Prénom(s)", "First name(s)"), required: true, width: "half" },
          { kind: "field", id: "function", type: "text", label: t("Fonction", "Position"), required: true, width: "half" },
          { kind: "field", id: "nationality", type: "text", label: t("Nationalité(s)", "Nationality(ies)"), required: true, width: "half" },
          { kind: "field", id: "country", type: "text", label: t("Pays de domicile", "Country of residence"), required: true, width: "half" },
        ],
      },
      {
        kind: "group",
        id: "a.signatories",
        label: t("Personnes autorisées à signer pour la société", "Persons authorised to sign for the company"),
        itemLabel: t("Signataire", "Signatory"),
        titleFields: ["lastName", "firstName"],
        minRows: 1,
        maxRows: 15,
        fields: [
          { kind: "field", id: "lastName", type: "text", label: t("Nom", "Last name"), required: true, width: "half" },
          { kind: "field", id: "firstName", type: "text", label: t("Prénom(s)", "First name(s)"), required: true, width: "half" },
          { kind: "field", id: "function", type: "text", label: t("Fonction", "Position"), width: "half" },
          {
            kind: "field",
            id: "signing",
            type: "radio",
            label: t("Mode de signature", "Signing authority"),
            required: true,
            options: [
              { value: "individual", label: t("Signature individuelle", "Sole signature") },
              { value: "joint", label: t("Signature collective à deux", "Joint signature by two") },
            ],
          },
        ],
      },
    ],
  },

  // ---- B: beneficial owners ------------------------------------------------------------------------
  {
    id: "b.pp",
    section: "B",
    title: t("Ayant droit économique", "Beneficial owner"),
    intro: t(
      "L'ayant droit économique est la personne à qui appartiennent réellement l'argent et les biens concernés par la relation avec Ark Fiduciaire SA.",
      "The beneficial owner is the person to whom the money and assets involved in the relationship with Ark Fiduciaire SA really belong.",
    ),
    showIf: isPP,
    blocks: [
      {
        kind: "field",
        id: "b.ppOwner",
        type: "radio",
        required: true,
        label: t("Qui est l'ayant droit économique ?", "Who is the beneficial owner?"),
        options: [
          { value: "self", label: t("Je suis le seul ayant droit économique de l'argent et des biens concernés", "I am the sole beneficial owner of the money and assets involved") },
          { value: "others", label: t("Une ou plusieurs autres personnes sont aussi, ou seules, ayants droit économiques", "One or more other persons are also, or solely, beneficial owners") },
        ],
      },
      {
        kind: "group",
        id: "b.ppOthers",
        label: t("Autres ayants droit économiques", "Other beneficial owners"),
        itemLabel: t("Personne", "Person"),
        titleFields: ["lastName", "firstName"],
        minRows: 1,
        maxRows: 10,
        showIf: is("b.ppOwner", "others"),
        fields: [...personFields(), { kind: "field", id: "relation", type: "text", label: t("Lien avec vous", "Relationship to you"), width: "half" }],
      },
      yesNo("b.ppStructure", t("L'argent ou les biens sont-ils détenus via une société, un trust ou une fondation ?", "Are the money or assets held through a company, a trust or a foundation?")),
      { kind: "field", id: "b.ppStructureDetails", type: "textarea", label: t("Précisez (nom, pays, rôle de chaque personne)", "Please specify (name, country, role of each person)"), required: true, showIf: is("b.ppStructure", "yes") },
    ],
  },
  {
    id: "b.pm",
    section: "B",
    title: t("Actionnaires et ayants droit économiques", "Shareholders and beneficial owners"),
    intro: t(
      "Pour une société opérationnelle, cette rubrique identifie les personnes physiques qui la contrôlent en dernier lieu. Pour une société non opérationnelle, elle identifie les ayants droit économiques de l'argent et des biens qu'elle détient, sans seuil de 25 %. Ces personnes peuvent ne pas apparaître directement (par exemple via une autre société).",
      "For an operating company, this section identifies the natural persons who ultimately control it. For a non-operating company, it identifies the beneficial owners of the money and assets it holds, without the 25% threshold. These persons may not appear directly (for example through another company).",
    ),
    showIf: isPM,
    blocks: [
      {
        kind: "note",
        id: "b.listedNote",
        showIf: isListed,
        text: t(
          "Société cotée ou filiale détenue majoritairement par une société cotée : Ark vérifiera si elle peut renoncer à identifier les ayants droit économiques conformément à l'art. 4 al. 1 LBA. Joignez une preuve de la cotation à l'étape « Documents ».",
          "Listed company or subsidiary majority-owned by a listed company: Ark will check whether it may dispense with identifying the beneficial owners under art. 4 para. 1 AMLA. Attach evidence of the listing in the “Documents” step.",
        ),
      },
      {
        kind: "group",
        id: "b.shareholders",
        label: t("Actionnaires / associés", "Shareholders / partners"),
        help: t("Indiquez les actionnaires directs, personnes ou sociétés, avec leur part du capital et des droits de vote.", "List the direct shareholders, persons or companies, with their share of capital and voting rights."),
        itemLabel: t("Actionnaire", "Shareholder"),
        titleFields: ["name"],
        minRows: 1,
        maxRows: 20,
        showIf: (a) => isPM(a) && !isListed(a),
        fields: [
          { kind: "field", id: "name", type: "text", label: t("Nom ou raison sociale", "Name or company name"), required: true },
          {
            kind: "field",
            id: "kind",
            type: "radio",
            label: t("Type", "Type"),
            required: true,
            options: [
              { value: "person", label: t("Personne physique", "Natural person") },
              { value: "company", label: t("Société", "Company") },
              { value: "trust", label: t("Trust ou fondation", "Trust or foundation") },
              { value: "nominee", label: t("Fiduciaire / prête-nom (détient pour le compte d'une autre personne)", "Nominee (holds on behalf of another person)") },
            ],
          },
          { kind: "field", id: "percent", type: "percent", label: t("Part du capital et des voix (%)", "Share of capital and votes (%)"), required: true, width: "half" },
          { kind: "field", id: "behalf", type: "text", label: t("Pour le compte de qui ?", "On whose behalf?"), required: true, showIf: rowIs("kind", "nominee") },
        ],
      },
      // Operating company: art. 2a al. 3 LBA, in order.
      { kind: "heading", id: "b.controlHeading", label: t("Qui contrôle la société ?", "Who controls the company?"), showIf: (a) => isOp(a) && !isListed(a) },
      {
        kind: "field",
        id: "b.q25",
        type: "radio",
        required: true,
        label: t(
          "1. Une ou plusieurs personnes physiques détiennent-elles, directement ou indirectement, seules ou de concert avec des tiers, au moins 25 % du capital ou des droits de vote ?",
          "1. Do one or more natural persons hold, directly or indirectly, alone or acting together with third parties, at least 25% of the capital or voting rights?",
        ),
        options: [
      { value: "yes", label: t("Oui", "Yes") },
      { value: "no", label: t("Non", "No") },
      { value: "unidentified", label: t("Oui, mais la personne physique finale ne peut pas être identifiée", "Yes, but the ultimate natural person cannot be identified") },
    ],
        showIf: cascade,
      },
      B_OP_GROUP_25,
      {
        kind: "field",
        id: "b.qOther",
        type: "radio",
        required: true,
        label: t(
          "2. Une personne physique contrôle-t-elle la société d'une autre manière (par exemple par un pacte d'actionnaires, un droit de veto ou le droit de nommer la majorité du conseil) ?",
          "2. Does a natural person control the company in another way (for example through a shareholders' agreement, a veto right or the right to appoint most of the board)?",
        ),
        options: [
      { value: "yes", label: t("Oui", "Yes") },
      { value: "no", label: t("Non", "No") },
      { value: "unidentified", label: t("Oui, mais la personne physique finale ne peut pas être identifiée", "Yes, but the ultimate natural person cannot be identified") },
    ],
        showIf: (a) => cascade(a) && a["b.q25"] === "no",
      },
      {
        kind: "field",
        id: "b.unidentifiedReason",
        type: "textarea",
        required: true,
        maxLength: 1500,
        label: t("Pourquoi la personne physique finale ne peut-elle pas être identifiée ? Décrivez la chaîne de détention connue.", "Why can the ultimate natural person not be identified? Describe the known ownership chain."),
        showIf: (a) => cascade(a) && (a["b.q25"] === "unidentified" || a["b.qOther"] === "unidentified"),
      },
      B_OP_GROUP_OTHER,
      B_OP_GROUP_MANAGER,
      yesNo(
        "b.forThird",
        t("La société détient-elle de l'argent ou des biens pour le compte d'une autre personne ?", "Does the company hold money or assets on behalf of another person?"),
        { showIf: isOp },
      ),
      { kind: "field", id: "b.forThirdDetails", type: "textarea", label: t("Pour qui et quels avoirs ?", "For whom and which assets?"), required: true, showIf: (a) => isOp(a) && a["b.forThird"] === "yes" },
      // Non-operating company: art. 2a al. 6 LBA, every beneficial owner of the assets.
      B_NONOP_GROUP,
      { kind: "heading", id: "b.structureHeading", label: t("Structure de détention", "Ownership structure") },
      yesNo("b.structure", t("La société est-elle détenue via une autre société, un trust, une fondation ou un prête-nom ?", "Is the company held through another company, a trust, a foundation or a nominee?")),
      {
        kind: "field",
        id: "b.structureKinds",
        type: "checkboxes",
        label: t("Par quoi ?", "Through what?"),
        required: true,
        showIf: is("b.structure", "yes"),
        options: [
          { value: "company", label: t("Une ou plusieurs sociétés", "One or more companies") },
          { value: "trust", label: t("Un trust", "A trust") },
          { value: "foundation", label: t("Une fondation", "A foundation") },
          { value: "nominee", label: t("Un prête-nom / fiduciaire", "A nominee") },
        ],
      },
      { kind: "field", id: "b.structureDetails", type: "textarea", label: t("Décrivez la chaîne de détention jusqu'aux personnes physiques (noms, pays, parts)", "Describe the ownership chain up to the natural persons (names, countries, shares)"), required: true, showIf: is("b.structure", "yes") },
      {
        kind: "note",
        id: "b.structureNote",
        tone: "warning",
        showIf: (a) => has("b.structureKinds", "trust")(a) || has("b.structureKinds", "foundation")(a),
        text: t(
          "Trust ou fondation : Ark vous contactera pour les informations complémentaires (constituant, trustee, protecteur, bénéficiaires). Vous pouvez tout de même envoyer ce formulaire.",
          "Trust or foundation: Ark will contact you for the additional information (settlor, trustee, protector, beneficiaries). You can still send this form.",
        ),
      },
      {
        kind: "field",
        id: "b.transparency",
        type: "radio",
        required: true,
        label: t("La société a-t-elle annoncé ses ayants droit économiques au registre de transparence ?", "Has the company reported its beneficial owners to the transparency register?"),
        help: t("Le registre de transparence est le registre fédéral dans lequel les sociétés suisses annoncent leurs ayants droit économiques.", "The transparency register is the federal register where Swiss companies report their beneficial owners."),
        options: [
          { value: "done", label: t("Oui", "Yes") },
          { value: "notYet", label: t("Non, pas encore", "Not yet") },
          { value: "unknown", label: t("Je ne sais pas", "I don't know") },
          { value: "notConcerned", label: t("La société n'est pas concernée (p. ex. société étrangère)", "The company is not concerned (e.g. foreign company)") },
        ],
      },
      { kind: "field", id: "b.transparencyDate", type: "date", label: t("Date de l'annonce", "Date of filing"), width: "half", showIf: is("b.transparency", "done") },
      {
        kind: "note",
        id: "b.transparencyNote",
        showIf: (a) => a["b.transparency"] === "notYet" || a["b.transparency"] === "unknown",
        text: t("Si l'annonce n'a pas encore été faite, Ark Fiduciaire SA peut s'en charger pour vous.", "If the filing has not been made yet, Ark Fiduciaire SA can do it for you."),
      },
    ],
  },

  // ---- C: PEP, sanctions, criminal proceedings ------------------------------------------------------
  {
    id: "c",
    section: "C",
    title: t("Personnes politiquement exposées, sanctions et procédures", "Politically exposed persons, sanctions and proceedings"),
    blocks: [
      { kind: "note", id: "c.who", text: PM_WHO, showIf: isPM },
      {
        kind: "note",
        id: "c.pepDef",
        text: t(
          "Une personne politiquement exposée (PPE) exerce ou a exercé une fonction dirigeante visée par la LBA : à l'étranger, au niveau national en Suisse, ou au sein d'une organisation intergouvernementale ou d'une fédération sportive internationale. Sont notamment concernés les chefs d'État ou de gouvernement, les responsables politiques nationaux de haut rang, les hauts fonctionnaires de l'administration, de la justice ou de l'armée, les hauts responsables de partis et les dirigeants d'entreprises étatiques d'importance nationale. Les personnes reconnaissablement proches d'une PPE pour des raisons familiales, personnelles ou d'affaires sont des proches de PPE. Une PPE suisse cesse d'être considérée comme telle 18 mois après la fin de sa fonction ; les obligations générales de diligence demeurent réservées.",
          "A politically exposed person (PEP) holds or has held a leading function covered by the AMLA: abroad, at national level in Switzerland, or within an intergovernmental organisation or international sports federation. This includes in particular heads of state or government, senior national politicians, senior officials in government, the judiciary or the military, senior political-party officials and senior officers of nationally important state-owned enterprises. Persons recognisably close to a PEP for family, personal or business reasons are close associates of a PEP. A Swiss PEP ceases to be considered a PEP 18 months after leaving office; the general due-diligence obligations remain applicable.",
        ),
      },
      {
        kind: "field",
        id: "c.pep",
        type: "radio",
        required: true,
        label: t("Personnes politiquement exposées", "Politically exposed persons"),
        options: [
          { value: "none", label: t("Aucune personne concernée n'est une PPE ni proche d'une PPE", "No person concerned is a PEP or close to a PEP") },
          { value: "pep", label: t("Une personne concernée est une PPE", "A person concerned is a PEP") },
          { value: "close", label: t("Une personne concernée est proche d'une PPE (famille, relation personnelle ou d'affaires)", "A person concerned is close to a PEP (family, personal or business relationship)") },
        ],
      },
      {
        kind: "field",
        id: "c.pepKinds",
        type: "checkboxes",
        required: true,
        label: t("Quel type de fonction ?", "What kind of function?"),
        showIf: (a) => a["c.pep"] === "pep" || a["c.pep"] === "close",
        options: [
          { value: "foreign", label: t("Fonction à l'étranger", "Function abroad") },
          { value: "swiss", label: t("Fonction en Suisse (niveau national)", "Function in Switzerland (national level)") },
          { value: "intl", label: t("Organisation internationale ou fédération sportive internationale", "International organisation or international sports federation") },
        ],
      },
      { kind: "field", id: "c.pepDetails", type: "textarea", label: t("Nom, fonction, pays et période (et lien avec la PPE pour un proche)", "Name, function, country and period (and relationship to the PEP for a close associate)"), required: true, showIf: (a) => a["c.pep"] === "pep" || a["c.pep"] === "close" },
      yesNo(
        "c.sanctions",
        t(
          "Une personne concernée figure-t-elle sur une liste de sanctions (Suisse, UE, ONU, États-Unis), ou a-t-elle des relations d'affaires avec des personnes ou des activités visées par des sanctions ?",
          "Is a person concerned on a sanctions list (Switzerland, EU, UN, United States), or do they have business relations with persons or activities targeted by sanctions?",
        ),
      ),
      { kind: "field", id: "c.sanctionsDetails", type: "textarea", label: t("Précisez", "Please specify"), required: true, showIf: is("c.sanctions", "yes") },
      yesNo(
        "c.criminal",
        t(
          "À votre connaissance, une personne concernée fait-elle actuellement l'objet d'une procédure pénale, ou d'une condamnation encore inscrite au casier judiciaire (ou dans un registre étranger équivalent), pour une infraction en lien avec le blanchiment d'argent (par exemple blanchiment, corruption, escroquerie, abus de confiance, délit fiscal qualifié, participation à une organisation criminelle, financement du terrorisme) ?",
          "To your knowledge, is a person concerned currently subject to criminal proceedings, or to a conviction still recorded in a criminal record (or an equivalent foreign register), for an offence relevant to money laundering (for example money laundering, bribery, fraud, criminal breach of trust, a qualified tax offence, participation in a criminal organisation, terrorist financing)?",
        ),
        { help: t("Ne mentionnez pas les procédures closes sans condamnation ni les infractions sans rapport avec ces risques.", "Do not report proceedings closed without a conviction or offences unrelated to these risks.") },
      ),
      { kind: "field", id: "c.criminalDetails", type: "textarea", label: t("Précisez (personne, infraction, autorité, état de la procédure)", "Please specify (person, offence, authority, status of the proceedings)"), required: true, showIf: is("c.criminal", "yes") },
    ],
  },

  // ---- D: services and activity ----------------------------------------------------------------------
  {
    id: "d",
    section: "D",
    title: t("Prestations demandées et activité", "Services requested and activity"),
    blocks: [
      { kind: "field", id: "d.servicesPm", type: "checkboxes", required: true, label: t("Prestations demandées à Ark Fiduciaire SA", "Services requested from Ark Fiduciaire SA"), options: PM_SERVICES, showIf: isPM },
      { kind: "field", id: "d.servicesPp", type: "checkboxes", required: true, label: t("Prestations demandées à Ark Fiduciaire SA", "Services requested from Ark Fiduciaire SA"), options: PP_SERVICES, showIf: isPP },
      { kind: "field", id: "d.servicesOther", type: "text", label: t("Autre prestation : précisez", "Other service: please specify"), required: true, showIf: (a) => has("d.servicesPm", "other")(a) || has("d.servicesPp", "other")(a) },
      { kind: "field", id: "d.purpose", type: "textarea", label: t("But social (selon les statuts)", "Corporate purpose (per the articles)"), required: true, maxLength: 2000, showIf: isPM },
      { kind: "field", id: "d.activity", type: "textarea", label: t("Activité réelle de la société (description)", "Actual activity of the company (description)"), required: true, maxLength: 2000, showIf: isPM },
      { kind: "field", id: "d.companies", type: "textarea", label: t("Société(s) concernée(s) et leur activité (si vous créez ou détenez une société)", "Company(ies) concerned and their activity (if you are setting up or own a company)"), maxLength: 2000, showIf: isPP },
      { kind: "field", id: "d.sector", type: "text", label: t("Secteur d'activité", "Business sector"), required: true, width: "half", showIf: isPM },
      { kind: "field", id: "d.countries", type: "text", label: t("Pays d'activité", "Countries of activity"), required: true, width: "half" },
      { kind: "field", id: "d.counterparties", type: "textarea", label: t("Avec qui travaillez-vous principalement (clients, fournisseurs, partenaires) ?", "Who do you mainly work with (customers, suppliers, partners)?"), required: true, maxLength: 2000 },
      { kind: "field", id: "d.turnover", type: "money", label: t("Dernier chiffre d'affaires annuel (CHF)", "Latest annual turnover (CHF)"), width: "half", showIf: (a) => isPM(a) && a["a.activityKind"] !== "notStarted" },
      { kind: "field", id: "d.balance", type: "money", label: t("Total du bilan (CHF)", "Balance sheet total (CHF)"), width: "half", showIf: (a) => isPM(a) && a["a.activityKind"] !== "notStarted" },
      { kind: "field", id: "d.group", type: "text", label: t("Sociétés du même groupe (le cas échéant)", "Companies of the same group (if any)"), maxLength: 400, showIf: isPM },
      yesNo(
        "d.licence",
        t("L'activité nécessite-t-elle une autorisation officielle pour être exercée en Suisse ?", "Does the activity require an official licence to be carried out in Switzerland?"),
        { help: t("Par exemple : gestion de fortune, activité bancaire, assurance, profession médicale ou juridique réglementée.", "For example: asset management, banking, insurance, a regulated medical or legal profession.") },
      ),
      { kind: "field", id: "d.licenceDetails", type: "text", label: t("Laquelle et où en est son obtention ?", "Which one, and has it been obtained?"), required: true, maxLength: 400, showIf: is("d.licence", "yes") },
    ],
  },

  // ---- E: origin of wealth ---------------------------------------------------------------------------
  {
    id: "e",
    section: "E",
    title: t("Origine de la fortune", "Origin of wealth"),
    blocks: [
      { kind: "field", id: "e.companyAssets", type: "textarea", label: t("D'où proviennent les avoirs de la société ? (capital, bénéfices gardés dans la société, prêts des actionnaires ou de tiers…)", "Where do the company's assets come from? (capital, retained profits, loans from shareholders or third parties…)"), required: true, maxLength: 2000, showIf: isPM },
      { kind: "field", id: "e.ownersWealth", type: "textarea", label: t("Origine de la fortune des personnes indiquées au point B (salaire, entreprise, héritage, placements…)", "Origin of the wealth of the persons listed in section B (salary, business, inheritance, investments…)"), required: true, maxLength: 2000, showIf: (a) => isOp(a) && !isListed(a) },
      { kind: "note", id: "e.nonopNote", text: t("L'origine de la fortune de chaque ayant droit économique a été demandée au point B.", "The origin of each beneficial owner's wealth was asked in section B."), showIf: isNonOp },
      {
        kind: "field",
        id: "e.wealthSources",
        type: "checkboxes",
        required: true,
        label: t("Comment avez-vous constitué votre patrimoine ?", "How did you build up your wealth?"),
        showIf: isPP,
        options: [
          { value: "salary", label: t("Salaire", "Salary") },
          { value: "selfEmployed", label: t("Activité indépendante ou entreprise", "Self-employment or business") },
          { value: "companySale", label: t("Vente d'une société", "Sale of a company") },
          { value: "inheritance", label: t("Héritage ou donation", "Inheritance or gift") },
          { value: "investments", label: t("Placements", "Investments") },
          { value: "realEstate", label: t("Immobilier", "Real estate") },
          { value: "other", label: t("Autre", "Other") },
        ],
      },
      { kind: "field", id: "e.wealthDetails", type: "textarea", label: t("Précisez en quelques mots", "Please explain in a few words"), required: true, maxLength: 2000, showIf: isPP },
      { kind: "field", id: "e.otherWealth", type: "textarea", label: t("Origine de la fortune des autres ayants droit économiques (point B)", "Origin of the wealth of the other beneficial owners (section B)"), required: true, maxLength: 2000, showIf: (a) => isPP(a) && a["b.ppOwner"] === "others" },
    ],
  },

  // ---- F: origin of funds ----------------------------------------------------------------------------
  {
    id: "f",
    section: "F",
    title: t("Origine des fonds", "Origin of funds"),
    blocks: [
      yesNo("f.funds", t("De l'argent sera-t-il versé dans le cadre de ce mandat (par exemple le capital d'une société) ?", "Will money be paid in connection with this mandate (for example a company's capital)?")),
      { kind: "field", id: "f.origin", type: "textarea", label: t("D'où vient concrètement cet argent ?", "Where exactly does this money come from?"), required: true, maxLength: 2000, showIf: is("f.funds", "yes") },
      { kind: "field", id: "f.amount", type: "money", label: t("Montant", "Amount"), required: true, width: "half", showIf: is("f.funds", "yes") },
      { kind: "field", id: "f.currency", type: "select", label: t("Devise", "Currency"), required: true, width: "half", options: CURRENCIES, showIf: is("f.funds", "yes") },
      { kind: "field", id: "f.bank", type: "text", label: t("Banque et pays d'où l'argent sera versé", "Bank and country the money will come from"), required: true, showIf: is("f.funds", "yes") },
      { kind: "field", id: "f.holder", type: "text", label: t("Titulaire du compte", "Account holder"), required: true, width: "half", showIf: is("f.funds", "yes") },
      { kind: "field", id: "f.more", type: "text", label: t("Autres versements prévus ?", "Other payments planned?"), maxLength: 400, showIf: is("f.funds", "yes") },
      { kind: "field", id: "f.otherOwner", type: "textarea", label: t("Si l'argent appartient à un autre ayant droit économique (point B) : origine de ces fonds", "If the money belongs to another beneficial owner (section B): origin of these funds"), maxLength: 2000, showIf: (a) => isPP(a) && a["b.ppOwner"] === "others" && a["f.funds"] === "yes" },
    ],
  },

  // ---- G: expected activity --------------------------------------------------------------------------
  {
    id: "g",
    section: "G",
    title: t("Activité attendue", "Expected activity"),
    intro: t("Pour une société récente ou en création, indiquez des estimations.", "For a new company or one being set up, give estimates."),
    blocks: [
      { kind: "field", id: "g.turnover", type: "money", label: t("Chiffre d'affaires annuel prévu (CHF)", "Expected annual turnover (CHF)"), width: "half", required: true, showIf: isPM },
      { kind: "field", id: "g.turnoverPp", type: "money", label: t("Chiffre d'affaires annuel prévu (CHF, seulement si une société est concernée)", "Expected annual turnover (CHF, only if a company is concerned)"), width: "half", showIf: isPP },
      { kind: "field", id: "g.operations", type: "text", label: t("Opérations par an (nombre et montant total approximatifs)", "Transactions per year (approximate number and total amount)"), required: true },
      { kind: "field", id: "g.typesPm", type: "checkboxes", required: true, label: t("Types d'opérations prévues", "Types of transactions expected"), options: PM_OPERATIONS, showIf: isPM },
      { kind: "field", id: "g.typesPp", type: "checkboxes", required: true, label: t("Types d'opérations prévues", "Types of transactions expected"), options: PP_OPERATIONS, showIf: isPP },
      { kind: "field", id: "g.typesOther", type: "text", label: t("Autre type d'opération : précisez", "Other type of transaction: please specify"), required: true, showIf: (a) => has("g.typesPm", "other")(a) || has("g.typesPp", "other")(a) },
      { kind: "field", id: "g.countries", type: "text", label: t("Pays et devises des paiements", "Countries and currencies of payments"), required: true, maxLength: 400 },
    ],
  },

  // ---- H: documents ----------------------------------------------------------------------------------
  {
    id: "h",
    section: "H",
    title: t("Documents à fournir", "Documents to provide"),
    intro: t(
      "Joignez chaque document, ou indiquez que vous nous le transmettez séparément. Formats acceptés : PDF, JPG, PNG, HEIC.",
      "Attach each document, or say that you will send it to us separately. Accepted formats: PDF, JPG, PNG, HEIC.",
    ),
    special: "documents",
    blocks: [],
  },

  // ---- I: declarations -------------------------------------------------------------------------------
  {
    id: "i",
    section: "I",
    title: t("Déclarations", "Declarations"),
    blocks: [
      {
        kind: "group",
        id: "i.signers",
        label: t("Qui signera ce formulaire au nom de la société ?", "Who will sign this form on behalf of the company?"),
        help: t("Une ou deux personnes autorisées à représenter la société, selon le mode de signature inscrit.", "One or two persons authorised to represent the company, according to the registered signing authority."),
        itemLabel: t("Signataire du formulaire", "Form signatory"),
        titleFields: ["lastName", "firstName"],
        minRows: 1,
        maxRows: 2,
        showIf: isPM,
        fields: [
          { kind: "field", id: "lastName", type: "text", label: t("Nom", "Last name"), required: true, width: "half" },
          { kind: "field", id: "firstName", type: "text", label: t("Prénom(s)", "First name(s)"), required: true, width: "half" },
          { kind: "field", id: "function", type: "text", label: t("Fonction", "Position"), required: true, width: "half" },
        ],
      },
      { kind: "field", id: "i.place", type: "text", label: t("Lieu de signature", "Place of signature"), required: true, width: "half" },
      { kind: "note", id: "i.declarations", text: t("{declarations}", "{declarations}") },
      {
        kind: "field",
        id: "i.accept",
        type: "boolean",
        required: true,
        label: t("J'ai lu ces déclarations. Je les confirmerai en signant le PDF qui sera généré.", "I have read these declarations. I will confirm them by signing the PDF that will be generated."),
      },
    ],
  },

  {
    id: "review",
    title: t("Vérification et envoi", "Review and send"),
    special: "review",
    blocks: [],
  },
];

// ---- declarations (section I), shown in the form and printed in the PDF ----------------------------

export function declarations(a: Answers): { intro: ReturnType<typeof t>; items: ReturnType<typeof t>[]; closing: ReturnType<typeof t> } {
  const closing = t(
    "Les informations et documents transmis ultérieurement par écrit par le client ou ses représentants autorisés, notamment par e-mail, complètent le présent formulaire et en font partie intégrante. Tout changement d'ayant droit économique doit être communiqué sans délai à Ark Fiduciaire SA dans une forme permettant d'en conserver une preuve écrite ; Ark Fiduciaire SA peut demander une nouvelle déclaration signée.",
    "Information and documents later provided in writing by the client or its authorised representatives, including by email, supplement this form and form an integral part of it. Any change of beneficial owner must be reported to Ark Fiduciaire SA without delay in a form that provides written evidence; Ark Fiduciaire SA may request a new signed declaration.",
  );
  if (isPP(a)) {
    return {
      intro: t("En signant ce formulaire, je :", "By signing this form, I:"),
      items: [
        t("déclare que les informations fournies sont exactes et complètes ;", "declare that the information provided is accurate and complete;"),
        t("déclare que l'argent et les biens concernés proviennent d'activités légales ;", "declare that the money and assets involved come from lawful activities;"),
        t("confirme que l'ayant droit économique est celui indiqué au point B ;", "confirm that the beneficial owner is the one stated in section B;"),
        t("confirme ne pas être une PPE ni proche d'une PPE, sauf indication contraire au point C ;", "confirm that I am not a PEP or close to a PEP, unless stated otherwise in section C;"),
        t("confirme ne faire l'objet d'aucune sanction, sauf indication contraire au point C ;", "confirm that I am not subject to any sanctions, unless stated otherwise in section C;"),
        t("m'engage à informer sans délai Ark Fiduciaire SA de tout changement des informations fournies.", "undertake to inform Ark Fiduciaire SA without delay of any change to the information provided."),
      ],
      closing,
    };
  }
  return {
    intro: t("En signant ce formulaire au nom de la société, le ou les soussignés :", "By signing this form on behalf of the company, the undersigned:"),
    items: [
      t("déclarent être autorisés à représenter la société ;", "declare that they are authorised to represent the company;"),
      t("déclarent que les informations fournies sont exactes et complètes ;", "declare that the information provided is accurate and complete;"),
      t("déclarent que les avoirs de la société proviennent d'activités légales ;", "declare that the company's assets come from lawful activities;"),
      isNonOp(a)
        ? t("confirment que les ayants droit économiques de l'argent et des biens de la société sont ceux indiqués au point B ;", "confirm that the beneficial owners of the company's money and assets are those stated in section B;")
        : t(
            "confirment que les informations fournies au point B concernant les ayants droit économiques ou, lorsque ceux-ci n'ont pas pu être identifiés, le membre le plus haut placé de l'organe de direction, sont exactes et complètes ;",
            "confirm that the information provided in section B concerning the beneficial owners or, where they could not be identified, the most senior member of the governing body, is accurate and complete;",
          ),
      t("confirment qu'aucune personne mentionnée n'est une PPE ni proche d'une PPE, sauf indication contraire au point C ;", "confirm that no person mentioned is a PEP or close to a PEP, unless stated otherwise in section C;"),
      t("confirment que ni la société ni ces personnes ne font l'objet de sanctions, sauf indication contraire au point C ;", "confirm that neither the company nor these persons are subject to sanctions, unless stated otherwise in section C;"),
      t(
        "s'engagent à informer sans délai Ark Fiduciaire SA de tout changement (actionnaires, ayants droit économiques, administrateurs, signataires, activité).",
        "undertake to inform Ark Fiduciaire SA without delay of any change (shareholders, beneficial owners, directors, signatories, activity).",
      ),
    ],
    closing,
  };
}

/** Name of the client as shown in titles: company name, or "NOM Prénom". */
export function clientName(a: Answers): string {
  if (isPM(a)) return String(a["a.name"] || "").trim();
  const last = String(a["a.lastName"] || "").trim();
  return [last ? last.toLocaleUpperCase("fr-CH") : "", String(a["a.firstName"] || "").trim()].filter(Boolean).join(" ");
}

/** Persons of section B (controlling persons or beneficial owners), for documents and the PDF. */
export function sectionBPersons(a: Answers): { group: string; row: Row }[] {
  const ids = isPP(a) ? ["b.ppOthers"] : isNonOp(a) ? ["b.ubos"] : ["b.controllers25", "b.controllersOther", "b.manager"];
  const out: { group: string; row: Row }[] = [];
  for (const id of ids) {
    const visible = STEPS.some((s) => (!s.showIf || s.showIf(a)) && s.blocks.some((b) => b.id === id && (!b.showIf || b.showIf(a))));
    if (!visible) continue;
    for (const row of Array.isArray(a[id]) ? (a[id] as Row[]) : []) out.push({ group: id, row });
  }
  return out;
}
