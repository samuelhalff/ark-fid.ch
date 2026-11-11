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

// ---- options ---------------------------------------------------------------------------------------

const PM_SERVICES: Option[] = [
  { value: "formation", label: t("Création d’une société ou d’une filiale", "Setting up a company or a subsidiary") },
  { value: "domiciliation", label: t("Domiciliation (siège de la société chez nous)", "Domiciliation (company's registered office with us)") },
  { value: "directorship", label: t("Ark Fiduciaire SA devient administrateur ou gérant de la société", "Ark Fiduciaire SA acts as director or manager of the company") },
  { value: "secretariat", label: t("Secrétariat juridique de la société (assemblées, procès-verbaux…)", "Corporate secretarial services (meetings, minutes…)") },
  { value: "transparency", label: t("Déclaration au registre de transparence", "Filing with the transparency register") },
  { value: "accounting", label: t("Comptabilité et comptes annuels", "Accounting and annual accounts") },
  { value: "tax", label: t("Impôts et TVA", "Tax and VAT") },
  { value: "payroll", label: t("Salaires (paie)", "Payroll") },
  { value: "restructuring", label: t("Restructuration, fusion ou vente de la société", "Restructuring, merger or sale of the company") },
  { value: "realEstate", label: t("Conseil pour l’achat ou la vente d’un immeuble", "Advice on buying or selling real estate") },
  { value: "payments", label: t("Gestion de vos paiements bancaires", "Handling your bank payments") },
  { value: "other", label: t("Autre", "Other") },
];

const PP_SERVICES: Option[] = [
  { value: "formation", label: t("Création d’une ou plusieurs sociétés", "Setting up one or more companies") },
  { value: "domiciliation", label: t("Domiciliation (siège de la société chez nous)", "Domiciliation (company's registered office with us)") },
  { value: "directorship", label: t("Ark Fiduciaire SA devient administrateur ou gérant de la société", "Ark Fiduciaire SA acts as director or manager of the company") },
  { value: "secretariat", label: t("Secrétariat juridique de la société (assemblées, procès-verbaux…)", "Corporate secretarial services (meetings, minutes…)") },
  { value: "accounting", label: t("Comptabilité et comptes annuels", "Accounting and annual accounts") },
  { value: "tax", label: t("Impôts et TVA", "Tax and VAT") },
  { value: "payroll", label: t("Salaires (paie)", "Payroll") },
  { value: "restructuring", label: t("Restructuration, fusion ou vente d’une société", "Restructuring, merger or sale of a company") },
  { value: "realEstate", label: t("Conseil pour l’achat ou la vente d’un immeuble", "Advice on buying or selling real estate") },
  { value: "payments", label: t("Gestion de vos paiements bancaires", "Handling your bank payments") },
  { value: "other", label: t("Autre", "Other") },
];

const PM_OPERATIONS: Option[] = [
  { value: "domestic", label: t("Virements en Suisse", "Transfers within Switzerland") },
  { value: "international", label: t("Virements à l’étranger ou depuis l’étranger", "Transfers to or from abroad") },
  { value: "trade", label: t("Paiements de clients et à des fournisseurs", "Payments from customers and to suppliers") },
  { value: "salaries", label: t("Salaires et charges sociales", "Salaries and social charges") },
  { value: "intragroup", label: t("Paiements entre sociétés du même groupe", "Payments between group companies") },
  { value: "shareholder", label: t("Prêts d’actionnaires, argent apporté au capital, dividendes", "Shareholder loans, money paid into the capital, dividends") },
  { value: "realEstate", label: t("Achats ou ventes d’immeubles", "Real estate purchases or sales") },
  { value: "cash", label: t("Dépôts ou retraits en espèces", "Cash deposits or withdrawals") },
  { value: "crypto", label: t("Cryptomonnaies", "Cryptocurrencies") },
  { value: "other", label: t("Autre", "Other") },
];

