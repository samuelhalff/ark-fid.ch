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
 * Simplified on 2026-11-13 (Sam: « Ça me semble bien, refais une passe et go »): what Ark knows
 * arrives prefilled to check, what a document shows is not copied out, duplicates are merged
 * (directors and signatories, activity and sector, countries of activity and of payments),
 * E, F and G share one screen. Questions no longer asked stay as `retired` blocks so earlier
 * answers still show to Ark; `upgradeAnswers` (engine.ts) maps merged answers.
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
/** Services that concern a company of the person: only then are its companies and licence asked. */
const PP_COMPANY_SERVICES = ["formation", "domiciliation", "directorship", "secretariat"];
export const ppCompanyConcerned = (a: Answers) =>
  isPP(a) && Array.isArray(a["d.servicesPp"]) && (a["d.servicesPp"] as string[]).some((v) => PP_COMPANY_SERVICES.includes(v));

// ---- reusable fields -------------------------------------------------------------------------------

const yesNo = (id: string, label: ReturnType<typeof t>, extra: Partial<FieldDef> = {}): FieldDef => ({ kind: "field", id, type: "yesno", label, required: true, ...extra });
const retired = (id: string, type: FieldDef["type"], label: ReturnType<typeof t>, extra: Partial<FieldDef> = {}): FieldDef => ({ kind: "field", id, type, label, retired: true, ...extra });

const personFields = (opts: { address?: boolean; birth?: boolean } = {}): FieldDef[] => [
  { kind: "field", id: "lastName", type: "text", label: t("Nom", "Last name"), required: true, width: "half" },
  { kind: "field", id: "firstName", type: "text", label: t("Prénom(s)", "First name(s)"), required: true, width: "half" },
  ...(opts.birth === false ? [] : [{ kind: "field", id: "birthDate", type: "date", label: t("Date de naissance", "Date of birth"), required: true, width: "half" } as FieldDef]),
  { kind: "field", id: "nationality", type: "text", label: t("Nationalité(s)", "Nationality(ies)"), required: true, width: "half" },
  ...(opts.address === false
    ? []
    : [
        { kind: "field", id: "address", type: "text", label: t("Adresse (rue, n°, NPA, localité)", "Address (street, no., postcode, town)"), required: true, maxLength: 300 } as FieldDef,
        { kind: "field", id: "country", type: "text", label: t("Pays", "Country"), required: true, width: "half" } as FieldDef,
      ]),
];

// ---- options ---------------------------------------------------------------------------------------

const PM_SERVICES: Option[] = [
  { value: "formation", label: t("Création d’une société ou d’une filiale", "Setting up a company or a subsidiary") },
  { value: "domiciliation", label: t("Domiciliation (siège de la société chez nous)", "Domiciliation (company's registered office with us)") },
  { value: "directorship", label: t("Administrateur ou gérant fourni par nous", "A director or manager provided by us") },
  { value: "secretariat", label: t("Secrétariat juridique de la société (assemblées, procès-verbaux…)", "Corporate secretarial services (meetings, minutes…)") },
  { value: "transparency", label: t("Déclaration au registre de transparence", "Filing with the transparency register") },
  { value: "accounting", label: t("Comptabilité et comptes annuels", "Accounting and annual accounts") },
  { value: "tax", label: t("Impôts et TVA", "Tax and VAT") },
  { value: "payroll", label: t("Salaires (paie)", "Payroll") },
  { value: "restructuring", label: t("Restructuration, fusion ou vente de la société", "Restructuring, merger or sale of the company") },
  { value: "realEstate", label: t("Conseil pour l’achat ou la vente d’un immeuble", "Advice on buying or selling real estate") },
  { value: "payments", label: t("Paiements faits pour vous", "Payments made for you") },
  { value: "other", label: t("Autre", "Other") },
];