const PP_OPERATIONS: Option[] = [
  { value: "domestic", label: t("Virements en Suisse", "Transfers within Switzerland") },
  { value: "international", label: t("Virements à l’étranger ou depuis l’étranger", "Transfers to or from abroad") },
  { value: "cash", label: t("Dépôts ou retraits en espèces", "Cash deposits or withdrawals") },
  { value: "regular", label: t("Paiements réguliers (salaires, loyers, factures, honoraires)", "Regular payments (salaries, rent, invoices, fees)") },
  { value: "securities", label: t("Placements (actions, obligations, fonds)", "Investments (shares, bonds, funds)") },
  { value: "realEstate", label: t("Achats ou ventes d’immeubles", "Real estate purchases or sales") },
  { value: "loans", label: t("Prêts accordés ou reçus", "Loans granted or received") },
  { value: "crypto", label: t("Cryptomonnaies", "Cryptocurrencies") },
  { value: "valuables", label: t("Métaux précieux, œuvres d’art ou autres objets de valeur", "Precious metals, art or other valuables") },
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
  label: t("Qui détient au moins 25 % ?", "Who holds at least 25%?"),
  help: t("Une ligne par personne (un être humain). Si la part passe par une société, indiquez la personne qui est derrière.", "One line per person (a human being). If the share is held through a company, give the person behind it."),
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
        { value: "direct", label: t("Directement, en son nom", "Directly, in its own name") },
        { value: "indirect", label: t("Via une ou plusieurs sociétés ou structures", "Through one or more companies or structures") },
        { value: "concert", label: t("En accord avec d’autres personnes (pacte, convention)", "By agreement with other people (pact, agreement)") },
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
  label: t("Qui contrôle la société par d’autres moyens (pacte, veto, nomination du conseil) ?", "Who controls the company by other means (agreement, veto, appointment of the board)?"),
  help: t("Une ligne par personne.", "One line per person."),
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
  label: t("Dirigeant principal de la société", "Top executive of the company"),
  help: t("La personne qui a la plus haute fonction de direction : directeur général, CEO, gérant…", "The person with the most senior management role: managing director, CEO, manager…"),
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
  label: t("Ayants droit économiques de l’argent et des biens de la société (les personnes à qui ils appartiennent vraiment)", "Beneficial owners of the company’s money and assets (the people they really belong to)"),
  help: t("Ce sont des êtres humains (personnes physiques). Indiquez-les toutes, sans seuil de pourcentage, même si elles n’apparaissent pas directement (par exemple via une autre société).", "These are human beings (individuals). List all of them, with no percentage threshold, even if they do not appear directly (for example through another company)."),
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
          "Vos réponses sont enregistrées au fur et à mesure : vous pouvez vous arrêter et reprendre plus tard avec le même lien, ou sur kyc.ark-fid.ch avec un code reçu à votre adresse e-mail.",
          "Your answers are saved as you go: you can stop and come back later with the same link, or on kyc.ark-fid.ch with a code sent to your e-mail address.",
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
        help: t("Le texte au-dessus explique pourquoi nous demandons ces informations. Cochez la case une fois que vous l’avez lu.", "The text above explains why we ask for this information. Tick the box once you have read it."),
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
      { kind: "field", id: "a.birthPlace", type: "text", label: t("Lieu de naissance", "Place of birth"), help: t("Ville et pays de naissance, comme sur la pièce d’identité.", "City and country of birth, as on your ID."), required: true, width: "half" },
      { kind: "field", id: "a.nationality", type: "text", label: t("Nationalité(s)", "Nationality(ies)"), required: true, width: "half", help: t("Toutes vos nationalités, si vous en avez plusieurs.", "All your nationalities, if you have more than one.") },
      { kind: "field", id: "a.taxCountry", type: "text", label: t("Pays où vous payez vos impôts", "Country where you pay tax"), help: t("Le pays où vous êtes assujetti à l’impôt. Si vous l’êtes dans plusieurs pays, indiquez-les tous.", "The country where you are subject to tax. If you are subject to tax in several countries, list them all."), required: true, width: "half" },
      { kind: "field", id: "a.address", type: "text", label: t("Adresse de domicile", "Home address"), help: t("L’adresse où vous habitez vraiment, pas une case postale. Rue, numéro, code postal, localité.", "The address where you actually live, not a P.O. box. Street, number, postcode, town."), required: true, maxLength: 300 },
      { kind: "field", id: "a.country", type: "text", label: t("Pays où vous habitez", "Country where you live"), required: true, width: "half" },
      { kind: "field", id: "a.tin", type: "text", label: t("Numéro fiscal de chaque pays où vous payez des impôts, si vous en avez", "Tax number for each country where you pay tax, if you have one"), help: t("C’est le numéro d’identification fiscale (NIF) donné par l’administration fiscale. En Suisse, c’est en général le numéro AVS (756…).", "This is the tax identification number (TIN) issued by the tax authority. In Switzerland it is usually the AVS/AHV number (756…)."), width: "half" },
      { kind: "field", id: "a.corrAddress", type: "text", label: t("Adresse postale, si elle est différente", "Mailing address, if different"), maxLength: 300 },
      {
        kind: "field",
        id: "a.idType",
        type: "radio",
        label: t("Quel type de pièce d’identité présentez-vous ?", "Which type of ID document are you providing?"),
        help: t("Passeport ou carte d’identité : choisissez celle que vous présentez.", "Passport or identity card: choose the one you are providing."),
        required: true,
        options: [
          { value: "passport", label: t("Passeport", "Passport") },
          { value: "idcard", label: t("Carte d’identité", "Identity card") },
        ],
      },
      { kind: "field", id: "a.idNumber", type: "text", label: t("Numéro du document d’identité", "Identity document number"), required: true, width: "half" },
      { kind: "field", id: "a.idExpiry", type: "date", label: t("Date de fin de validité", "Expiry date"), required: true, width: "half" },
      { kind: "field", id: "a.profession", type: "text", label: t("Votre activité professionnelle", "Your occupation"), help: t("Ce que vous faites comme travail aujourd’hui. Retraité ou sans emploi : écrivez-le.", "What you do for work today. Retired or not working: write that."), required: true, width: "half" },
      { kind: "field", id: "a.employer", type: "text", label: t("Nom de votre employeur ou de votre entreprise", "Name of your employer or your business"), width: "half" },
      { kind: "field", id: "a.email", type: "email", label: t("E-mail", "Email"), required: true, width: "half" },
      { kind: "field", id: "a.phone", type: "tel", label: t("Téléphone", "Phone"), help: t("Avec l’indicatif du pays si le numéro n’est pas suisse (+33…).", "With the country code if the number is not Swiss (+33…)."), required: true, width: "half" },
    ],
  },
  {
    id: "a.pm",
    section: "A",
    title: t("La société", "The company"),
    showIf: isPM,
    blocks: [
      { kind: "field", id: "a.name", type: "text", label: t("Nom de la société", "Company name"), help: t("Le nom exact de la société, avec sa forme (SA, Sàrl…), tel qu’il figure au registre du commerce ou dans les statuts.", "The exact name of the company, with its legal form (SA, Sàrl…), as it appears in the commercial register or the articles of association."), required: true },
      { kind: "field", id: "a.legalForm", type: "text", label: t("Forme juridique (SA, Sàrl, Ltd…)", "Legal form (SA, Sàrl, Ltd…)"), required: true, width: "half" },
      { kind: "field", id: "a.uid", type: "text", label: t("Numéro IDE (CHE-…) ou numéro d’immatriculation étranger", "UID number (CHE-…) or foreign registration number"), help: t("Le numéro IDE figure sur l’extrait du registre du commerce (CHE-123.456.789). Société étrangère : le numéro de son registre.", "The UID is shown on the commercial register extract (CHE-123.456.789). Foreign company: the number in its own register."), required: true, width: "half" },
      { kind: "field", id: "a.incorporationDate", type: "date", label: t("Date de constitution de la société", "Date of incorporation of the company"), help: t("Le jour où la société a été créée : la date des statuts, indiquée sur l’extrait du registre du commerce.", "The day the company was created: the date of the articles of association, shown on the commercial register extract."), required: true, width: "half" },
      { kind: "field", id: "a.incorporationCountry", type: "text", label: t("Pays de constitution de la société", "Country of incorporation of the company"), help: t("Le pays où la société a été créée et enregistrée.", "The country where the company was created and registered."), required: true, width: "half" },
      { kind: "field", id: "a.seat", type: "text", label: t("Adresse du siège de la société", "Company's registered address"), required: true, maxLength: 300 },
      { kind: "field", id: "a.companyTaxCountry", type: "text", label: t("Pays où la société paie ses impôts", "Country where the company pays tax"), help: t("Le pays où la société paie ses impôts.", "The country where the company pays its taxes."), required: true, width: "half" },
      { kind: "field", id: "a.website", type: "text", label: t("Site internet", "Website"), width: "half" },
      { kind: "field", id: "a.contactName", type: "text", label: t("Personne à contacter pour ce dossier", "Person to contact about this file"), required: true, width: "half" },
      { kind: "field", id: "a.contactEmail", type: "email", label: t("E-mail de la personne de contact", "Contact person's email"), required: true, width: "half" },
      { kind: "field", id: "a.contactPhone", type: "tel", label: t("Téléphone de la personne de contact", "Contact person's phone"), required: true, width: "half" },
      { kind: "heading", id: "a.activityHeading", label: t("Activité et organisation", "Activity and organisation") },
      {
        kind: "field",
        id: "a.activityKind",
        type: "radio",
        required: true,
        label: t("Quelle phrase décrit le mieux la société ?", "Which sentence describes the company best?"),
        help: t("Choisissez celle qui correspond le mieux à ce que fait la société aujourd’hui.", "Choose the one that best matches what the company does today."),
        options: [
          { value: "operates", label: t("Elle a sa propre activité : elle vend des produits ou des services", "It has its own business: it sells products or services"), hint: t("Elle vend des biens ou des services, produit, fournit des prestations à des clients.", "It sells goods or services, manufactures, or serves customers.") },
          { value: "supports", label: t("Elle soutient l’activité d’un groupe de sociétés", "It supports the business of a group of companies"), hint: t("Par exemple : société faîtière qui dirige des sociétés actives, société de financement ou de services du groupe.", "For example: a holding company that manages active companies, a group financing or services company.") },
          { value: "assets", label: t("Elle détient seulement de l’argent ou des biens, sans activité commerciale", "It only holds money or assets, with no business activity"), hint: t("Par exemple : participations, immeubles, titres ou comptes bancaires détenus pour leurs propriétaires.", "For example: shareholdings, real estate, securities or bank accounts held for their owners.") },
          { value: "notStarted", label: t("Elle n’a pas encore commencé son activité", "It has not started its activity yet"), hint: t("Société en création ou récemment constituée.", "Company being formed or recently incorporated.") },
        ],
      },
      yesNo("a.ownPremises", t("La société a-t-elle ses propres locaux ?", "Does the company have its own premises?"), { help: t("Bureaux, atelier, magasin… utilisés par la société elle-même. Une simple adresse de domiciliation n’en est pas un.", "Offices, workshop, shop… used by the company itself. A mere domiciliation address does not count."), width: "half" }),
      { kind: "field", id: "a.activityAddress", type: "text", label: t("Adresse principale de l’activité, si ce n’est pas le siège", "Main address of the activity, if it is not the registered office"), maxLength: 300 },
      yesNo("a.ownStaff", t("La société a-t-elle ses propres employés ?", "Does the company have its own employees?"), { help: t("Des personnes engagées par la société elle-même (contrat de travail avec elle).", "People hired by the company itself (employment contract with the company)."), width: "half" }),
      { kind: "field", id: "a.staffCount", type: "integer", label: t("Combien d’employés ?", "How many employees?"), required: true, width: "half", showIf: is("a.ownStaff", "yes") },
      yesNo("a.listed", t("La société est-elle cotée en bourse, ou détenue en majorité par une société cotée ?", "Is the company listed on a stock exchange, or majority-owned by a listed company?"), { help: t("Cotée : ses actions s’achètent et se vendent sur une bourse officielle. En majorité : plus de la moitié du capital.", "Listed: its shares are bought and sold on an official stock exchange. Majority-owned: more than half of the capital.") }),
      { kind: "field", id: "a.listedWhere", type: "text", label: t("Nom de la société cotée et de la bourse", "Name of the listed company and the exchange"), required: true, showIf: is("a.listed", "yes") },
      {
        kind: "group",
        id: "a.directors",
        label: t("Administrateurs et gérants de la société", "Directors and managers of the company"),
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
        label: t("Qui peut signer au nom de la société ?", "Who can sign on behalf of the company?"),
        help: t("Les personnes autorisées à signer pour la société, par exemple selon l’extrait du registre du commerce. Une ligne par personne.", "The people authorised to sign for the company, for example as shown on the commercial register extract. One line per person."),
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
              { value: "individual", label: t("Seule (signature individuelle)", "Alone (sole signature)") },
              { value: "joint", label: t("À deux (signature collective à deux)", "With another person (joint signature by two)") },
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
        label: t("Qui est l’ayant droit économique, c’est-à-dire la personne à qui l’argent et les biens appartiennent vraiment ?", "Who is the beneficial owner, i.e. the person the money and assets really belong to?"),
        help: t("L’ayant droit économique est la personne à qui l’argent et les biens appartiennent vraiment, même si le compte ou le contrat est au nom d’un autre. Les biens concernés sont ceux que vous nous confiez ou que nous traitons pour vous.", "The beneficial owner is the person the money and assets really belong to, even if the account or contract is in someone else's name. The assets concerned are those you entrust to us or that we handle for you."),
        options: [
          { value: "self", label: t("Je suis le seul ayant droit économique de l'argent et des biens concernés", "I am the sole beneficial owner of the money and assets involved") },
          { value: "others", label: t("Une ou plusieurs autres personnes sont aussi, ou seules, ayants droit économiques", "One or more other persons are also, or solely, beneficial owners") },
        ],
      },
      {
        kind: "group",
        id: "b.ppOthers",
        label: t("Autres ayants droit économiques (autres personnes à qui l’argent ou les biens appartiennent vraiment)", "Other beneficial owners (other people the money or assets really belong to)"),
        itemLabel: t("Personne", "Person"),
        titleFields: ["lastName", "firstName"],
        minRows: 1,
        maxRows: 10,
        showIf: is("b.ppOwner", "others"),
        fields: [...personFields(), { kind: "field", id: "relation", type: "text", label: t("Lien avec vous", "Relationship to you"), width: "half" }],
      },
      yesNo("b.ppStructure", t("L’argent ou les biens sont-ils détenus par l’intermédiaire d’une société, d’un trust ou d’une fondation ?", "Are the money or assets held through a company, a trust or a foundation?"), { help: t("Exemple : vous possédez un immeuble via une SA. Un trust est une structure, souvent étrangère, où un administrateur gère des biens au profit de bénéficiaires.", "Example: you own a building through a limited company. A trust is a structure, often foreign, in which a trustee manages assets for the benefit of beneficiaries.") }),
      { kind: "field", id: "b.ppStructureDetails", type: "textarea", label: t("Précisez (nom, pays, rôle de chaque personne)", "Please specify (name, country, role of each person)"), help: t("Exemple : Société X SA (Suisse) détient l’immeuble ; vous détenez 100 % de X SA.", "Example: Company X SA (Switzerland) owns the building; you hold 100% of X SA."), required: true, showIf: is("b.ppStructure", "yes") },
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
        label: t("Actionnaires et associés de la société", "Shareholders and partners of the company"),
        help: t("Les personnes et sociétés qui détiennent des actions ou des parts, d’après le registre des actions ou des associés ou les statuts. Une ligne par détenteur.", "The people and companies that hold shares or interests, according to the share register or register of partners, or the articles of association. One line per holder."),
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
              { value: "person", label: t("Une personne", "A person") },
              { value: "company", label: t("Une société", "A company") },
              { value: "trust", label: t("Un trust ou une fondation", "A trust or foundation") },
              { value: "nominee", label: t("Un prête-nom : il détient pour le compte d’une autre personne", "A nominee: holds the shares for someone else") },
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
          "Une ou plusieurs personnes physiques détiennent-elles, directement ou indirectement, seules ou de concert avec des tiers, au moins 25 % du capital ou des droits de vote ?",
          "Do one or more individuals hold, directly or indirectly, alone or acting together with third parties, at least 25% of the capital or voting rights?",
        ),
        help: t("Seules comptent les personnes physiques (des êtres humains), pas les sociétés. « Indirectement » : via une société ou une autre structure ; « de concert » : en accord avec d’autres actionnaires.", "Only individuals (human beings) count, not companies. “Indirectly”: through a company or another structure; “acting together”: by agreement with other shareholders."),
        options: [
      { value: "yes", label: t("Oui", "Yes") },
      { value: "no", label: t("Non", "No") },
      { value: "unidentified", label: t("Oui, mais la personne physique finale (l’être humain derrière) ne peut pas être identifiée", "Yes, but the ultimate natural person (the human being behind) cannot be identified") },
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
          "Une personne physique contrôle-t-elle la société d’une autre manière (pacte d’actionnaires, droit de veto, droit de nommer la majorité du conseil d’administration) ?",
          "Does an individual control the company in another way (shareholders’ agreement, veto right, right to appoint the majority of the board)?",
        ),
        help: t("« Une autre manière » : autre que détenir au moins 25 % du capital ou des droits de vote (question précédente).", "“Another way”: other than holding at least 25% of the capital or voting rights (previous question)."),
        options: [
      { value: "yes", label: t("Oui", "Yes") },
      { value: "no", label: t("Non", "No") },
      { value: "unidentified", label: t("Oui, mais la personne physique finale (l’être humain derrière) ne peut pas être identifiée", "Yes, but the ultimate natural person (the human being behind) cannot be identified") },
    ],
        showIf: (a) => cascade(a) && a["b.q25"] === "no",
      },
      {
        kind: "field",
        id: "b.unidentifiedReason",
        type: "textarea",
        required: true,
        maxLength: 1500,
        label: t("Pourquoi la personne physique finale (l’être humain derrière la société) ne peut-elle pas être identifiée ? Décrivez la chaîne de détention connue.", "Why can the ultimate natural person (the human being behind the company) not be identified? Describe the known chain of ownership."),
        help: t("Qui détient la société, puis qui détient cet actionnaire, etc., avec les pays et les parts.", "Who owns the company, then who owns that shareholder, and so on, with the countries and shares."),
        showIf: (a) => cascade(a) && (a["b.q25"] === "unidentified" || a["b.qOther"] === "unidentified"),
      },
      B_OP_GROUP_OTHER,
      B_OP_GROUP_MANAGER,
      yesNo(
        "b.forThird",
        t("La société détient-elle de l’argent ou des biens pour le compte de quelqu’un d’autre ?", "Does the company hold money or assets on behalf of someone else?"),
        { help: t("Oui si l’argent ou les biens appartiennent en réalité à un tiers, pas à la société. Exemple : une société qui garde des fonds de clients.", "Yes if the money or assets really belong to a third party, not to the company. Example: a company that keeps client funds."), showIf: isOp },
      ),
      { kind: "field", id: "b.forThirdDetails", type: "textarea", label: t("Pour qui, et quel argent ou quels biens ?", "For whom, and which money or assets?"), required: true, showIf: (a) => isOp(a) && a["b.forThird"] === "yes" },
      // Non-operating company: art. 2a al. 6 LBA, every beneficial owner of the assets.
      B_NONOP_GROUP,
      { kind: "heading", id: "b.structureHeading", label: t("Structure de détention", "Ownership structure") },
      yesNo("b.structure", t("La société est-elle détenue par l’intermédiaire d’une autre société, d’un trust, d’une fondation ou d’un prête-nom ?", "Is the company held through another company, a trust, a foundation or a nominee?"), { help: t("Oui si une société, un trust, une fondation ou un prête-nom se trouve entre la société et ses propriétaires finaux. Un prête-nom détient pour le compte de quelqu’un d’autre.", "Yes if a company, trust, foundation or nominee sits between the company and its final owners. A nominee holds on behalf of someone else.") }),
      {
        kind: "field",
        id: "b.structureKinds",
        type: "checkboxes",
        label: t("Quel type de structure ?", "What kind of structure?"),
        required: true,
        showIf: is("b.structure", "yes"),
        options: [
          { value: "company", label: t("Une ou plusieurs sociétés", "One or more companies") },
          { value: "trust", label: t("Un trust", "A trust") },
          { value: "foundation", label: t("Une fondation", "A foundation") },
          { value: "nominee", label: t("Un prête-nom", "A nominee") },
        ],
      },
      { kind: "field", id: "b.structureDetails", type: "textarea", label: t("Décrivez qui détient la société, étape par étape, jusqu’aux personnes physiques (noms, pays, parts)", "Describe who owns the company, step by step, down to the individuals (names, countries, shares)"), help: t("Exemple : X SA (Suisse) détient 100 % de la société ; Mme Y (France) détient 60 % de X SA et M. Z 40 %.", "Example: X SA (Switzerland) holds 100% of the company; Ms Y (France) holds 60% of X SA and Mr Z 40%."), required: true, showIf: is("b.structure", "yes") },
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
        label: t("La société a-t-elle inscrit au registre de transparence les personnes qui la possèdent ou la contrôlent ?", "Has the company registered the people who own or control it in the transparency register?"),
        help: t("Nouvelle obligation suisse depuis octobre 2026. Si vous ne savez pas si votre société est concernée, choisissez « Je ne sais pas » : la fiduciaire s'en occupe.", "New Swiss obligation since October 2026. If you do not know whether your company is concerned, choose “I don't know”: the fiduciary will take care of it."),
        options: [
          { value: "done", label: t("Oui", "Yes") },
          { value: "notYet", label: t("Non, pas encore", "Not yet") },
          { value: "unknown", label: t("Je ne sais pas — la fiduciaire s’en occupe", "I don’t know — the fiduciary takes care of it") },
          { value: "notConcerned", label: t("La société n’est pas concernée (p. ex. société étrangère)", "The company is not concerned (e.g. foreign company)") },
        ],
      },
      { kind: "field", id: "b.transparencyDate", type: "date", label: t("Date de la déclaration", "Date of the declaration"), width: "half", showIf: is("b.transparency", "done") },
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
        kind: "field",
        id: "c.pep",
        type: "radio",
        required: true,
        label: t("Vous, ou une personne liée, exercez-vous ou avez-vous exercé une haute fonction politique, publique ou militaire, ou êtes-vous proche d'une personne qui l'exerce ?", "Do you, or a related person, hold or have you held a senior political, public or military function, or are you close to someone who does?"),
        help: t("Personne politiquement exposée (PPE) : par exemple chef d'État, ministre, parlementaire national, haut magistrat, haut militaire, dirigeant d'une entreprise d'État ou d'un parti, en Suisse, à l'étranger, dans une organisation internationale ou une fédération sportive internationale. Proche : famille, relation personnelle ou d'affaires étroite. Une fonction suisse quittée depuis plus de 18 mois ne compte plus. Personnes liées : pour une société, ses administrateurs, signataires, actionnaires et ayants droit économiques ; pour un particulier, les ayants droit économiques du point B.", "Politically exposed person (PEP): for example a head of state, minister, national member of parliament, senior judge, senior military officer, head of a state-owned company or of a political party, in Switzerland, abroad, in an international organisation or an international sports federation. Close: family, or a close personal or business relationship. A Swiss function left more than 18 months ago no longer counts. Related persons: for a company, its directors, signatories, shareholders and beneficial owners; for an individual, the beneficial owners in section B."),
        options: [
          { value: "none", label: t("Non, personne", "No, nobody") },
          { value: "pep", label: t("Oui, une fonction de ce type", "Yes, such a function") },
          { value: "close", label: t("Oui, proche d’une personne qui exerce une telle fonction (famille, relation personnelle ou d’affaires)", "Yes, close to someone holding such a function (family, personal or business relationship)") },
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
          { value: "foreign", label: t("À l’étranger", "Abroad") },
          { value: "swiss", label: t("En Suisse (niveau national)", "In Switzerland (national level)") },
          { value: "intl", label: t("Dans une organisation internationale ou une fédération sportive internationale", "In an international organisation or an international sports federation") },
        ],
      },
      { kind: "field", id: "c.pepDetails", type: "textarea", label: t("Qui, quelle fonction, quel pays, quelles dates ? Pour un proche : quel lien avec la personne qui exerce la fonction ?", "Who, which function, which country, which dates? For a close person: what is the link with the person holding the function?"), required: true, showIf: (a) => a["c.pep"] === "pep" || a["c.pep"] === "close" },
      yesNo(
        "c.sanctions",
        t(
          "Vous ou une personne liée figurez-vous sur une liste de sanctions (Suisse, UE, ONU, États-Unis), ou entretenez-vous des relations d’affaires avec des personnes ou des activités visées par des sanctions ?",
          "Are you or a related person on a sanctions list (Switzerland, EU, UN, United States), or do you or they have business relations with persons or activities targeted by sanctions?",
        ), { help: t("Personnes liées : voir la question sur les fonctions politiques. Sanctions : listes de la Suisse, de l’UE, de l’ONU ou des États-Unis, qui interdisent ou limitent des affaires avec certaines personnes ou activités.", "Related persons: see the question on political functions. Sanctions: lists of Switzerland, the EU, the UN or the United States, which forbid or restrict dealings with certain persons or activities.") },
      ),
      { kind: "field", id: "c.sanctionsDetails", type: "textarea", label: t("Qui est concerné, et quel est le lien avec les sanctions ?", "Who is concerned, and what is the link with the sanctions?"), help: t("Par exemple : la personne et la liste sur laquelle elle figure, ou la relation d’affaires et avec qui.", "For example: the person and the list they are on, or the business relationship and with whom."), required: true, showIf: is("c.sanctions", "yes") },
      yesNo(
        "c.criminal",
        t(
          "À votre connaissance, existe-t-il contre vous ou une personne liée une procédure pénale en cours, ou une condamnation encore inscrite au casier judiciaire (ou dans un registre étranger équivalent), pour une infraction en lien avec le blanchiment d’argent ?",
          "To your knowledge, are you or a related person currently subject to criminal proceedings, or to a conviction still entered in the criminal record (or the foreign equivalent), for an offence linked to money laundering?",
        ),
        { help: t("Infractions visées, par exemple : blanchiment, corruption, escroquerie, abus de confiance, délit fiscal qualifié, participation à une organisation criminelle, financement du terrorisme. Personnes liées : voir la question sur les fonctions politiques.", "Offences covered, for example: money laundering, bribery, fraud, breach of trust, qualified tax offence, participation in a criminal organisation, terrorist financing. Related persons: see the question on political functions.") },
      ),
      { kind: "field", id: "c.criminalDetails", type: "textarea", label: t("Qui, quelle infraction, quelle autorité, où en est la procédure ?", "Who, which offence, which authority, what stage?"), required: true, showIf: is("c.criminal", "yes") },
    ],
  },

  // ---- D: services and activity ----------------------------------------------------------------------
  {
    id: "d",
    section: "D",
    title: t("Prestations demandées et activité", "Services requested and activity"),
    blocks: [
      { kind: "field", id: "d.servicesPm", type: "checkboxes", required: true, label: t("Que demandez-vous à Ark Fiduciaire SA ?", "What are you asking Ark Fiduciaire SA for?"), help: t("Plusieurs réponses possibles.", "Several answers possible."), options: PM_SERVICES, showIf: isPM },
      { kind: "field", id: "d.servicesPp", type: "checkboxes", required: true, label: t("Que demandez-vous à Ark Fiduciaire SA ?", "What are you asking Ark Fiduciaire SA for?"), help: t("Plusieurs réponses possibles.", "Several answers possible."), options: PP_SERVICES, showIf: isPP },
      { kind: "field", id: "d.servicesOther", type: "text", label: t("Quelle autre prestation ?", "Which other service?"), required: true, showIf: (a) => has("d.servicesPm", "other")(a) || has("d.servicesPp", "other")(a) },
      { kind: "field", id: "d.purpose", type: "textarea", label: t("But de la société (selon les statuts)", "Company purpose (according to its articles)"), help: t("Recopiez le but tel qu’il figure dans les statuts.", "Copy the purpose as it appears in the articles of association."), required: true, maxLength: 2000, showIf: isPM },
      { kind: "field", id: "d.activity", type: "textarea", label: t("Que fait concrètement la société ?", "What does the company actually do?"), help: t("Ce que la société fait réellement. Cela peut être plus précis que le but des statuts.", "What the company really does. This can be more specific than the purpose in the articles."), required: true, maxLength: 2000, showIf: isPM },
      { kind: "field", id: "d.companies", type: "textarea", label: t("Sociétés concernées (existantes ou à créer) et ce qu’elles font, si vous en créez ou en détenez", "Companies concerned (existing or to be created) and what they do, if you are creating or holding any"), help: t("Seulement si vous créez ou détenez une société. Sinon, laissez vide.", "Only if you are creating or holding a company. Otherwise, leave blank."), maxLength: 2000, showIf: isPP },
      { kind: "field", id: "d.sector", type: "text", label: t("Secteur d'activité", "Business sector"), help: t("Par exemple : restauration, informatique, immobilier, commerce de détail.", "For example: catering, IT, real estate, retail."), required: true, width: "half", showIf: isPM },
      { kind: "field", id: "d.countries", type: "text", label: t("Dans quels pays exercez-vous votre activité ?", "In which countries do you carry out your activity?"), help: t("Les pays où se déroule l’activité. Les pays des paiements sont demandés plus loin (point G).", "The countries where the activity takes place. The countries of payments are asked later (section G)."), required: true, width: "half" },
      { kind: "field", id: "d.counterparties", type: "textarea", label: t("Avec qui travaillez-vous principalement (clients, fournisseurs, partenaires) ?", "Who do you mainly work with (customers, suppliers, partners)?"), help: t("Types de clients, fournisseurs et partenaires.", "Types of customers, suppliers and partners."), required: true, maxLength: 2000 },
      { kind: "field", id: "d.turnover", type: "money", label: t("Chiffre d’affaires du dernier exercice (CHF)", "Turnover of the last financial year (CHF)"), help: t("Le total des ventes de la dernière année comptable, avant déduction des charges. Voir le compte de résultat.", "Total sales of the last financial year, before deducting costs. See the profit and loss account."), width: "half", showIf: (a) => isPM(a) && a["a.activityKind"] !== "notStarted" },
      { kind: "field", id: "d.balance", type: "money", label: t("Total du bilan (CHF)", "Balance sheet total (CHF)"), help: t("Le total en bas du bilan : somme de tout ce que la société possède. Pas de bilan encore : laissez vide.", "The total at the bottom of the balance sheet: the sum of everything the company owns. No balance sheet yet: leave blank."), width: "half", showIf: (a) => isPM(a) && a["a.activityKind"] !== "notStarted" },
      { kind: "field", id: "d.group", type: "text", label: t("Autres sociétés du même groupe, s’il y en a", "Other companies of the same group, if any"), help: t("Les sociétés liées à celle-ci par une société mère ou par les mêmes propriétaires.", "Companies linked to this one through a parent company or the same owners."), maxLength: 400, showIf: isPM },
      yesNo(
        "d.licence",
        t("L’activité exige-t-elle une autorisation officielle en Suisse ?", "Does the activity require an official licence in Switzerland?"),
        { help: t("Par exemple : banque, assurance, gestion de fortune, restaurant, santé.", "For example: banking, insurance, asset management, restaurant, healthcare.") },
      ),
      { kind: "field", id: "d.licenceDetails", type: "text", label: t("Quelle autorisation, et où en est son obtention ?", "Which licence, and where does its obtention stand?"), help: t("Nom de l’autorisation, autorité, et date ou état de la demande.", "Name of the licence, authority, and date or status of the application."), required: true, maxLength: 400, showIf: is("d.licence", "yes") },
    ],
  },

  // ---- E: origin of wealth ---------------------------------------------------------------------------
  {
    id: "e",
    section: "E",
    title: t("Origine de la fortune", "Origin of wealth"),
    blocks: [
      { kind: "field", id: "e.companyAssets", type: "textarea", label: t("D’où viennent l’argent et les biens de la société ?", "Where do the company’s money and assets come from?"), help: t("Capital apporté, bénéfices gardés dans la société, prêts d’actionnaires ou de tiers… Quelques phrases suffisent.", "Capital contributed, profits kept in the company, loans from shareholders or third parties… A few sentences are enough."), required: true, maxLength: 2000, showIf: isPM },
      { kind: "field", id: "e.ownersWealth", type: "textarea", label: t("D’où vient le patrimoine des personnes indiquées au point B ?", "Where does the wealth of the people listed in section B come from?"), help: t("Pour chacune : salaire, entreprise, héritage, placements… Une phrase par personne.", "For each person: salary, business, inheritance, investments… One sentence per person."), required: true, maxLength: 2000, showIf: (a) => isOp(a) && !isListed(a) },
      { kind: "note", id: "e.nonopNote", text: t("L'origine de la fortune de chaque ayant droit économique a été demandée au point B.", "The origin of each beneficial owner's wealth was asked in section B."), showIf: isNonOp },
      {
        kind: "field",
        id: "e.wealthSources",
        type: "checkboxes",
        required: true,
        label: t("Comment avez-vous constitué votre patrimoine ?", "How did you build up your wealth?"),
        help: t("Ce que vous possédez (épargne, biens, parts de société…) et comment vous l’avez constitué. À ne pas confondre avec l’argent d’un versement précis (point F).", "What you own (savings, property, shares in a company…) and how you built it up. Not to be confused with the money of one specific payment (section F)."),
        showIf: isPP,
        options: [
          { value: "salary", label: t("Salaire", "Salary") },
          { value: "selfEmployed", label: t("Activité indépendante ou entreprise", "Self-employment or business") },
          { value: "companySale", label: t("Vente d’une société", "Sale of a company") },
          { value: "inheritance", label: t("Héritage ou donation", "Inheritance or gift") },
          { value: "investments", label: t("Placements", "Investments") },
          { value: "realEstate", label: t("Immobilier", "Real estate") },
          { value: "other", label: t("Autre", "Other") },
        ],
      },
      { kind: "field", id: "e.wealthDetails", type: "textarea", label: t("Expliquez en quelques mots", "Explain in a few words"), help: t("Exemple : vente de mon entreprise en 2019.", "Example: sale of my business in 2019."), required: true, maxLength: 2000, showIf: isPP },
      { kind: "field", id: "e.otherWealth", type: "textarea", label: t("D’où vient le patrimoine des autres ayants droit économiques (point B) ?", "Where does the wealth of the other beneficial owners (section B) come from?"), help: t("Une phrase par personne.", "One sentence per person."), required: true, maxLength: 2000, showIf: (a) => isPP(a) && a["b.ppOwner"] === "others" },
    ],
  },

  // ---- F: origin of funds ----------------------------------------------------------------------------
  {
    id: "f",
    section: "F",
    title: t("Origine des fonds", "Origin of funds"),
    blocks: [
      yesNo("f.funds", t("De l’argent sera-t-il versé pour ce mandat (p. ex. le capital d’une société) ?", "Will money be paid in for this mandate (e.g. a company's capital)?"), { help: t("Oui si de l’argent doit être versé dans ce cadre. Exemple : le capital à verser pour créer une société.", "Yes if money is to be paid in for this. Example: the capital to be paid in to create a company.") }),
      { kind: "field", id: "f.origin", type: "textarea", label: t("D'où vient concrètement cet argent ?", "Where exactly does this money come from?"), help: t("Il s’agit de ce versement précis, pas de tout votre patrimoine. Exemple : vente de mon appartement à Lausanne en mars 2026.", "This means this specific payment, not all your wealth. Example: sale of my flat in Lausanne in March 2026."), required: true, maxLength: 2000, showIf: is("f.funds", "yes") },
      { kind: "field", id: "f.amount", type: "money", label: t("Montant du versement prévu", "Amount of the planned payment"), required: true, width: "half", showIf: is("f.funds", "yes") },
      { kind: "field", id: "f.currency", type: "select", label: t("Devise", "Currency"), help: t("Si elle n’est pas dans la liste, choisissez « Autre ».", "If it is not in the list, choose “Other”."), required: true, width: "half", options: CURRENCIES, showIf: is("f.funds", "yes") },
      { kind: "field", id: "f.currencyOther", type: "text", label: t("Quelle devise ?", "Which currency?"), required: true, width: "half", maxLength: 40, showIf: (a) => a["f.funds"] === "yes" && a["f.currency"] === "other" },
      { kind: "field", id: "f.bank", type: "text", label: t("Banque et pays d'où l'argent sera versé", "Bank and country the money will come from"), required: true, showIf: is("f.funds", "yes") },
      { kind: "field", id: "f.holder", type: "text", label: t("Au nom de qui est le compte d’où part l’argent ?", "In whose name is the account the money comes from?"), required: true, width: "half", showIf: is("f.funds", "yes") },
      { kind: "field", id: "f.more", type: "text", label: t("Autres versements prévus ?", "Other payments planned?"), maxLength: 400, showIf: is("f.funds", "yes") },
      { kind: "field", id: "f.otherOwner", type: "textarea", label: t("Si l’argent appartient à un autre ayant droit économique (point B) : d’où vient-il ?", "If the money belongs to another beneficial owner (section B): where does it come from?"), help: t("Indiquez l’origine de l’argent de cette autre personne, comme pour le vôtre.", "Give the origin of this other person's money, as you would for your own."), maxLength: 2000, showIf: (a) => isPP(a) && a["b.ppOwner"] === "others" && a["f.funds"] === "yes" },
    ],
  },

  // ---- G: expected activity --------------------------------------------------------------------------
  {
    id: "g",
    section: "G",
    title: t("Activité attendue", "Expected activity"),
    intro: t("Pour une société récente ou en création, indiquez des estimations.", "For a new company or one being set up, give estimates."),
    blocks: [
      { kind: "field", id: "g.turnover", type: "money", label: t("Chiffre d’affaires prévu par an (CHF)", "Expected turnover per year (CHF)"), help: t("Ce que vous comptez vendre sur une année, en chiffres. Une estimation suffit.", "What you expect to sell over one year, in figures. An estimate is enough."), width: "half", required: true, showIf: isPM },
      { kind: "field", id: "g.turnoverPp", type: "money", label: t("Chiffre d'affaires annuel prévu (CHF, seulement si une société est concernée)", "Expected annual turnover (CHF, only if a company is concerned)"), help: t("Seulement si une société est concernée. Une estimation suffit.", "Only if a company is concerned. An estimate is enough."), width: "half", showIf: isPP },
      { kind: "field", id: "g.operations", type: "text", label: t("Combien d’opérations par an, pour quel montant au total ?", "How many transactions a year, for what total amount?"), help: t("Estimation. Exemple : 40 opérations, environ 200 000 CHF.", "Estimate. Example: 40 transactions, about CHF 200,000."), required: true },
      { kind: "field", id: "g.typesPm", type: "checkboxes", required: true, label: t("Quels types d’opérations prévoyez-vous ?", "Which types of transactions do you expect?"), help: t("Une opération : un paiement, un virement, un dépôt ou retrait, un achat ou une vente d’actifs. Plusieurs réponses possibles.", "A transaction: a payment, a transfer, a deposit or withdrawal, a purchase or sale of assets. Several answers possible."), options: PM_OPERATIONS, showIf: isPM },
      { kind: "field", id: "g.typesPp", type: "checkboxes", required: true, label: t("Quels types d’opérations prévoyez-vous ?", "Which types of transactions do you expect?"), help: t("Une opération : un paiement, un virement, un dépôt ou retrait, un achat ou une vente d’actifs. Plusieurs réponses possibles.", "A transaction: a payment, a transfer, a deposit or withdrawal, a purchase or sale of assets. Several answers possible."), options: PP_OPERATIONS, showIf: isPP },
      { kind: "field", id: "g.typesOther", type: "text", label: t("Quel autre type d’opération ?", "Which other type of transaction?"), required: true, showIf: (a) => has("g.typesPm", "other")(a) || has("g.typesPp", "other")(a) },
      { kind: "field", id: "g.countries", type: "text", label: t("Pays et devises des paiements", "Countries and currencies of payments"), help: t("Les pays d’où vient et où va l’argent, et les devises (CHF, EUR, USD…).", "The countries the money comes from and goes to, and the currencies (CHF, EUR, USD…)."), required: true, maxLength: 400 },
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
        help: t("Les personnes autorisées à représenter la société.", "The people authorised to represent the company."),
        itemLabel: t("Signataire du formulaire", "Form signatory"),
        titleFields: ["lastName", "firstName"],
        minRows: 1,
        maxRows: 2,
        showIf: isPM,
        fields: [
          { kind: "field", id: "lastName", type: "text", label: t("Nom", "Last name"), required: true, width: "half" },
          { kind: "field", id: "firstName", type: "text", label: t("Prénom(s)", "First name(s)"), required: true, width: "half" },
          { kind: "field", id: "function", type: "text", label: t("Fonction", "Position"), required: true, width: "half" },
          {
            kind: "field",
            id: "email",
            type: "email",
            label: t("E-mail (pour signer en ligne)", "Email (to sign online)"),
            help: t(
              "Chaque signataire reçoit à cette adresse un lien et un code pour signer en ligne. Une adresse par personne. Sans adresse, le formulaire se signe sur papier.",
              "Each signatory receives a link and a code at this address to sign online. One address per person. Without an address, the form is signed on paper.",
            ),
            width: "half",
          },
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
        help: t("Vous recevrez un PDF avec toutes vos réponses. Vous le signerez pour les confirmer.", "You will receive a PDF with all your answers. You will sign it to confirm them."),
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