const PP_SERVICES: Option[] = [
  { value: "formation", label: t("Création d’une ou plusieurs sociétés", "Setting up one or more companies") },
  { value: "domiciliation", label: t("Domiciliation (siège de la société chez nous)", "Domiciliation (company's registered office with us)") },
  { value: "directorship", label: t("Administrateur ou gérant fourni par nous", "A director or manager provided by us") },
  { value: "secretariat", label: t("Secrétariat juridique de la société (assemblées, procès-verbaux…)", "Corporate secretarial services (meetings, minutes…)") },
  { value: "accounting", label: t("Comptabilité et comptes annuels", "Accounting and annual accounts") },
  { value: "tax", label: t("Impôts et TVA", "Tax and VAT") },
  { value: "payroll", label: t("Salaires (paie)", "Payroll") },
  { value: "restructuring", label: t("Restructuration, fusion ou vente d’une société", "Restructuring, merger or sale of a company") },
  { value: "realEstate", label: t("Conseil pour l’achat ou la vente d’un immeuble", "Advice on buying or selling real estate") },
  { value: "payments", label: t("Paiements faits pour vous", "Payments made for you") },
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

const SAME_UNIDENTIFIED = t("Oui, mais on ne sait pas qui est la personne au bout de la chaîne", "Yes, but nobody knows who the person at the end of the chain is");

const B_OP_GROUP_25: GroupDef = {
  kind: "group",
  id: "b.controllers25",
  label: t("Qui ?", "Who?"),
  help: t("Une ligne par personne. Si la part passe par une société, indiquez la personne derrière.", "One line per person. If the share is held through a company, give the person behind it."),
  itemLabel: t("Personne", "Person"),
  titleFields: ["lastName", "firstName"],
  minRows: 1,
  maxRows: 10,
  showIf: (a) => isOp(a) && !isListed(a) && a["b.q25"] === "yes",
  fields: [
    ...personFields(),
    { kind: "field", id: "percent", type: "percent", label: t("Part (%)", "Share (%)"), required: true, width: "half" },
    {
      kind: "field",
      id: "holding",
      type: "checkboxes",
      label: t("Comment ?", "How?"),
      required: true,
      options: [
        { value: "direct", label: t("Directement", "Directly") },
        { value: "indirect", label: t("Via une société", "Through a company") },
        { value: "concert", label: t("Avec d’autres, par accord", "With others, by agreement") },
      ],
    },
    {
      kind: "field",
      id: "via",
      type: "text",
      label: t("Via quelle société, ou avec qui ?", "Through which company, or with whom?"),
      required: true,
      maxLength: 300,
      showIf: (_a, row) => Array.isArray(row?.holding) && (row.holding.includes("indirect") || row.holding.includes("concert")),
    },
  ],
};

const B_OP_GROUP_OTHER: GroupDef = {
  kind: "group",
  id: "b.controllersOther",
  label: t("Qui, et comment ?", "Who, and how?"),
  help: t("Une ligne par personne.", "One line per person."),
  itemLabel: t("Personne", "Person"),
  titleFields: ["lastName", "firstName"],
  minRows: 1,
  maxRows: 10,
  showIf: (a) => isOp(a) && !isListed(a) && a["b.q25"] === "no" && a["b.qOther"] === "yes",
  fields: [...personFields(), { kind: "field", id: "controlType", type: "text", label: t("Comment ? (accord, veto, nomination du conseil…)", "How? (agreement, veto, appointing the board…)"), required: true, maxLength: 300 }],
};

const B_OP_GROUP_MANAGER: GroupDef = {
  kind: "group",
  id: "b.manager",
  label: t("Qui dirige la société au plus haut niveau ?", "Who runs the company at the highest level?"),
  help: t(
    "Directeur général, CEO ou gérant. La loi demande cette personne quand personne ne détient 25 % ni ne contrôle autrement.",
    "Managing director, CEO or manager. The law asks for this person when nobody holds 25% or controls the company otherwise.",
  ),
  itemLabel: t("Dirigeant", "Senior manager"),
  titleFields: ["lastName", "firstName"],
  minRows: 1,
  maxRows: 1,
  showIf: needsManager,
  fields: [...personFields(), { kind: "field", id: "function", type: "text", label: t("Fonction", "Position"), required: true, width: "half" }],
};

const B_NONOP_GROUP: GroupDef = {
  kind: "group",
  id: "b.ubos",
  label: t("À qui appartient ce que détient la société ?", "Who owns what the company holds?"),
  help: t(
    "Toutes les personnes, même avec une petite part ou via une autre société. La loi les appelle ayants droit économiques.",
    "Every person, even with a small share or through another company. The law calls them beneficial owners.",
  ),
  itemLabel: t("Personne", "Person"),
  titleFields: ["lastName", "firstName"],
  minRows: 1,
  maxRows: 10,
  showIf: isNonOp,
  fields: [
    ...personFields(),
    { kind: "field", id: "share", type: "text", label: t("Part ou rôle", "Share or role"), width: "half" },
    { kind: "field", id: "wealth", type: "textarea", label: t("D’où vient sa fortune ?", "Where does their wealth come from?"), help: t("Salaire, entreprise, héritage, placements…", "Salary, business, inheritance, investments…"), required: true, maxLength: 1500 },
  ],
};

/** Retired 2026-11-13: the share register (document) is still asked; persons that count follow (25 %, control). */
const B_SHAREHOLDERS_RETIRED: GroupDef = {
  kind: "group",
  id: "b.shareholders",
  retired: true,
  label: t("Actionnaires et associés de la société", "Shareholders and partners of the company"),
  itemLabel: t("Actionnaire", "Shareholder"),
  titleFields: ["name"],
  maxRows: 20,
  showIf: isPM,
  fields: [
    { kind: "field", id: "name", type: "text", label: t("Nom ou raison sociale", "Name or company name") },
    {
      kind: "field",
      id: "kind",
      type: "radio",
      label: t("Type", "Type"),
      options: [
        { value: "person", label: t("Une personne", "A person") },
        { value: "company", label: t("Une société", "A company") },
        { value: "trust", label: t("Un trust ou une fondation", "A trust or foundation") },
        { value: "nominee", label: t("Un prête-nom : il détient pour le compte d’une autre personne", "A nominee: holds the shares for someone else") },
      ],
    },
    { kind: "field", id: "percent", type: "percent", label: t("Part du capital et des voix (%)", "Share of capital and votes (%)"), width: "half" },
    { kind: "field", id: "behalf", type: "text", label: t("Pour le compte de qui ?", "On whose behalf?"), showIf: rowIs("kind", "nominee") },
  ],
};

export const STEPS: StepDef[] = [
  {
    id: "start",
    title: t("Avant de commencer", "Before you start"),
    intro: t(
      "La loi sur le blanchiment d’argent nous oblige à savoir qui sont nos clients, à qui appartient l’argent et à quoi sert notre mandat. Vos réponses restent confidentielles, sauf si la loi nous oblige à les transmettre. Nous sommes affiliés à l’organisme d’autorégulation SO-FIT.",
      "The Anti-Money Laundering Act requires us to know who our clients are, who the money belongs to and what our mandate is for. Your answers stay confidential, unless the law requires us to pass them on. We are a member of the self-regulatory organisation SO-FIT.",
    ),
    blocks: [
      // Set by the server from the case (Ark's choice), never by the client.
      { kind: "field", id: "route", type: "select", label: t("Formulaire", "Form"), options: [{ value: "pp", label: t("Personne physique", "Natural person") }, { value: "pm-op", label: t("Personne morale – société opérationnelle", "Legal entity – operating company") }, { value: "pm-nonop", label: t("Personne morale – société non opérationnelle", "Legal entity – non-operating company") }], showIf: () => false },
      {
        kind: "note",
        id: "start.how",
        text: t(
          "Nous avons déjà rempli ce que nous savons. Vérifiez, corrigez si besoin, complétez le reste et joignez les documents. Vous signerez ensuite le PDF de vos réponses, en ligne ou sur papier.",
          "We have already filled in what we know. Check it, correct it if needed, complete the rest and attach the documents. You will then sign the PDF of your answers, online or on paper.",
        ),
      },
      {
        kind: "note",
        id: "start.save",
        text: t(
          "Tout est enregistré au fur et à mesure. Vous pouvez reprendre plus tard avec le même lien, ou sur kyc.ark-fid.ch avec un code reçu par e-mail.",
          "Everything is saved as you go. You can come back later with the same link, or on kyc.ark-fid.ch with a code sent by e-mail.",
        ),
      },
      {
        kind: "field",
        id: "start.privacy",
        type: "boolean",
        required: true,
        label: t("J’ai lu la politique de confidentialité.", "I have read the privacy policy."),
        link: { href: t("https://ark-fid.ch/fr/legal/privacy/", "https://ark-fid.ch/en/legal/privacy/"), label: t("politique de confidentialité", "privacy policy") },
        help: t("Nous gardons ces informations dix ans après la fin du mandat, comme la loi l’exige.", "We keep this information for ten years after the mandate ends, as the law requires."),
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
      { kind: "heading", id: "a.ppHeading", label: t("Vous", "You"), prefill: { onlyWhenPrefilled: true } },
      { kind: "field", id: "a.lastName", type: "text", label: t("Nom", "Last name"), required: true, width: "half" },
      { kind: "field", id: "a.firstName", type: "text", label: t("Prénom(s)", "First name(s)"), required: true, width: "half" },
      { kind: "field", id: "a.email", type: "email", label: t("E-mail", "Email"), required: true, width: "half" },
      { kind: "field", id: "a.phone", type: "tel", label: t("Téléphone", "Phone"), help: t("Avec l’indicatif si le numéro n’est pas suisse (+33…).", "With the country code if the number is not Swiss (+33…)."), required: true, width: "half" },
      { kind: "field", id: "a.birthDate", type: "date", label: t("Date de naissance", "Date of birth"), required: true, width: "half" },
      { kind: "field", id: "a.nationality", type: "text", label: t("Nationalité(s)", "Nationality(ies)"), required: true, width: "half", help: t("Toutes, si vous en avez plusieurs.", "All of them, if you have more than one.") },
      { kind: "field", id: "a.address", type: "text", label: t("Adresse où vous habitez (rue, n°, NPA, localité)", "Address where you live (street, no., postcode, town)"), help: t("Pas de case postale.", "Not a P.O. box."), required: true, maxLength: 300 },
      { kind: "field", id: "a.country", type: "text", label: t("Pays", "Country"), required: true, width: "half" },
      { kind: "field", id: "a.taxCountry", type: "text", label: t("Pays où vous payez vos impôts", "Country where you pay tax"), help: t("Plusieurs pays : indiquez-les tous.", "Several countries: list them all."), required: true, width: "half" },
      { kind: "field", id: "a.tin", type: "text", label: t("Numéro fiscal", "Tax number"), help: t("En Suisse, votre numéro AVS (756…).", "In Switzerland, your AHV/AVS number (756…)."), width: "half" },
      { kind: "field", id: "a.corrAddress", type: "text", label: t("Adresse postale, si elle est différente", "Mailing address, if different"), maxLength: 300 },
      { kind: "field", id: "a.profession", type: "text", label: t("Votre métier, et votre employeur ou votre entreprise", "Your occupation, and your employer or business"), help: t("Retraité ou sans emploi : écrivez-le.", "Retired or not working: write that."), required: true, maxLength: 450 },
      // Retired 2026-11-13: read on the certified copy of the ID (Dima's note records "identity verified on original or certified copy").
      retired("a.birthPlace", "text", t("Lieu de naissance", "Place of birth")),
      retired("a.idType", "radio", t("Quel type de pièce d’identité présentez-vous ?", "Which type of ID document are you providing?"), { options: [{ value: "passport", label: t("Passeport", "Passport") }, { value: "idcard", label: t("Carte d’identité", "Identity card") }] }),
      retired("a.idNumber", "text", t("Numéro du document d’identité", "Identity document number")),
      retired("a.idExpiry", "date", t("Date de fin de validité", "Expiry date")),
    ],
  },
  {
    id: "a.pm",
    section: "A",
    title: t("La société", "The company"),
    showIf: isPM,
    blocks: [
      { kind: "heading", id: "a.registerHeading", label: t("Registre du commerce", "Commercial register"), prefill: { note: t("Repris du registre. Corrigez ce qui a changé.", "Taken from the register. Correct anything that has changed."), ids: ["a.name", "a.legalForm", "a.uid", "a.incorporationDate", "a.incorporationCountry", "a.seat"] } },
      { kind: "field", id: "a.name", type: "text", label: t("Nom de la société", "Company name"), help: t("Comme au registre.", "As in the register."), required: true },
      { kind: "field", id: "a.legalForm", type: "text", label: t("Forme juridique (SA, Sàrl…)", "Legal form (SA, Sàrl, Ltd…)"), required: true, width: "half" },
      { kind: "field", id: "a.uid", type: "text", label: t("Numéro IDE (CHE-…)", "UID number (CHE-…)"), help: t("Société étrangère : le numéro de son registre.", "Foreign company: the number in its own register."), required: true, width: "half" },
      { kind: "field", id: "a.incorporationDate", type: "date", label: t("Date de création", "Date of incorporation"), required: true, width: "half" },
      { kind: "field", id: "a.incorporationCountry", type: "text", label: t("Pays d’enregistrement", "Country of registration"), required: true, width: "half" },
      { kind: "field", id: "a.seat", type: "text", label: t("Adresse du siège", "Registered address"), required: true, maxLength: 300 },
      { kind: "field", id: "a.companyTaxCountry", type: "text", label: t("Pays où la société paie ses impôts", "Country where the company pays tax"), required: true, width: "half" },
      {
        kind: "field",
        id: "a.activityKind",
        type: "radio",
        required: true,
        label: t("Que fait la société aujourd’hui ?", "What does the company do today?"),
        options: [
          { value: "operates", label: t("Elle vend des produits ou des services", "It sells products or services") },
          { value: "supports", label: t("Elle dirige, finance ou sert d’autres sociétés de son groupe", "It manages, finances or serves other companies of its group") },
          { value: "assets", label: t("Elle détient seulement des biens (participations, immeubles, titres, comptes)", "It only holds assets (shareholdings, real estate, securities, accounts)") },
          { value: "notStarted", label: t("Elle n’a pas encore commencé", "It has not started yet") },
        ],
      },
      yesNo("a.listed", t("La société est-elle cotée en bourse, ou détenue à plus de 50 % par une société cotée ?", "Is the company listed on a stock exchange, or more than 50% owned by a listed company?")),
      { kind: "field", id: "a.listedWhere", type: "text", label: t("Quelle société, quelle bourse ?", "Which company, which exchange?"), required: true, showIf: is("a.listed", "yes") },
      {
        kind: "group",
        id: "a.directors",
        label: t("Administrateurs, gérants et signataires", "Directors, managers and signatories"),
        help: t("Une ligne par personne.", "One line per person."),
        itemLabel: t("Personne", "Person"),
        titleFields: ["lastName", "firstName"],
        minRows: 1,
        maxRows: 30,
        fields: [
          { kind: "field", id: "lastName", type: "text", label: t("Nom", "Last name"), required: true, width: "half" },
          { kind: "field", id: "firstName", type: "text", label: t("Prénom(s)", "First name(s)"), required: true, width: "half" },
          { kind: "field", id: "function", type: "text", label: t("Fonction", "Position"), required: true, width: "half" },
          {
            kind: "field",
            id: "signing",
            type: "radio",
            label: t("Signature", "Signature"),
            required: true,
            options: [
              { value: "individual", label: t("Seule", "Alone") },
              { value: "joint", label: t("À deux", "Jointly with another") },
              { value: "none", label: t("Aucune", "None") },
            ],
          },
          { kind: "field", id: "nationality", type: "text", label: t("Nationalité(s)", "Nationality(ies)"), required: true, width: "half" },
          { kind: "field", id: "country", type: "text", label: t("Pays où elle habite", "Country of residence"), required: true, width: "half" },
        ],
      },
      { kind: "heading", id: "a.contactHeading", label: t("Votre interlocuteur", "Your contact person") },
      { kind: "field", id: "a.contactName", type: "text", label: t("Nom", "Name"), required: true, width: "half" },
      { kind: "field", id: "a.contactEmail", type: "email", label: t("E-mail", "Email"), required: true, width: "half" },
      { kind: "field", id: "a.contactPhone", type: "tel", label: t("Téléphone", "Phone"), required: true, width: "half" },
      { kind: "field", id: "a.website", type: "text", label: t("Site internet", "Website"), width: "half" },
      yesNo("a.ownPremises", t("A-t-elle ses propres locaux ?", "Does it have its own premises?"), { help: t("Bureau, atelier, magasin. Une adresse de domiciliation ne compte pas.", "Office, workshop, shop. A domiciliation address does not count."), width: "half", showIf: isOp }),
      { kind: "field", id: "a.activityAddress", type: "text", label: t("Adresse des locaux, si ce n’est pas le siège", "Address of the premises, if not the registered office"), maxLength: 300, showIf: (a) => isOp(a) && a["a.ownPremises"] === "yes" },
      yesNo("a.ownStaff", t("A-t-elle ses propres employés ?", "Does it have its own employees?"), { help: t("Des personnes sous contrat de travail avec la société.", "People under an employment contract with the company."), width: "half", showIf: isOp }),
      // Retired 2026-11-13: yes/no is enough for the indicator.
      retired("a.staffCount", "integer", t("Combien d’employés ?", "How many employees?")),
    ],
  },

  // ---- B: beneficial owners ------------------------------------------------------------------------
  {
    id: "b.pp",
    section: "B",
    title: t("À qui appartient l’argent ?", "Who does the money belong to?"),
    intro: t("La loi appelle cette personne « l’ayant droit économique ».", "The law calls this person the “beneficial owner”."),
    showIf: isPP,
    blocks: [
      {
        kind: "field",
        id: "b.ppOwner",
        type: "radio",
        required: true,
        label: t("L’argent et les biens concernés par notre mandat sont-ils à vous ?", "Do the money and assets involved in our mandate belong to you?"),
        help: t("Même si un compte ou un contrat est au nom d’un autre.", "Even if an account or a contract is in someone else's name."),
        options: [
          { value: "self", label: t("Oui, seulement à moi", "Yes, to me alone") },
          { value: "others", label: t("Non, ou pas seulement à moi", "No, or not to me alone") },
        ],
      },
      {
        kind: "group",
        id: "b.ppOthers",
        label: t("À qui d’autre ?", "Who else?"),
        itemLabel: t("Personne", "Person"),
        titleFields: ["lastName", "firstName"],
        minRows: 1,
        maxRows: 10,
        showIf: is("b.ppOwner", "others"),
        fields: [...personFields(), { kind: "field", id: "relation", type: "text", label: t("Lien avec vous", "Relationship to you"), width: "half" }],
      },
      yesNo("b.ppStructure", t("Ces biens sont-ils détenus par une société, un trust ou une fondation ?", "Are these assets held by a company, a trust or a foundation?"), { help: t("Exemple : un immeuble détenu par votre SA. Trust : structure où quelqu’un gère des biens pour d’autres.", "Example: a building held by your company. Trust: a structure in which someone manages assets for others.") }),
      { kind: "field", id: "b.ppStructureDetails", type: "textarea", label: t("Laquelle ? Nom, pays, et qui détient quoi", "Which one? Name, country, and who holds what"), help: t("Exemple : X SA (Suisse) détient l’immeuble ; vous détenez 100 % de X SA.", "Example: X SA (Switzerland) owns the building; you hold 100% of X SA."), required: true, showIf: is("b.ppStructure", "yes") },
    ],
  },
  {
    id: "b.pm",
    section: "B",
    title: t("Qui possède la société ?", "Who owns the company?"),
    showIf: isPM,
    blocks: [
      { kind: "note", id: "b.listedNote", showIf: isListed, text: t("Société cotée : nous verrons si cette page est nécessaire.", "Listed company: we will check whether this page is needed.") },
      // Operating company: art. 2a al. 3 LBA, in order.
      {
        kind: "field",
        id: "b.q25",
        type: "radio",
        required: true,
        label: t("Une ou plusieurs personnes détiennent-elles au moins 25 % de la société (capital ou voix) ?", "Do one or more people hold at least 25% of the company (capital or votes)?"),
        help: t(
          "Comptez aussi les parts détenues via une autre société, ou ensemble avec d’autres par accord. Seules comptent des personnes, pas des sociétés.",
          "Count shares held through another company, or together with others by agreement, too. Only people count, not companies.",
        ),
        options: [
          { value: "yes", label: t("Oui", "Yes") },
          { value: "no", label: t("Non", "No") },
          { value: "unidentified", label: SAME_UNIDENTIFIED },
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
          "Quelqu’un contrôle-t-il la société autrement, par exemple par un accord entre actionnaires, un droit de veto ou le droit de nommer la majorité du conseil ?",
          "Does someone control the company otherwise, for example through a shareholders' agreement, a veto right or the right to appoint most of the board?",
        ),
        options: [
          { value: "yes", label: t("Oui", "Yes") },
          { value: "no", label: t("Non", "No") },
          { value: "unidentified", label: SAME_UNIDENTIFIED },
        ],
        showIf: (a) => cascade(a) && a["b.q25"] === "no",
      },
      {
        kind: "field",
        id: "b.unidentifiedReason",
        type: "textarea",
        required: true,
        maxLength: 1500,
        label: t("Pourquoi ne sait-on pas qui c’est ?", "Why does nobody know who it is?"),
        help: t("Décrivez ce que vous savez : qui détient la société, puis qui détient cet actionnaire, avec pays et parts.", "Describe what you know: who owns the company, then who owns that shareholder, with countries and shares."),
        showIf: (a) => cascade(a) && (a["b.q25"] === "unidentified" || a["b.qOther"] === "unidentified"),
      },
      B_OP_GROUP_OTHER,
      B_OP_GROUP_MANAGER,
      yesNo("b.forThird", t("La société détient-elle de l’argent ou des biens qui appartiennent à quelqu’un d’autre ?", "Does the company hold money or assets that belong to someone else?"), { help: t("Exemple : des fonds de clients.", "Example: client funds."), showIf: isOp }),
      { kind: "field", id: "b.forThirdDetails", type: "textarea", label: t("À qui, et quoi ?", "Whose, and what?"), required: true, showIf: (a) => isOp(a) && a["b.forThird"] === "yes" },
      // Non-operating company: art. 2a al. 6 LBA, every beneficial owner of the assets.
      B_NONOP_GROUP,
      yesNo("b.structure", t("Entre la société et ses propriétaires, y a-t-il une autre société, un trust, une fondation ou un prête-nom ?", "Between the company and its owners, is there another company, a trust, a foundation or a nominee?"), { help: t("Prête-nom : quelqu’un qui détient des parts pour un autre. Trust : structure où quelqu’un gère des biens pour d’autres.", "Nominee: someone who holds shares for another person. Trust: a structure in which someone manages assets for others.") }),
      {
        kind: "field",
        id: "b.structureKinds",
        type: "checkboxes",
        label: t("Lesquels ?", "Which?"),
        required: true,
        showIf: is("b.structure", "yes"),
        options: [
          { value: "company", label: t("Une ou plusieurs sociétés", "One or more companies") },
          { value: "trust", label: t("Un trust", "A trust") },
          { value: "foundation", label: t("Une fondation", "A foundation") },
          { value: "nominee", label: t("Un prête-nom", "A nominee") },
        ],
      },
      { kind: "field", id: "b.structureDetails", type: "textarea", label: t("Qui détient quoi, étape par étape jusqu’aux personnes ?", "Who holds what, step by step down to the people?"), help: t("Exemple : X SA (Suisse) détient 100 % de la société ; Mme Y (France) détient 60 % de X SA, M. Z 40 %.", "Example: X SA (Switzerland) holds 100% of the company; Ms Y (France) holds 60% of X SA, Mr Z 40%."), required: true, showIf: is("b.structure", "yes") },
      {
        kind: "note",
        id: "b.structureNote",
        tone: "warning",
        showIf: (a) => has("b.structureKinds", "trust")(a) || has("b.structureKinds", "foundation")(a),
        text: t("Trust ou fondation : nous vous contacterons pour la suite. Vous pouvez déjà envoyer le formulaire.", "Trust or foundation: we will contact you about the next steps. You can already send the form."),
      },
      {
        kind: "field",
        id: "b.transparency",
        type: "radio",
        required: true,
        label: t("Les propriétaires de la société sont-ils inscrits au registre de transparence ?", "Are the company's owners recorded in the transparency register?"),
        help: t("Registre fédéral des propriétaires de sociétés, obligatoire depuis octobre 2026.", "The federal register of company owners, compulsory since October 2026."),
        options: [
          { value: "done", label: t("Oui", "Yes") },
          { value: "notYet", label: t("Pas encore", "Not yet") },
          { value: "unknown", label: t("Je ne sais pas", "I don't know") },
          { value: "notConcerned", label: t("Pas concernée (société étrangère)", "Not concerned (foreign company)") },
        ],
      },
      { kind: "note", id: "b.transparencyNote", showIf: (a) => a["b.transparency"] === "notYet" || a["b.transparency"] === "unknown", text: t("Nous pouvons faire l’inscription pour vous.", "We can make the filing for you.") },
      // Retired 2026-11-13.
      B_SHAREHOLDERS_RETIRED,
      retired("b.transparencyDate", "date", t("Date de la déclaration", "Date of the declaration")),
    ],
  },

  // ---- C: PEP, sanctions, criminal proceedings ------------------------------------------------------
  {
    id: "c",
    section: "C",
    title: t("Fonctions publiques, sanctions, procédures", "Public office, sanctions, proceedings"),
    intro: t("Ces trois questions vous concernent, ainsi que les personnes citées plus haut.", "These three questions cover you and the people named earlier."),
    variants: [{ when: isPM, intro: t("Ces trois questions concernent la société et les personnes qui la possèdent, la dirigent ou signent pour elle.", "These three questions cover the company and the people who own it, run it or sign for it.") }],
    blocks: [
      {
        kind: "field",
        id: "c.pep",
        type: "radio",
        required: true,
        label: t("Quelqu’un exerce-t-il, ou a-t-il exercé, une haute fonction publique, ou est-il proche d’une telle personne ?", "Does anyone hold, or has anyone held, a senior public office, or is anyone close to such a person?"),
        help: t(
          "Par exemple chef d’État, ministre, parlementaire national, juge suprême, officier général, dirigeant d’une entreprise publique ou d’un parti, en Suisse, à l’étranger ou dans une organisation internationale (fédérations sportives comprises). Proche : famille, ami ou associé. Une fonction suisse quittée il y a plus de 18 mois ne compte plus. La loi parle de « personne politiquement exposée » (PPE).",
          "For example a head of state, minister, member of a national parliament, supreme court judge, general, head of a state-owned company or of a party, in Switzerland, abroad or in an international organisation (sports federations included). Close: family, friend or business partner. A Swiss office left more than 18 months ago no longer counts. The law calls this a “politically exposed person” (PEP).",
        ),
        options: [
          { value: "none", label: t("Non", "No") },
          { value: "pep", label: t("Oui", "Yes") },
          { value: "close", label: t("Oui, un proche", "Yes, someone close") },
        ],
      },
      {
        kind: "field",
        id: "c.pepKinds",
        type: "checkboxes",
        required: true,
        label: t("Où ?", "Where?"),
        showIf: (a) => a["c.pep"] === "pep" || a["c.pep"] === "close",
        options: [
          { value: "foreign", label: t("À l’étranger", "Abroad") },
          { value: "swiss", label: t("En Suisse", "In Switzerland") },
          { value: "intl", label: t("Organisation internationale ou fédération sportive", "International organisation or sports federation") },
        ],
      },
      { kind: "field", id: "c.pepDetails", type: "textarea", label: t("Qui, quelle fonction, où, quand ? Pour un proche : quel lien ?", "Who, which office, where, when? For someone close: what link?"), required: true, showIf: (a) => a["c.pep"] === "pep" || a["c.pep"] === "close" },
      yesNo("c.sanctions", t("Quelqu’un figure-t-il sur une liste de sanctions, ou fait-il des affaires avec des personnes ou des pays sous sanctions ?", "Is anyone on a sanctions list, or doing business with sanctioned people or countries?"), { help: t("Listes de la Suisse, de l’UE, de l’ONU ou des États-Unis.", "Lists of Switzerland, the EU, the UN or the United States.") }),
      { kind: "field", id: "c.sanctionsDetails", type: "textarea", label: t("Qui, et quel lien avec les sanctions ?", "Who, and what link with the sanctions?"), required: true, showIf: is("c.sanctions", "yes") },
      yesNo(
        "c.criminal",
        t("Quelqu’un fait-il l’objet d’une enquête pénale, ou d’une condamnation encore inscrite, pour blanchiment ou une infraction proche ?", "Is anyone under criminal investigation, or subject to a conviction still on record, for money laundering or a related offence?"),
        { help: t("Par exemple corruption, escroquerie, abus de confiance, fraude fiscale grave, financement du terrorisme. En Suisse ou à l’étranger.", "For example bribery, fraud, breach of trust, serious tax fraud, terrorist financing. In Switzerland or abroad.") },
      ),
      { kind: "field", id: "c.criminalDetails", type: "textarea", label: t("Qui, quoi, quelle autorité, où en est-on ?", "Who, what, which authority, what stage?"), required: true, showIf: is("c.criminal", "yes") },
    ],
  },

  // ---- D: services and activity ----------------------------------------------------------------------
  {
    id: "d",
    section: "D",
    title: t("Votre mandat", "Your mandate"),
    blocks: [
      { kind: "field", id: "d.servicesPm", type: "checkboxes", required: true, label: t("Que nous demandez-vous ?", "What are you asking us for?"), options: PM_SERVICES, showIf: isPM },
      { kind: "field", id: "d.servicesPp", type: "checkboxes", required: true, label: t("Que nous demandez-vous ?", "What are you asking us for?"), options: PP_SERVICES, showIf: isPP },
      { kind: "field", id: "d.servicesOther", type: "text", label: t("Laquelle ?", "Which one?"), required: true, showIf: (a) => has("d.servicesPm", "other")(a) || has("d.servicesPp", "other")(a) },
      { kind: "field", id: "d.purpose", type: "textarea", label: t("But de la société (statuts)", "Company purpose (articles)"), required: true, maxLength: 2000, showIf: isPM },
      {
        kind: "field",
        id: "d.activity",
        type: "textarea",
        label: t("Décrivez l’activité de la société et son secteur", "Describe the company's business and its sector"),
        help: t("Exemple : deux restaurants à Genève.", "Example: two restaurants in Geneva."),
        variants: [{ when: isNonOp, label: t("Que détient la société ?", "What does the company hold?"), help: t("Exemple : un immeuble loué à Genève ; les participations d’un groupe familial.", "Example: a let building in Geneva; the shareholdings of a family group.") }],
        required: true,
        maxLength: 2500,
        showIf: isPM,
      },
      { kind: "field", id: "d.companies", type: "textarea", label: t("Quelles sociétés (existantes ou à créer), et que font-elles ?", "Which companies (existing or to be created), and what do they do?"), maxLength: 2000, showIf: ppCompanyConcerned },
      {
        kind: "field",
        id: "d.countries",
        type: "text",
        label: t("Dans quels pays la société travaille-t-elle et fait-elle des paiements ?", "In which countries does the company work and make payments?"),
        help: t("Et les devises, si ce n’est pas que le franc.", "And the currencies, if not only Swiss francs."),
        variants: [{ when: isPP, label: t("Dans quels pays travaillez-vous, avez-vous des biens ou faites-vous des paiements ?", "In which countries do you work, hold assets or make payments?") }],
        required: true,
        maxLength: 700,
      },
      {
        kind: "field",
        id: "d.counterparties",
        type: "textarea",
        label: t("Avec qui la société travaille-t-elle surtout ?", "Who does the company mainly work with?"),
        help: t("Genres de clients et de fournisseurs.", "Kinds of customers and suppliers."),
        variants: [{ when: isPP, label: t("Avec qui travaillez-vous surtout ?", "Who do you mainly work with?") }],
        required: true,
        maxLength: 2000,
      },
      { kind: "field", id: "d.group", type: "text", label: t("Autres sociétés du même groupe", "Other companies of the same group"), help: t("Même société mère ou mêmes propriétaires.", "Same parent company or same owners."), maxLength: 400, showIf: isPM },
      yesNo("d.licence", t("L’activité demande-t-elle une autorisation officielle en Suisse ?", "Does the business need an official licence in Switzerland?"), { help: t("Par exemple banque, assurance, gestion de fortune, restaurant, santé.", "For example banking, insurance, asset management, restaurant, healthcare."), showIf: (a) => isPM(a) || ppCompanyConcerned(a) }),
      { kind: "field", id: "d.licenceDetails", type: "text", label: t("Laquelle, quelle autorité, où en est la demande ?", "Which one, which authority, where does the application stand?"), required: true, maxLength: 400, showIf: (a) => a["d.licence"] === "yes" && (isPM(a) || ppCompanyConcerned(a)) },
      // Retired 2026-11-13: both are in the financial statements asked in H.
      retired("d.turnover", "money", t("Chiffre d’affaires du dernier exercice (CHF)", "Turnover of the last financial year (CHF)")),
      retired("d.balance", "money", t("Total du bilan (CHF)", "Balance sheet total (CHF)")),
    ],
  },

  // ---- E, F, G: money (one screen) ------------------------------------------------------------------
  {
    id: "e",
    section: "E",
    title: t("L’argent", "Money"),
    blocks: [
      {
        kind: "field",
        id: "e.companyAssetSources",
        type: "checkboxes",
        required: true,
        label: t("D’où vient l’argent de la société ?", "Where does the company's money come from?"),
        showIf: isPM,
        options: [
          { value: "activity", label: t("Son activité", "Its business"), showIf: isOp },
          { value: "capital", label: t("Capital apporté", "Capital paid in") },
          { value: "shareholderLoans", label: t("Prêts d’actionnaires", "Shareholder loans") },
          { value: "loans", label: t("Prêts de banques ou d’autres", "Loans from banks or others") },
          { value: "other", label: t("Autre", "Other") },
        ],
      },
      { kind: "field", id: "e.companyAssets", type: "textarea", label: t("Précisez", "Please specify"), required: true, maxLength: 2000, showIf: (a) => isNonOp(a) || (isPM(a) && has("e.companyAssetSources", "other")(a)) },
      { kind: "field", id: "e.ownersWealth", type: "textarea", label: t("D’où vient la fortune des propriétaires ?", "Where does the owners' wealth come from?"), help: t("Une phrase par personne : salaire, entreprise, héritage…", "One sentence per person: salary, business, inheritance…"), required: true, maxLength: 2000, showIf: (a) => isOp(a) && !isListed(a) },
      {
        kind: "field",
        id: "e.wealthSources",
        type: "checkboxes",
        required: true,
        label: t("D’où vient votre fortune ?", "Where does your wealth come from?"),
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
      { kind: "field", id: "e.wealthDetails", type: "textarea", label: t("Précisez en une phrase", "Say more in one sentence"), help: t("Exemple : vente de mon entreprise en 2019.", "Example: sale of my business in 2019."), required: true, maxLength: 2000, showIf: isPP },
      { kind: "field", id: "e.otherWealth", type: "textarea", label: t("D’où vient la fortune des autres personnes ?", "Where does the other people's wealth come from?"), help: t("Une phrase par personne.", "One sentence per person."), required: true, maxLength: 2000, showIf: (a) => isPP(a) && a["b.ppOwner"] === "others" },

      { kind: "heading", id: "f.heading", section: "F", label: t("Versement prévu", "Planned payment") },
      yesNo("f.funds", t("Allez-vous verser de l’argent pour ce mandat, par exemple le capital d’une nouvelle société ?", "Will you pay in money for this mandate, for example the capital of a new company?")),
      { kind: "field", id: "f.origin", type: "textarea", label: t("D’où vient cet argent, et à qui est-il ?", "Where does this money come from, and whose is it?"), help: t("Exemple : vente de mon appartement à Lausanne en mars 2026.", "Example: sale of my flat in Lausanne in March 2026."), required: true, maxLength: 4100, showIf: is("f.funds", "yes") },
      { kind: "field", id: "f.amount", type: "money", label: t("Montant", "Amount"), required: true, width: "half", showIf: is("f.funds", "yes") },
      { kind: "field", id: "f.currency", type: "select", label: t("Devise", "Currency"), required: true, width: "half", options: CURRENCIES, showIf: is("f.funds", "yes") },
      { kind: "field", id: "f.currencyOther", type: "text", label: t("Quelle devise ?", "Which currency?"), required: true, width: "half", maxLength: 40, showIf: (a) => a["f.funds"] === "yes" && a["f.currency"] === "other" },
      { kind: "field", id: "f.bank", type: "text", label: t("Depuis quel compte ?", "From which account?"), help: t("Banque, pays et titulaire.", "Bank, country and account holder."), required: true, maxLength: 450, showIf: is("f.funds", "yes") },

      { kind: "heading", id: "g.heading", section: "G", label: t("Activité prévue", "Expected activity") },
      { kind: "field", id: "g.turnover", type: "money", label: t("Chiffre d’affaires annuel (CHF)", "Annual turnover (CHF)"), help: t("Le dernier connu, ou une estimation pour une société nouvelle.", "The latest known, or an estimate for a new company."), width: "half", required: true, showIf: isOp },
      { kind: "field", id: "g.operations", type: "text", label: t("Combien de paiements par an, pour quel total ?", "How many payments a year, for what total?"), help: t("Une estimation : 40 paiements, environ 200 000 CHF.", "An estimate: 40 payments, about CHF 200,000."), required: true },
      { kind: "field", id: "g.typesPm", type: "checkboxes", required: true, label: t("Quels genres de paiements prévoyez-vous ?", "What kinds of payments do you expect?"), options: PM_OPERATIONS, showIf: isPM },
      { kind: "field", id: "g.typesPp", type: "checkboxes", required: true, label: t("Quels genres de paiements prévoyez-vous ?", "What kinds of payments do you expect?"), options: PP_OPERATIONS, showIf: isPP },
      { kind: "field", id: "g.typesOther", type: "text", label: t("Lequel ?", "Which one?"), required: true, showIf: (a) => has("g.typesPm", "other")(a) || has("g.typesPp", "other")(a) },
      // Retired 2026-11-13.
      retired("f.more", "text", t("Autres versements prévus ?", "Other payments planned?")),
      retired("g.turnoverPp", "money", t("Chiffre d'affaires annuel prévu (CHF, seulement si une société est concernée)", "Expected annual turnover (CHF, only if a company is concerned)")),
    ],
  },

  // ---- H: documents ----------------------------------------------------------------------------------
  {
    id: "h",
    section: "H",
    title: t("Documents", "Documents"),
    intro: t("Joignez chaque document, ou dites-nous que vous l’envoyez autrement. PDF ou photo (JPG, PNG, HEIC).", "Attach each document, or tell us you are sending it another way. PDF or photo (JPG, PNG, HEIC)."),
    special: "documents",
    blocks: [],
  },

  // ---- I: declarations -------------------------------------------------------------------------------
  {
    id: "i",
    section: "I",
    title: t("Signature", "Signature"),
    blocks: [
      { kind: "note", id: "i.declarations", text: t("{declarations}", "{declarations}") },
      {
        kind: "group",
        id: "i.signers",
        label: t("Qui signe pour la société ?", "Who signs for the company?"),
        help: t("Une ou deux personnes qui peuvent l’engager.", "One or two people who can bind it."),
        itemLabel: t("Signataire", "Signatory"),
        titleFields: ["lastName", "firstName"],
        minRows: 1,
        maxRows: 2,
        showIf: isPM,
        fields: [
          { kind: "field", id: "lastName", type: "text", label: t("Nom", "Last name"), required: true, width: "half" },
          { kind: "field", id: "firstName", type: "text", label: t("Prénom(s)", "First name(s)"), required: true, width: "half" },
          { kind: "field", id: "function", type: "text", label: t("Fonction", "Position"), required: true, width: "half" },
          { kind: "field", id: "email", type: "email", label: t("E-mail pour signer en ligne", "Email to sign online"), help: t("Chacun reçoit un lien et un code. Sans e-mail, on signe sur papier.", "Each person receives a link and a code. Without an email, the form is signed on paper."), width: "half" },
        ],
      },
      { kind: "field", id: "i.place", type: "text", label: t("Lieu", "Place"), required: true, width: "half" },
      { kind: "field", id: "i.accept", type: "boolean", required: true, label: t("J’ai lu ces déclarations. Je les confirmerai en signant.", "I have read these declarations. I will confirm them by signing.") },
    ],
  },

  {
    id: "review",
    title: t("Relire et envoyer", "Review and send"),
    special: "review",
    blocks: [],
  },
];

/**
 * Answers a new case starts with, before Ark's prefill: an operating company's money comes from
 * its business unless the client says otherwise. Not marked as Ark's prefill.
 */
export function routeDefaults(route: string): Answers {
  return route === "pm-op" ? { "e.companyAssetSources": ["activity"] } : {};
}

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
