/**
 * The questionnaire, as data: screens, questions (fr/en/de), branching (showIf), options.
 *
 * Design rules (owner, binding):
 * - Documents are the source of truth: never ask an amount that a document carries; ask the
 *   names (employer, bank, lender, insurer) so the checklist can name the document expected.
 * - Regime first, then one router screen of cards, then one short screen per selected topic.
 * - Ask questions, do not state law; any explanation stays general and hedged.
 * The document checklist is in documents.ts, the preparer's flags in attention.ts.
 */
import { CANTONS, CONFESSION, CURRENCIES, PERMITS, YES_NO_UNKNOWN } from "./options";
import { t, type Answers, type FieldDef, type FieldType, type GroupDef, type L, type NoteDef, type Option, type Row, type StepDef } from "./types";

// ---- helpers ------------------------------------------------------------------------------------

type FieldExtra = Omit<Partial<FieldDef>, "kind" | "id" | "type" | "label">;
const f = (id: string, type: FieldType, label: L, extra: FieldExtra = {}): FieldDef => ({ kind: "field", id, type, label, ...extra });
/**
 * Renewal, on every repeatable group: a row carried over from last year ("carried" = that year)
 * gets a status for the new year: still there, ended during the year (with the date), or changed.
 * New rows have no "carried" mark. Hidden fields: the group screen shows them as a compact choice.
 */
const renewalFields = (): FieldDef[] => [
  f("carried", "text", t("Repris de", "Carried over from", "Übernommen aus"), { hidden: true, maxLength: 4 }),
  f("renewal", "select", t("Situation en {year}", "Situation in {year}", "Situation im Jahr {year}"), {
    hidden: true,
    required: true,
    showIf: (_a, row) => !!row?.carried,
    options: [
      { value: "kept", label: t("Toujours là", "Still there", "Weiterhin") },
      { value: "ended", label: t("Terminé en cours d'année", "Ended during the year", "Im Laufe des Jahres beendet") },
      { value: "changed", label: t("Modifié", "Changed", "Geändert") },
    ],
  }),
  f("endedOn", "date", t("Date de fin", "End date", "Enddatum"), { hidden: true, required: true, showIf: (_a, row) => !!row?.carried && row?.renewal === "ended" }),
];
const group = (def: Omit<GroupDef, "kind">): GroupDef => ({ kind: "group", ...def, fields: def.hidden ? def.fields : [...def.fields, ...renewalFields()] });
const note = (id: string, text: L, extra: Omit<Partial<NoteDef>, "kind" | "id" | "text"> = {}): NoteDef => ({ kind: "note", id, text, ...extra });
const heading = (id: string, label: L, showIf?: (a: Answers) => boolean) => ({ kind: "heading" as const, id, label, showIf });
export const opts = (...rows: [string, string, string, string][]): Option[] => rows.map(([value, fr, en, de]) => ({ value, label: t(fr, en, de) }));

const str = (value: unknown) => (typeof value === "string" ? value : "");
const arr = (value: unknown): string[] => (Array.isArray(value) ? (value as string[]).filter((v) => typeof v === "string") : []);

/** Rows of a group answer (empty when absent or malformed). */
export function rowsOf(answers: Answers, groupId: string): Row[] {
  const value = answers[groupId];
  return Array.isArray(value) ? (value.filter((row) => row && typeof row === "object") as Row[]) : [];
}

/** Router cards ticked on the "What applies to you" screen. */
export const routerItems = (a: Answers) => arr(a["router.items"]);
export const has = (item: string) => (a: Answers) => routerItems(a).includes(item);
export const hasAny = (...items: string[]) => (a: Answers) => items.some((item) => routerItems(a).includes(item));
const yes = (id: string) => (a: Answers) => a[id] === "yes";
const is = (id: string, ...values: string[]) => (a: Answers) => values.includes(str(a[id]));
const rowIs = (field: string, ...values: string[]) => (_a: Answers, row?: Row) => values.includes(str(row?.[field]));
const rowHas = (field: string, ...values: string[]) => (_a: Answers, row?: Row) => arr(row?.[field]).some((v) => values.includes(v));
const rowYes = (field: string) => rowIs(field, "yes");
const rowNo = (field: string) => rowIs(field, "no");
const both = (...preds: ((a: Answers, row?: Row) => boolean)[]) => (a: Answers, row?: Row) => preds.every((p) => p(a, row));

// ---- derived situation --------------------------------------------------------------------------

export const isCouple = is("start.household", "couple");
/** Residence during the year. */
export const residence = (a: Answers) => str(a["regime.residence"]);
export const livesAbroadAllYear = (a: Answers) => residence(a) === "abroad";
export const arrived = (a: Answers) => ["arrived", "both"].includes(residence(a));
export const left = (a: Answers) => ["left", "both"].includes(residence(a));
export const residentPartOfYear = (a: Answers) => !!residence(a) && !livesAbroadAllYear(a);
export const isLumpSum = (a: Answers) => residentPartOfYear(a) && a["regime.lumpSum"] === "yes";
export const isGenevaResident = (a: Answers) => a["start.canton"] === "GE";
/** Cantons whose return asks for the denomination (church tax). GE (voluntary contribution), VD (none) and NE (voluntary) excluded; VS/TI [uncertain]. */
const NO_CHURCH_TAX = new Set(["GE", "VD", "NE", "ABROAD", ""]);
export const asksChurchTax = (a: Answers) => residentPartOfYear(a) && !NO_CHURCH_TAX.has(str(a["start.canton"]));
export const sourceTaxed = (a: Answers) => !isLumpSum(a) && a["regime.sourceTax"] === "yes";
export const sourceTaxedResident = (a: Answers) => sourceTaxed(a) && residentPartOfYear(a);
export const nonResidentReasons = (a: Answers) => (livesAbroadAllYear(a) ? arr(a["regime.nrReasons"]) : []);
export const worksInSwitzerlandFromAbroad = (a: Answers) => nonResidentReasons(a).includes("work");
/** Filed a Swiss return before (alone, with another preparer or with Ark). */
export const previouslyTaxed = is("start.status", "filedBefore", "arkClient");
export const lastReturnUploaded = yes("base.lastReturnUploaded");
/** Answers pre-filled from last year's questionnaire (renewal) or from the AI reading of the last return. */
export const prefilled = (a: Answers) => !!str(a["base.prefilledFrom"]);
/** Renewal from last year's questionnaire (annual campaign): the year it was carried over from. */
export const renewalYear = (a: Answers) => (/^\d{4}$/.test(str(a["base.prefilledFrom"])) ? str(a["base.prefilledFrom"]) : "");
/**
 * "Unchanged since last year" is offered only next to concrete items known from last year
 * (prefill), never as a blind switch. An unchanged area keeps its pre-filled rows (so the same
 * institutions' documents are still requested) and its detail screen is skipped.
 */
export const unchanged = (groupId: string) => (a: Answers) => prefilled(a) && arr(a["router.unchanged"]).includes(groupId);

export const ROUTER_GROUPS: { id: string; label: L }[] = [
  { id: "family", label: t("Famille", "Family", "Familie") },
  { id: "work", label: t("Travail et revenus", "Work and income", "Arbeit und Einkommen") },
  { id: "assets", label: t("Fortune et dettes", "Assets and debts", "Vermögen und Schulden") },
  { id: "property", label: t("Immobilier", "Real estate", "Liegenschaften") },
  { id: "other", label: t("Déductions et autres", "Deductions and other", "Abzüge und Weiteres") },
];

const card = (group: string, value: string, fr: string, en: string, de: string, hint?: L, showIf?: (a: Answers) => boolean): Option => ({
  value,
  group,
  label: t(fr, en, de),
  hint,
  showIf,
});

export const ROUTER_OPTIONS: Option[] = [
  // Family
  card("family", "civilChange", "Mariage, séparation, divorce ou décès du conjoint en {year}", "Marriage, separation, divorce or death of a spouse in {year}", "Heirat, Trennung, Scheidung oder Tod des Ehegatten im Jahr {year}"),
  card("family", "children", "Enfants à charge", "Dependent children", "Unterhaltsberechtigte Kinder", t("Mineurs ou en formation", "Minors or in education", "Minderjährig oder in Ausbildung")),
  card("family", "childcare", "Frais de garde des enfants", "Childcare costs", "Kinderbetreuungskosten", t("Crèche, parascolaire, maman de jour…", "Day care, after-school, childminder…", "Kita, Hort, Tagesmutter…")),
  card("family", "dependants", "Autre personne à charge", "Other dependant", "Andere unterstützte Person", t("Parent ou proche que vous soutenez", "A parent or relative you support", "Eltern oder Angehörige, die Sie unterstützen")),
  card("family", "alimonyPaid", "Pension alimentaire versée", "Maintenance paid", "Bezahlte Unterhaltsbeiträge"),
  card("family", "alimonyReceived", "Pension alimentaire reçue", "Maintenance received", "Erhaltene Unterhaltsbeiträge"),
  // Work and income
  card("work", "employed", "Salarié(e)", "Employee", "Angestellt", t("Vous ou votre conjoint", "You or your spouse", "Sie oder Ihr Ehegatte")),
  card("work", "equity", "Actions, options ou RSU de l'employeur", "Employer shares, options or RSUs", "Mitarbeiteraktien, -optionen oder RSU"),
  card("work", "selfEmployed", "Activité indépendante", "Self-employed", "Selbständig erwerbend"),
  card("work", "companyOwner", "Actionnaire ou dirigeant d'une société", "Shareholder or director of a company", "Aktionär(in) oder Organ einer Gesellschaft", t("SA, Sàrl… (non cotée)", "Private company (SA, Sàrl…)", "Nicht kotierte AG, GmbH…")),
  card("work", "swissBusiness", "Activité ou établissement en Suisse", "Business or permanent establishment in Switzerland", "Geschäft oder Betriebsstätte in der Schweiz", undefined, livesAbroadAllYear),
  card("work", "avsNonEmployed", "Cotisations AVS sans activité lucrative", "AHV contributions as a non-employed person", "AHV-Beiträge als Nichterwerbstätige(r)", t("Retraite anticipée, études, conjoint sans activité…", "Early retirement, studies, non-working spouse…", "Frühpensionierung, Studium, nicht erwerbstätiger Ehegatte…")),
  card("work", "benefits", "Chômage, maladie, accident, maternité, APG", "Unemployment, sickness, accident, maternity, EO", "Arbeitslosigkeit, Krankheit, Unfall, Mutterschaft, EO", t("Indemnités journalières", "Daily allowances", "Taggelder")),
  card("work", "pension", "Rentes (AVS/AI, caisse de pension, étrangères)", "Pensions (AHV/IV, pension fund, foreign)", "Renten (AHV/IV, Pensionskasse, ausländische)"),
  card("work", "capital", "Capital reçu (prévoyance ou assurance-vie)", "Lump sum received (pension or life insurance)", "Kapitalleistung (Vorsorge oder Lebensversicherung)", t("2e pilier, 3e pilier A ou assurance-vie", "2nd pillar, pillar 3a or life insurance", "2. Säule, Säule 3a oder Lebensversicherung")),
  card("work", "severance", "Indemnité de départ", "Severance pay", "Abgangsentschädigung"),
  card("work", "foreignIncome", "Autres revenus de l'étranger", "Other foreign income", "Andere ausländische Einkünfte"),
  // Assets and debts
  card("assets", "banksCH", "Comptes bancaires ou postaux en Suisse", "Bank or postal accounts in Switzerland", "Bank- oder Postkonten in der Schweiz", t("Y compris ceux des enfants mineurs", "Including those of minor children", "Auch jene minderjähriger Kinder")),
  card("assets", "banksForeign", "Comptes ou dépôts à l'étranger", "Accounts or portfolios abroad", "Konten oder Depots im Ausland"),
  card("assets", "securities", "Titres, fonds, portefeuille", "Securities, funds, portfolio", "Wertschriften, Fonds, Depot", t("Y compris titres étrangers", "Including foreign securities", "Auch ausländische Wertschriften")),
  card("assets", "crypto", "Cryptoactifs", "Crypto-assets", "Kryptowährungen"),
  card("assets", "lifeInsurance", "Assurance-vie avec valeur de rachat", "Life insurance with surrender value", "Lebensversicherung mit Rückkaufswert", t("Hors 3e pilier A", "Excluding pillar 3a", "Ohne Säule 3a")),
  card("assets", "vehicles", "Voiture, moto, bateau, avion", "Car, motorbike, boat, aircraft", "Auto, Motorrad, Boot, Flugzeug"),
  card("assets", "valuables", "Objets de valeur", "Valuables", "Wertgegenstände", t("Or, métaux précieux, bijoux, art, collections", "Gold, precious metals, jewellery, art, collections", "Gold, Edelmetalle, Schmuck, Kunst, Sammlungen")),
  card("assets", "loansGiven", "Prêt accordé à un tiers", "Loan granted to someone", "Darlehen an Dritte"),
  card("assets", "debts", "Dettes (hors hypothèque)", "Debts (other than mortgage)", "Schulden (ohne Hypothek)", t("Crédit, leasing exclu, prêt privé…", "Loan, private loan… (not leasing)", "Kredit, Privatdarlehen… (ohne Leasing)")),
  // Property
  card("property", "propertyCH", "Bien immobilier en Suisse", "Real estate in Switzerland", "Liegenschaft in der Schweiz", t("Logement, location, terrain, parking", "Home, rental, land, parking", "Wohnung, Vermietung, Land, Parkplatz")),
  card("property", "propertyAbroad", "Bien immobilier à l'étranger", "Real estate abroad", "Liegenschaft im Ausland"),
  // Deductions and other
  card("other", "p3a", "3e pilier A", "Pillar 3a", "Säule 3a"),
  card("other", "lppBuyin", "Rachat dans la caisse de pension", "Pension fund buy-in", "Einkauf in die Pensionskasse"),
  card("other", "donations", "Dons", "Donations", "Spenden"),
  card("other", "lamalSubsidy", "Subside d'assurance maladie reçu", "Health insurance subsidy received", "Prämienverbilligung erhalten", undefined, residentPartOfYear),
  card("other", "medical", "Frais médicaux ou liés à un handicap importants", "Significant medical or disability costs", "Hohe Krankheits- oder Behinderungskosten"),
  card("other", "training", "Formation continue payée vous-même", "Further training paid yourself", "Selbst bezahlte Weiterbildung"),
  card("other", "inheritance", "Héritage ou donation reçu(e) ou fait(e)", "Inheritance or gift received or made", "Erbschaft oder Schenkung erhalten oder gemacht"),
  card("other", "lottery", "Gain de loterie ou de jeu", "Lottery or gambling win", "Lotterie- oder Spielgewinn", t("Y compris jeux en ligne", "Including online games", "Auch Online-Spiele")),
  card("other", "trust", "Trust ou fondation", "Trust or foundation", "Trust oder Stiftung", t("Constituant ou bénéficiaire", "Settlor or beneficiary", "Errichter(in) oder Begünstigte(r)")),
  card("other", "usPerson", "Citoyenneté américaine ou green card", "US citizenship or green card", "US-Staatsbürgerschaft oder Green Card"),
  card("other", "regularisation", "Revenus ou biens non déclarés les années passées", "Income or assets not declared in past years", "In früheren Jahren nicht deklarierte Einkünfte oder Vermögen", t("Nous en parlerons en toute confidentialité", "We will discuss it in confidence", "Wir besprechen das vertraulich")),
  card("other", "unusual", "Autre situation particulière", "Another special situation", "Andere besondere Situation"),
];

const PERSON2: Option[] = opts(["me", "Moi", "Me", "Ich"], ["spouse", "Mon conjoint", "My spouse", "Mein Ehegatte"]);
const whose = (id = "person") => f(id, "select", t("Concerne", "Concerns", "Betrifft"), { options: PERSON2, width: "half", showIf: isCouple });

// ---- screens -------------------------------------------------------------------------------------

const start: StepDef = {
  id: "start",
  title: t("Pour commencer", "Getting started", "Zu Beginn"),
  intro: t(
    "Quelques questions, puis vos documents. Vous pouvez vous arrêter et reprendre plus tard.",
    "A few questions, then your documents. You can stop and continue later.",
    "Einige Fragen, dann Ihre Dokumente. Sie können jederzeit unterbrechen und später weitermachen.",
  ),
  sheet: "Données de base",
  blocks: [
    f("start.years", "taxyears", t("Pour quelle(s) année(s) fiscale(s) ?", "For which tax year(s)?", "Für welche(s) Steuerjahr(e)?"), {
      required: true,
      help: t("En général l'année précédente. Cochez aussi les années plus anciennes non encore déclarées.", "Usually last year. Also tick any older years not yet filed.", "In der Regel das Vorjahr. Kreuzen Sie auch ältere, noch nicht eingereichte Jahre an."),
    }),
    f("start.yearsChanged", "radio", t("Votre situation a-t-elle beaucoup changé entre ces années ?", "Did your situation change materially between those years?", "Hat sich Ihre Situation zwischen diesen Jahren wesentlich verändert?"), {
      options: YES_NO_UNKNOWN,
      showIf: (a) => arr(a["start.years"]).length > 1,
      help: t("Si oui, nous vous appellerons pour les années précédentes ; répondez ici pour la plus récente.", "If so, we will call you about the earlier years; answer here for the most recent one.", "Falls ja, rufen wir Sie zu den früheren Jahren an; beantworten Sie hier das jüngste Jahr."),
    }),
    f("start.household", "radio", t("Vous remplissez pour…", "You are filling in for…", "Sie füllen aus für…"), {
      required: true,
      options: [
        { value: "single", label: t("Moi seul(e)", "Myself only", "Nur mich") },
        { value: "couple", label: t("Notre couple (marié ou partenariat enregistré)", "Our couple (married or registered partners)", "Unser Paar (verheiratet oder eingetragene Partnerschaft)"), hint: t("En principe une déclaration commune (deux l'année du décès d'un conjoint)", "In principle one joint return (two in the year a spouse dies)", "Grundsätzlich eine gemeinsame Erklärung (zwei im Todesjahr eines Ehegatten)") },
        { value: "cohabiting", label: t("Moi, en couple non marié", "Myself, in an unmarried couple", "Mich, in unverheirateter Partnerschaft"), hint: t("Chaque partenaire remplit son propre questionnaire", "Each partner fills in their own questionnaire", "Jede Person füllt einen eigenen Fragebogen aus") },
      ],
    }),
    f("start.spouseAbroad", "yesno", t("Votre conjoint habitait-il à l'étranger en {year} ?", "Did your spouse live abroad in {year}?", "Wohnte Ihr Ehegatte im Jahr {year} im Ausland?"), { width: "half", showIf: isCouple }),
    f("start.canton", "select", t("Canton de domicile au 31.12", "Canton of residence at 31.12", "Wohnsitzkanton am 31.12."), {
      required: true,
      width: "half",
      options: [
        ...CANTONS,
        { value: "ABROAD", label: t("Pas domicilié(e) en Suisse au 31.12", "Not resident in Switzerland at 31.12", "Am 31.12. kein Wohnsitz in der Schweiz") },
      ],
    }),
    f("start.commune", "commune", t("Commune", "Municipality", "Gemeinde"), { required: true, width: "half", cantonField: "start.canton", showIf: (a) => !!a["start.canton"] && a["start.canton"] !== "ABROAD" }),
    f("start.communeBfs", "text", t("N° OFS de la commune", "Municipality BFS number", "BFS-Gemeindenummer"), { hidden: true, maxLength: 6, showIf: (a) => !!a["start.canton"] && a["start.canton"] !== "ABROAD" }),
    // Case prepared by Ark from the client's own information (staff invitation with a pre-fill):
    // ids of the pre-filled questions (shown "pre-filled by Ark — to check") and extra documents.
    f("start.arkPrefilled", "textarea", t("Réponses pré-remplies par Ark", "Answers pre-filled by Ark", "Von Ark vorausgefüllte Antworten"), { hidden: true, maxLength: 4000 }),
    group({
      id: "start.arkDocs",
      label: t("Documents demandés par Ark", "Documents requested by Ark", "Von Ark angeforderte Dokumente"),
      itemLabel: t("Document", "Document", "Dokument"),
      titleField: "label",
      hidden: true,
      maxRows: 40,
      fields: [f("label", "text", t("Document", "Document", "Dokument"), { maxLength: 200 }), f("staff", "text", t("Ajouté par le staff", "Added by staff", "Vom Team hinzugefügt"), { hidden: true, maxLength: 1 })],
    }),
    heading("start.contactHeading", t("Vos coordonnées", "Your contact details", "Ihre Kontaktdaten")),
    f("start.firstName", "text", t("Prénom", "First name", "Vorname"), { required: true, width: "half", maxLength: 100 }),
    f("start.lastName", "text", t("Nom", "Last name", "Name"), { required: true, width: "half", maxLength: 100 }),
    f("start.spouseFirstName", "text", t("Prénom du conjoint", "Spouse's first name", "Vorname des Ehegatten"), { required: true, width: "half", maxLength: 100, showIf: isCouple }),
    f("start.spouseLastName", "text", t("Nom du conjoint", "Spouse's last name", "Name des Ehegatten"), { required: true, width: "half", maxLength: 100, showIf: isCouple }),
    f("start.email", "email", t("E-mail", "Email", "E-Mail"), { required: true, width: "half" }),
    f("start.phone", "tel", t("Téléphone", "Phone", "Telefon"), { required: true, width: "half", maxLength: 40 }),
    f("start.status", "radio", t("Votre dernière déclaration suisse", "Your last Swiss tax return", "Ihre letzte Schweizer Steuererklärung"), {
      required: true,
      options: opts(
        ["first", "Ce sera ma première déclaration en Suisse", "This will be my first Swiss return", "Es wird meine erste Schweizer Steuererklärung"],
        ["filedBefore", "Je l'ai faite moi-même ou avec un autre mandataire", "I did it myself or with another adviser", "Ich habe sie selbst oder mit einer anderen Vertretung gemacht"],
        ["arkClient", "Ark Fiduciaire s'en est occupé", "Ark Fiduciaire prepared it", "Ark Fiduciaire hat sie erstellt"],
      ),
    }),
    f("start.previousPreparer", "text", t("Nom du précédent mandataire (s'il y en a un)", "Name of the previous adviser (if any)", "Name der früheren Vertretung (falls vorhanden)"), { width: "half", showIf: is("start.status", "filedBefore") }),
    f("start.previousFile", "radio", t("Pouvez-vous obtenir de lui votre dossier de l'an dernier ?", "Can you get last year's file from them?", "Können Sie von ihr Ihr Vorjahresdossier erhalten?"), {
      options: YES_NO_UNKNOWN,
      showIf: (a) => is("start.status", "filedBefore")(a) && !!str(a["start.previousPreparer"]),
      help: t("Pensez aussi à révoquer une éventuelle procuration en sa faveur.", "Also remember to revoke any power of attorney given to them.", "Denken Sie auch daran, eine allfällige Vollmacht zu widerrufen."),
    }),
    f("start.avisReceived", "yesno", t("Avez-vous déjà reçu un avis de taxation pour {year} ?", "Have you already received a notice of assessment for {year}?", "Haben Sie für {year} bereits eine Veranlagungsverfügung erhalten?"), {
      help: t("Par exemple une taxation d'office. Le délai pour la contester est court.", "For example an assessment made without a return. The deadline to contest it is short.", "Zum Beispiel eine Ermessensveranlagung. Die Frist für eine Einsprache ist kurz."),
    }),
    f("start.avisDate", "date", t("Date à laquelle vous avez reçu l'avis (conservez l'enveloppe)", "Date you received the notice (keep the envelope)", "Datum des Erhalts der Verfügung (Umschlag aufbewahren)"), { width: "half", required: true, showIf: yes("start.avisReceived") }),
  ],
};

const regime: StepDef = {
  id: "regime",
  title: t("Votre situation fiscale", "Your tax situation", "Ihre Steuersituation"),
  intro: t("Ces réponses déterminent le type d'imposition et les questions suivantes.", "These answers determine how you are taxed and which questions follow.", "Diese Antworten bestimmen die Besteuerungsart und die folgenden Fragen."),
  sheet: "Régime",
  blocks: [
    f("regime.residence", "radio", t("Où habitiez-vous en {year} ?", "Where did you live in {year}?", "Wo wohnten Sie im Jahr {year}?"), {
      required: true,
      help: t(
        "Si vous vivez en Suisse la semaine et ailleurs le week-end (par exemple famille à l'étranger), choisissez la réponse la plus proche et indiquez-le dans les remarques : nous déterminerons avec vous votre résidence fiscale.",
        "If you live in Switzerland during the week and elsewhere at weekends (for example family abroad), choose the closest answer and say so in the remarks: we will determine your tax residence with you.",
        "Wenn Sie unter der Woche in der Schweiz und am Wochenende anderswo leben (z. B. Familie im Ausland), wählen Sie die passendste Antwort und vermerken Sie es in den Bemerkungen: Wir klären Ihre steuerliche Ansässigkeit mit Ihnen.",
      ),
      options: opts(
        ["ch", "En Suisse toute l'année", "In Switzerland all year", "Das ganze Jahr in der Schweiz"],
        ["arrived", "Arrivé(e) en Suisse en cours d'année", "Moved to Switzerland during the year", "Im Laufe des Jahres in die Schweiz gezogen"],
        ["left", "Parti(e) de Suisse en cours d'année", "Left Switzerland during the year", "Im Laufe des Jahres aus der Schweiz weggezogen"],
        ["both", "Arrivé(e) puis parti(e)", "Arrived and left", "Zu- und weggezogen"],
        ["abroad", "À l'étranger toute l'année", "Abroad all year", "Das ganze Jahr im Ausland"],
      ),
    }),
    f("regime.arrivalDate", "date", t("Date d'arrivée (approximative si besoin)", "Arrival date (approximate if needed)", "Zuzugsdatum (wenn nötig ungefähr)"), { width: "half", required: true, showIf: arrived }),
    f("regime.arrivalFrom", "text", t("Pays de résidence fiscale avant l'arrivée", "Country of tax residence before arrival", "Steuerlicher Wohnsitzstaat vor dem Zuzug"), { width: "half", showIf: arrived }),
    f("regime.exitFiled", "radio", t("Une déclaration de départ a-t-elle été faite dans ce pays ?", "Was a departure (exit) return filed in that country?", "Wurde in diesem Land eine Wegzugserklärung eingereicht?"), { options: YES_NO_UNKNOWN, showIf: arrived }),
    f("regime.departureDate", "date", t("Date de départ", "Departure date", "Wegzugsdatum"), { width: "half", required: true, showIf: left }),
    f("regime.departureTo", "text", t("Nouveau pays de domicile", "New country of residence", "Neuer Wohnsitzstaat"), { width: "half", showIf: left }),
    f("regime.keepsInSwitzerland", "checkboxes", t("Après votre départ, gardez-vous en Suisse…", "After leaving, do you keep in Switzerland…", "Behalten Sie nach dem Wegzug in der Schweiz…"), {
      showIf: left,
      options: opts(
        ["property", "un bien immobilier", "real estate", "eine Liegenschaft"],
        ["pension", "des avoirs de prévoyance (2e/3e pilier)", "pension assets (2nd/3rd pillar)", "Vorsorgeguthaben (2./3. Säule)"],
        ["accounts", "des comptes bancaires", "bank accounts", "Bankkonten"],
        ["none", "rien de cela", "none of these", "nichts davon"],
      ),
    }),
    f("regime.cantonMove", "yesno", t("Avez-vous changé de canton en {year} ?", "Did you move to another canton in {year}?", "Sind Sie im Jahr {year} in einen anderen Kanton gezogen?"), { width: "half", showIf: (a) => ["ch", "arrived"].includes(residence(a)) }),
    f("regime.fromCanton", "select", t("Canton précédent", "Previous canton", "Früherer Kanton"), { width: "half", options: CANTONS, required: true, showIf: yes("regime.cantonMove") }),
    f("regime.cantonMoveDate", "date", t("Date du déménagement", "Moving date", "Umzugsdatum"), { width: "half", showIf: yes("regime.cantonMove") }),
    f("regime.country", "text", t("Pays de domicile", "Country of residence", "Wohnsitzstaat"), { width: "half", required: true, showIf: livesAbroadAllYear }),
    f("regime.nrReasons", "checkboxes", t("Pourquoi êtes-vous concerné(e) par l'impôt suisse ?", "Why does Swiss tax concern you?", "Weshalb betrifft Sie die Schweizer Steuer?"), {
      required: true,
      showIf: livesAbroadAllYear,
      options: opts(
        ["work", "Je travaille en Suisse (frontalier ou autre)", "I work in Switzerland (cross-border or other)", "Ich arbeite in der Schweiz (Grenzgänger/in oder anders)"],
        ["property", "Je possède un bien immobilier en Suisse", "I own real estate in Switzerland", "Ich besitze eine Liegenschaft in der Schweiz"],
        ["business", "J'ai une activité ou un établissement en Suisse", "I have a business or establishment in Switzerland", "Ich habe ein Geschäft oder eine Betriebsstätte in der Schweiz"],
        ["board", "Je siège au conseil d'une société suisse", "I sit on the board of a Swiss company", "Ich bin Verwaltungsrat einer Schweizer Gesellschaft"],
        ["pension", "Je reçois une rente ou un capital de Suisse", "I receive a Swiss pension or lump sum", "Ich erhalte eine Rente oder Kapitalleistung aus der Schweiz"],
        ["other", "Autre", "Other", "Andere"],
      ),
    }),
    f("regime.workCanton", "select", t("Canton de travail", "Canton where you work", "Arbeitskanton"), { width: "half", options: CANTONS, required: true, showIf: worksInSwitzerlandFromAbroad }),
    f("regime.dailyReturn", "yesno", t("Rentrez-vous en principe chaque jour à votre domicile ?", "Do you normally return home every day?", "Kehren Sie in der Regel täglich nach Hause zurück?"), { width: "half", showIf: worksInSwitzerlandFromAbroad }),
    f("regime.homeOfficeAbroad", "percent", t("Part de télétravail depuis votre domicile à l'étranger (%)", "Share of work from your home abroad (%)", "Anteil Homeoffice im Wohnsitzstaat (%)"), { width: "half", showIf: worksInSwitzerlandFromAbroad }),
    f("regime.spouseWorksCH", "radio", t("Votre conjoint travaille-t-il en Suisse ?", "Does your spouse work in Switzerland?", "Arbeitet Ihr Ehegatte in der Schweiz?"), {
      showIf: (a) => isCouple(a) && livesAbroadAllYear(a),
      options: opts(["yes", "Oui", "Yes", "Ja"], ["no", "Non, ailleurs ou sans activité", "No, elsewhere or not working", "Nein, anderswo oder nicht erwerbstätig"], ["unknown", "Je ne sais pas", "I don't know", "Weiss nicht"]),
    }),
    f("regime.lumpSum", "yesno", t("Avez-vous un accord avec le canton pour être imposé(e) d'après vos dépenses (forfait fiscal) ?", "Do you have an agreement with the canton to be taxed on your expenditure (lump-sum taxation)?", "Haben Sie mit dem Kanton eine Besteuerung nach dem Aufwand (Pauschalbesteuerung) vereinbart?"), {
      required: true,
      showIf: residentPartOfYear,
    }),
    f("regime.swissNational", "yesno", t("Avez-vous (vous ou votre conjoint) la nationalité suisse ?", "Do you (or your spouse) have Swiss nationality?", "Haben Sie (oder Ihr Ehegatte) die Schweizer Staatsangehörigkeit?"), { width: "half", showIf: isLumpSum }),
    f("regime.gainfulCH", "yesno", t("Exercez-vous une activité lucrative en Suisse ?", "Do you work (gainful activity) in Switzerland?", "Üben Sie in der Schweiz eine Erwerbstätigkeit aus?"), { width: "half", showIf: isLumpSum }),
    f("regime.sourceTax", "radio", t("Un impôt à la source a-t-il été retenu sur votre salaire (ou celui de votre conjoint) ?", "Was tax withheld at source from your salary (or your spouse's)?", "Wurde auf Ihrem Lohn (oder dem Ihres Ehegatten) Quellensteuer abgezogen?"), {
      required: true,
      showIf: (a) => !!residence(a) && !isLumpSum(a) && (!livesAbroadAllYear(a) || worksInSwitzerlandFromAbroad(a) || nonResidentReasons(a).includes("board")),
      options: YES_NO_UNKNOWN,
      help: t("Visible sur la fiche de salaire (« impôt à la source »).", "Shown on your payslip (\"tax at source\").", "Auf der Lohnabrechnung ersichtlich («Quellensteuer»)."),
    }),
    f("regime.permit", "select", t("Votre permis", "Your permit", "Ihr Ausweis"), { width: "half", options: PERMITS, showIf: (a) => sourceTaxedResident(a) || arrived(a) }),
    f("regime.employerCanton", "select", t("Canton de l'employeur", "Employer's canton", "Kanton des Arbeitgebers"), { width: "half", options: CANTONS, showIf: sourceTaxedResident }),
    f("regime.sourceRequest", "radio", t("Que souhaitez-vous ?", "What would you like?", "Was möchten Sie?"), {
      showIf: sourceTaxed,
      options: [
        { value: "tariff", label: t("Faire vérifier le barème appliqué (rectification)", "Have the tariff applied checked (correction)", "Den angewandten Tarif prüfen lassen (Berichtigung)"), hint: t("Ne donne pas droit à des déductions supplémentaires.", "Does not give additional deductions.", "Ergibt keine zusätzlichen Abzüge.") },
        { value: "tou", label: t("Déposer une déclaration complète (TOU)", "File a full return (TOU)", "Eine vollständige Steuererklärung einreichen (NOV)"), hint: t("Domicile en Suisse : choix irrévocable, qui s'applique tant que vous restez imposé(e) à la source. Domicile à l'étranger : demande à renouveler chaque année.", "Resident in Switzerland: an irrevocable choice that applies as long as you remain taxed at source. Resident abroad: the request must be renewed every year.", "Wohnsitz in der Schweiz: unwiderruflich, gilt solange Sie quellenbesteuert sind. Wohnsitz im Ausland: Antrag jedes Jahr neu stellen.") },
        { value: "advise", label: t("Je ne sais pas, conseillez-moi", "I don't know, please advise", "Ich weiss es nicht, bitte beraten Sie mich") },
      ],
    }),
    f("regime.over120k", "radio", t("Le salaire brut annuel (vous ou votre conjoint) a-t-il atteint CHF 120'000 en {year} ou une année précédente ?", "Did the gross annual salary (yours or your spouse's) reach CHF 120,000 in {year} or an earlier year?", "Hat der Bruttojahreslohn (Ihrer oder der Ihres Ehegatten) im Jahr {year} oder früher CHF 120'000 erreicht?"), {
      options: YES_NO_UNKNOWN,
      showIf: sourceTaxedResident,
      help: t(
        "Pour une personne domiciliée en Suisse, une déclaration est obligatoire dès que le salaire brut annuel de l'un des conjoints atteint ce montant (les salaires ne s'additionnent pas ; ils sont annualisés en cas d'année incomplète).",
        "For a person resident in Switzerland, a return is mandatory once either spouse's gross annual salary reaches this amount (salaries are not added together; they are annualised for a partial year).",
        "Für in der Schweiz wohnhafte Personen ist eine Steuererklärung obligatorisch, sobald der Bruttojahreslohn eines Ehegatten diesen Betrag erreicht (Löhne werden nicht addiert; bei unvollständigem Jahr hochgerechnet).",
      ),
    }),
    f("regime.foreignHouseholdIncome", "radio", t("Avez-vous (vous ou votre conjoint) d'autres revenus hors de Suisse (loyers, rentes, salaire du conjoint…) ?", "Do you (or your spouse) have other income outside Switzerland (rents, pensions, spouse's salary…)?", "Haben Sie (oder Ihr Ehegatte) weitere Einkünfte ausserhalb der Schweiz (Mieten, Renten, Lohn des Ehegatten…)?"), {
      options: YES_NO_UNKNOWN,
      showIf: worksInSwitzerlandFromAbroad,
    }),
    note(
      "regime.touDeadline",
      t(
        "Pour une demande de taxation ordinaire ultérieure ou de rectification de l'imposition à la source, le délai est en principe le 31 mars de l'année suivante et ne se prolonge pas. En cas de départ de Suisse, la demande doit être déposée au plus tard au moment de l'annonce de votre départ. Si une de ces dates approche, appelez-nous.",
        "For a request for subsequent ordinary assessment or rectification of the tax at source, the deadline is in principle 31 March of the following year and cannot be extended. When leaving Switzerland, the request must be filed at the latest when you deregister. If one of these dates is near, call us.",
        "Für einen Antrag auf nachträgliche ordentliche Veranlagung oder Berichtigung der Quellensteuer gilt grundsätzlich der 31. März des Folgejahres, ohne Erstreckung. Bei Wegzug muss der Antrag spätestens mit der Abmeldung gestellt werden. Rufen Sie uns an, wenn eine dieser Fristen naht.",
      ),
      { tone: "warning", showIf: sourceTaxed },
    ),
    note(
      "regime.mandateNote",
      t(
        "Important : ce questionnaire ne vaut pas demande. Le délai n'est préservé qu'une fois que nous avons confirmé le mandat et déposé la demande pour vous.",
        "Important: this questionnaire is not a request. The deadline is only preserved once we have confirmed the engagement and filed the request for you.",
        "Wichtig: Dieser Fragebogen gilt nicht als Antrag. Die Frist ist erst gewahrt, wenn wir das Mandat bestätigt und den Antrag für Sie eingereicht haben.",
      ),
      { tone: "warning", showIf: sourceTaxed },
    ),
    f("regime.confession", "select", t("Appartenance religieuse (impôt ecclésiastique)", "Religious affiliation (church tax)", "Konfession (Kirchensteuer)"), {
      width: "half",
      showIf: asksChurchTax,
      options: CONFESSION,
      help: t("Demandé uniquement parce que votre canton perçoit un impôt ecclésiastique.", "Asked only because your canton levies a church tax.", "Nur gefragt, weil Ihr Kanton eine Kirchensteuer erhebt."),
    }),
    f("regime.spouseConfession", "select", t("Appartenance religieuse du conjoint", "Spouse's religious affiliation", "Konfession des Ehegatten"), {
      width: "half",
      showIf: (a) => isCouple(a) && asksChurchTax(a),
      options: CONFESSION,
    }),
  ],
};

const baseDocs: StepDef = {
  id: "baseDocs",
  title: t("Vos documents de base", "Your key documents", "Ihre wichtigsten Dokumente"),
  intro: t(
    "Ces documents nous évitent de vous poser la plupart des questions. Déposez ce que vous avez sous la main ; le reste pourra suivre.",
    "These documents spare you most of the questions. Upload what you have at hand; the rest can follow.",
    "Mit diesen Dokumenten ersparen wir Ihnen die meisten Fragen. Laden Sie hoch, was Sie zur Hand haben; der Rest kann folgen.",
  ),
  sheet: "Documents de base",
  special: "baseDocs",
  // Renewal: the screen is skipped by the app (Ark has last year's file) but stays "visible" so
  // its hidden fields (pre-fill marker, taxpayer number) are kept.
  showIf: (a) => previouslyTaxed(a) || arrived(a) || !!a["regime.permit"],
  blocks: [
    f("base.lastReturnUploaded", "yesno", t("Dernière déclaration déposée", "Last return uploaded", "Letzte Steuererklärung hochgeladen"), { hidden: true }),
    f("base.prefilledFrom", "text", t("Prérempli depuis", "Pre-filled from", "Vorausgefüllt aus"), { hidden: true, maxLength: 40 }),
    f("base.taxNumber", "text", t("N° de contribuable (si vous l'avez)", "Taxpayer number (if you have it)", "Steuernummer (falls vorhanden)"), { width: "half", maxLength: 40, showIf: previouslyTaxed }),
  ],
};

const router: StepDef = {
  id: "router",
  title: t("Qu'est-ce qui vous concerne en {year} ?", "What applies to you in {year}?", "Was trifft im Jahr {year} auf Sie zu?"),
  intro: t(
    "Cochez tout ce qui vous concerne, vous ou votre conjoint. Nous ne poserons ensuite que les questions utiles.",
    "Tick everything that applies to you or your spouse. We will then only ask what is needed.",
    "Kreuzen Sie alles an, was Sie oder Ihren Ehegatten betrifft. Danach fragen wir nur noch das Nötige.",
  ),
  sheet: "Situation",
  blocks: [
    f("router.items", "checkboxes", t("Ma situation en {year}", "My situation in {year}", "Meine Situation im Jahr {year}"), { options: ROUTER_OPTIONS }),
    // Renewal: groups confirmed "everything as last year, nothing new" (comma-separated group ids).
    f("router.sameAs", "textarea", t("Identique à l'an dernier", "Same as last year", "Wie im Vorjahr"), { hidden: true, maxLength: 600 }),
  ],
};

// ---- detail screens -------------------------------------------------------------------------------

const family: StepDef = {
  id: "family",
  title: t("Famille", "Family", "Familie"),
  sheet: "Famille",
  showIf: hasAny("civilChange", "children", "childcare", "dependants", "alimonyPaid", "alimonyReceived"),
  blocks: [
    f("family.changeType", "select", t("Quel changement ?", "What change?", "Welche Änderung?"), {
      required: true,
      width: "half",
      showIf: has("civilChange"),
      options: opts(
        ["marriage", "Mariage / partenariat", "Marriage / partnership", "Heirat / Partnerschaft"],
        ["separation", "Séparation", "Separation", "Trennung"],
        ["divorce", "Divorce", "Divorce", "Scheidung"],
        ["death", "Décès du conjoint", "Death of spouse", "Tod des Ehegatten"],
        ["reconciliation", "Reprise de la vie commune", "Living together again", "Wiederaufnahme des Zusammenlebens"],
      ),
    }),
    f("family.changeDate", "date", t("Date", "Date", "Datum"), { required: true, width: "half", showIf: has("civilChange") }),
    group({
      id: "family.children",
      label: t("Enfants", "Children", "Kinder"),
      itemLabel: t("Enfant", "Child", "Kind"),
      titleField: "firstName",
      showIf: hasAny("children", "childcare"),
      minRows: 1,
      maxRows: 10,
      fields: [
        f("firstName", "text", t("Prénom", "First name", "Vorname"), { required: true, width: "half", maxLength: 60 }),
        f("birthYear", "integer", t("Année de naissance", "Year of birth", "Geburtsjahr"), { required: true, width: "half" }),
        f("activity", "select", t("En {year}", "In {year}", "Im Jahr {year}"), {
          width: "half",
          options: opts(
            ["preschool", "Pas encore à l'école", "Not yet at school", "Noch nicht in der Schule"],
            ["school", "École", "School", "Schule"],
            ["apprenticeship", "Apprentissage", "Apprenticeship", "Lehre"],
            ["studies", "Études", "Studies", "Studium"],
            ["working", "Travaille", "Working", "Erwerbstätig"],
          ),
        }),
        f("custody", "select", t("Vit avec", "Lives with", "Lebt bei"), {
          width: "half",
          options: opts(
            ["us", "Nous / moi", "Us / me", "Uns / mir"],
            ["alternating", "Garde alternée", "Alternating custody", "Alternierende Obhut"],
            ["otherParent", "L'autre parent", "The other parent", "Dem anderen Elternteil"],
            ["elsewhere", "Ailleurs (études…)", "Elsewhere (studies…)", "Anderswo (Studium…)"],
          ),
        }),
        f("claimedBy", "select", t("Qui déclare cet enfant ?", "Who claims this child?", "Wer macht das Kind geltend?"), {
          width: "half",
          showIf: (a) => !isCouple(a),
          options: opts(["me", "Moi", "Me", "Ich"], ["otherParent", "L'autre parent", "The other parent", "Der andere Elternteil"], ["shared", "Partagé (garde alternée)", "Shared (alternating custody)", "Geteilt (alternierende Obhut)"], ["unknown", "Je ne sais pas", "I don't know", "Weiss nicht"]),
        }),
        f("childcare", "yesno", t("Frais de garde par des tiers ?", "Third-party childcare costs?", "Drittbetreuungskosten?"), { width: "half", showIf: has("childcare") }),
      ],
    }),
    group({
      id: "family.dependants",
      label: t("Personnes à charge", "Dependants", "Unterstützte Personen"),
      itemLabel: t("Personne", "Person", "Person"),
      titleField: "name",
      showIf: has("dependants"),
      minRows: 1,
      maxRows: 5,
      fields: [
        f("name", "text", t("Nom", "Name", "Name"), { required: true, width: "half" }),
        f("relation", "text", t("Lien (mère, frère…)", "Relationship (mother, brother…)", "Beziehung (Mutter, Bruder…)"), { width: "half" }),
        f("country", "text", t("Pays de résidence", "Country of residence", "Wohnsitzstaat"), { width: "half" }),
        f("support", "money", t("Soutien versé en {year} (CHF)", "Support paid in {year} (CHF)", "Geleistete Unterstützung {year} (CHF)"), { width: "half" }),
      ],
    }),
    group({
      id: "family.alimony",
      label: t("Pensions alimentaires", "Maintenance payments", "Unterhaltsbeiträge"),
      itemLabel: t("Pension", "Maintenance", "Unterhalt"),
      titleField: "counterparty",
      showIf: hasAny("alimonyPaid", "alimonyReceived"),
      minRows: 1,
      maxRows: 5,
      fields: [
        f("direction", "select", t("Versée ou reçue", "Paid or received", "Bezahlt oder erhalten"), {
          required: true,
          width: "half",
          options: opts(["paid", "Versée", "Paid", "Bezahlt"], ["received", "Reçue", "Received", "Erhalten"]),
        }),
        f("forWhom", "select", t("Pour", "For", "Für"), {
          required: true,
          width: "half",
          options: opts(
            ["exSpouse", "L'ex-conjoint / le conjoint séparé", "Former / separated spouse", "Ex- / getrennten Ehegatten"],
            ["minor", "Un enfant mineur", "A minor child", "Ein minderjähriges Kind"],
            ["adult", "Un enfant majeur", "An adult child", "Ein volljähriges Kind"],
          ),
        }),
        f("counterparty", "text", t("Nom du bénéficiaire / débiteur", "Name of recipient / payer", "Name Empfänger(in) / Zahler(in)"), { width: "half" }),
      ],
    }),
  ],
};

const work: StepDef = {
  id: "work",
  title: t("Travail et revenus", "Work and income", "Arbeit und Einkommen"),
  sheet: "Travail et revenus",
  showIf: hasAny("employed", "equity", "selfEmployed", "companyOwner", "swissBusiness", "benefits", "pension", "capital", "severance", "foreignIncome"),
  blocks: [
    group({
      id: "work.employers",
      label: t("Employeurs en {year}", "Employers in {year}", "Arbeitgeber im Jahr {year}"),
      help: t("Pour savoir quels certificats de salaire attendre.", "So we know which salary certificates to expect.", "Damit wir wissen, welche Lohnausweise zu erwarten sind."),
      itemLabel: t("Employeur", "Employer", "Arbeitgeber"),
      titleField: "name",
      showIf: has("employed"),
      minRows: 1,
      maxRows: 8,
      fields: [f("name", "text", t("Employeur", "Employer", "Arbeitgeber"), { required: true, width: "half" }), whose(), f("country", "text", t("Pays (si hors de Suisse)", "Country (if outside Switzerland)", "Land (falls ausserhalb der Schweiz)"), { width: "half" })],
    }),
    f("work.actualCosts", "yesno", t("Avez-vous des frais professionnels importants (long trajet, repas, formation non remboursée…) ?", "Do you have significant work expenses (long commute, meals, unreimbursed training…)?", "Haben Sie bedeutende Berufskosten (langer Arbeitsweg, Verpflegung, nicht erstattete Weiterbildung…)?"), {
      showIf: (a) => has("employed")(a) && !livesAbroadAllYear(a),
      help: t("Sinon, le forfait s'applique pour les autres frais ; nous examinerons tout de même le trajet et les repas.", "Otherwise the flat rate applies to other expenses; we will still look at commuting and meals.", "Sonst gilt für übrige Kosten die Pauschale; Arbeitsweg und Verpflegung prüfen wir trotzdem."),
    }),
    f("work.commuteKm", "integer", t("Distance domicile – travail (km, aller)", "Home – work distance (km, one way)", "Distanz Wohnort – Arbeitsort (km, einfach)"), { width: "half", showIf: yes("work.actualCosts") }),
    f("work.transport", "checkboxes", t("Moyen de transport", "Means of transport", "Verkehrsmittel"), {
      showIf: yes("work.actualCosts"),
      options: opts(
        ["public", "Transports publics", "Public transport", "Öffentlicher Verkehr"],
        ["car", "Voiture ou moto privée", "Private car or motorbike", "Privatauto oder Motorrad"],
        ["bike", "Vélo / à pied", "Bicycle / on foot", "Velo / zu Fuss"],
        ["companyCar", "Voiture de service", "Company car", "Geschäftsauto"],
      ),
    }),
    f("work.homeOffice", "select", t("Télétravail", "Working from home", "Homeoffice"), {
      width: "half",
      showIf: yes("work.actualCosts"),
      options: opts(["none", "Jamais ou rarement", "Never or rarely", "Nie oder selten"], ["partial", "1 à 2 jours par semaine", "1–2 days a week", "1–2 Tage pro Woche"], ["mostly", "3 jours ou plus", "3 days or more", "3 Tage oder mehr"]),
    }),
    f("work.expat", "radio", t("Êtes-vous détaché(e) temporairement en Suisse par un employeur étranger (expatrié) ?", "Are you temporarily seconded to Switzerland by a foreign employer (expatriate)?", "Sind Sie von einem ausländischen Arbeitgeber vorübergehend in die Schweiz entsandt (Expatriate)?"), {
      options: YES_NO_UNKNOWN,
      showIf: (a) => has("employed")(a) && (arrived(a) || !!a["regime.permit"]),
    }),
    f("work.daysAbroad", "integer", t("Jours de travail physiquement hors de Suisse en {year} (environ)", "Working days physically outside Switzerland in {year} (approx.)", "Arbeitstage physisch ausserhalb der Schweiz {year} (ca.)"), {
      width: "half",
      showIf: (a) => (has("employed")(a) && (livesAbroadAllYear(a) || rowsOf(a, "work.employers").some((r) => !!str(r.country) && !/^(ch|suisse|switzerland|schweiz)$/i.test(str(r.country))))) || has("equity")(a),
    }),
    f("work.boardFees", "yesno", t("Honoraires d'administrateur ou jetons de présence ?", "Director's or board fees?", "Verwaltungsratshonorare oder Sitzungsgelder?"), { width: "half", showIf: hasAny("employed", "companyOwner") }),
    heading("work.equityHeading", t("Plans d'actions de l'employeur", "Employer equity plans", "Mitarbeiterbeteiligungen"), has("equity")),
    f("work.equityEvents", "checkboxes", t("En {year}, avez-vous eu…", "In {year}, did you have…", "Hatten Sie im Jahr {year}…"), {
      showIf: has("equity"),
      options: opts(
        ["vest", "des actions ou unités acquises (vesting)", "shares or units vesting", "Vesting von Aktien oder Einheiten"],
        ["exercise", "des options exercées", "options exercised", "ausgeübte Optionen"],
        ["purchase", "des actions achetées à prix réduit (ESPP)", "shares bought at a discount (ESPP)", "verbilligt gekaufte Aktien (ESPP)"],
        ["sale", "des actions vendues", "shares sold", "verkaufte Aktien"],
        ["cash", "un paiement en espèces (SAR, actions fictives)", "a cash payment (SAR, phantom shares)", "eine Barauszahlung (SAR, Phantom Shares)"],
        ["none", "rien de cela (droits non acquis seulement)", "none of these (unvested awards only)", "nichts davon (nur nicht gevestete Rechte)"],
      ),
    }),
    f("work.equityAbroad", "radio", t("Avez-vous travaillé hors de Suisse entre l'attribution et l'acquisition de ces droits ?", "Did you work outside Switzerland between grant and vesting?", "Haben Sie zwischen Zuteilung und Vesting ausserhalb der Schweiz gearbeitet?"), { options: YES_NO_UNKNOWN, showIf: has("equity") }),
    heading("work.selfHeading", t("Activité indépendante", "Self-employment", "Selbständige Tätigkeit"), hasAny("selfEmployed", "swissBusiness")),
    f("work.selfActivity", "text", t("Activité", "Activity", "Tätigkeit"), { width: "half", required: true, showIf: hasAny("selfEmployed", "swissBusiness") }),
    f("work.selfStarted", "yesno", t("Activité commencée en {year} ?", "Activity started in {year}?", "Tätigkeit im Jahr {year} begonnen?"), { width: "half", showIf: hasAny("selfEmployed", "swissBusiness") }),
    f("work.selfForm", "select", t("Forme", "Legal form", "Rechtsform"), {
      width: "half",
      showIf: hasAny("selfEmployed", "swissBusiness"),
      options: opts(["sole", "Raison individuelle", "Sole proprietorship", "Einzelunternehmen"], ["simple", "Société simple / de personnes", "Simple / general partnership", "Einfache / Kollektivgesellschaft"], ["other", "Autre", "Other", "Andere"]),
    }),
    f("work.selfBooks", "select", t("Qui tient la comptabilité ?", "Who keeps the books?", "Wer führt die Buchhaltung?"), {
      width: "half",
      showIf: hasAny("selfEmployed", "swissBusiness"),
      options: opts(["self", "Moi-même", "Myself", "Ich selbst"], ["accountant", "Un comptable / une fiduciaire", "An accountant", "Ein(e) Buchhalter(in) / Treuhand"], ["ark", "Ark Fiduciaire", "Ark Fiduciaire", "Ark Fiduciaire"], ["none", "Personne pour l'instant", "Nobody yet", "Noch niemand"]),
    }),
    f("work.selfFiscalYear", "select", t("Exercice comptable", "Financial year", "Geschäftsjahr"), {
      width: "half",
      showIf: hasAny("selfEmployed", "swissBusiness"),
      options: opts(["calendar", "Année civile", "Calendar year", "Kalenderjahr"], ["other", "Autre période", "Other period", "Andere Periode"]),
    }),
    f("work.selfVat", "yesno", t("Assujetti(e) à la TVA ?", "Registered for VAT?", "MWST-pflichtig?"), { width: "half", showIf: hasAny("selfEmployed", "swissBusiness") }),
    f("work.selfAvs", "yesno", t("Affilié(e) à l'AVS comme indépendant(e) ?", "Registered with AHV as self-employed?", "Bei der AHV als selbständig angeschlossen?"), { width: "half", showIf: has("selfEmployed") }),
    group({
      id: "work.companies",
      label: t("Sociétés", "Companies", "Gesellschaften"),
      itemLabel: t("Société", "Company", "Gesellschaft"),
      titleField: "name",
      showIf: has("companyOwner"),
      minRows: 1,
      maxRows: 6,
      fields: [
        f("name", "text", t("Nom de la société", "Company name", "Firma"), { required: true, width: "half" }),
        f("share", "percent", t("Participation (%)", "Holding (%)", "Beteiligung (%)"), { width: "half" }),
        f("dividend", "yesno", t("Dividende reçu en {year} ?", "Dividend received in {year}?", "Dividende im Jahr {year} erhalten?"), { width: "half" }),
        f("loan", "select", t("Prêt ou compte courant avec la société", "Loan or current account with the company", "Darlehen oder Kontokorrent mit der Gesellschaft"), {
          width: "half",
          options: opts(["none", "Aucun", "None", "Keines"], ["toCompany", "J'ai prêté à la société", "I lent to the company", "Ich habe der Gesellschaft geliehen"], ["fromCompany", "La société m'a prêté", "The company lent to me", "Die Gesellschaft hat mir geliehen"]),
        }),
        f("privateExpenses", "yesno", t("La société paie-t-elle des frais privés pour vous (voiture, logement…) ?", "Does the company pay private costs for you (car, home…)?", "Bezahlt die Gesellschaft private Kosten für Sie (Auto, Wohnung…)?"), { width: "half" }),
        f("holdsProperty", "yesno", t("La société détient-elle un bien que vous utilisez ?", "Does the company own property you use?", "Besitzt die Gesellschaft eine Liegenschaft, die Sie nutzen?"), { width: "half" }),
      ],
    }),
    f("work.benefitTypes", "checkboxes", t("Indemnités reçues", "Allowances received", "Erhaltene Taggelder"), {
      showIf: has("benefits"),
      options: opts(
        ["unemployment", "Chômage", "Unemployment", "Arbeitslosigkeit"],
        ["sickness", "Maladie / accident (versées par l'assurance)", "Sickness / accident (paid by the insurer)", "Krankheit / Unfall (von der Versicherung)"],
        ["maternity", "Maternité / paternité", "Maternity / paternity", "Mutterschaft / Vaterschaft"],
        ["eo", "APG (service militaire, civil)", "EO (military, civilian service)", "EO (Militär-, Zivildienst)"],
        ["ai", "AI", "Disability insurance (IV)", "IV"],
      ),
    }),
    group({
      id: "work.pensions",
      label: t("Rentes", "Pensions", "Renten"),
      itemLabel: t("Rente", "Pension", "Rente"),
      titleField: "payer",
      showIf: has("pension"),
      minRows: 1,
      maxRows: 6,
      fields: [
        f("type", "select", t("Type", "Type", "Art"), {
          required: true,
          width: "half",
          options: opts(
            ["avs", "AVS / AI", "AHV / IV", "AHV / IV"],
            ["lpp", "Caisse de pension (2e pilier)", "Pension fund (2nd pillar)", "Pensionskasse (2. Säule)"],
            ["foreign", "Rente étrangère", "Foreign pension", "Ausländische Rente"],
            ["annuity", "Rente viagère / d'assurance", "Life / insurance annuity", "Leib- / Versicherungsrente"],
          ),
        }),
        f("payer", "text", t("Caisse ou organisme", "Fund or payer", "Kasse oder Zahlstelle"), { width: "half" }),
        f("country", "text", t("Pays (si étranger)", "Country (if foreign)", "Land (falls Ausland)"), { width: "half", showIf: rowIs("type", "foreign", "annuity") }),
        whose(),
      ],
    }),
    group({
      id: "work.capital",
      label: t("Capitaux reçus", "Lump sums received", "Erhaltene Kapitalleistungen"),
      itemLabel: t("Capital", "Lump sum", "Kapital"),
      titleField: "institution",
      showIf: has("capital"),
      minRows: 1,
      maxRows: 6,
      fields: [
        f("type", "select", t("Type", "Type", "Art"), {
          required: true,
          width: "half",
          options: opts(
            ["lpp", "2e pilier / libre passage", "2nd pillar / vested benefits", "2. Säule / Freizügigkeit"],
            ["p3a", "3e pilier A", "Pillar 3a", "Säule 3a"],
            ["insurance", "Assurance-vie", "Life insurance", "Lebensversicherung"],
          ),
        }),
        f("institution", "text", t("Institution", "Institution", "Einrichtung"), { required: true, width: "half" }),
        f("reason", "select", t("Motif", "Reason", "Grund"), {
          width: "half",
          showIf: rowIs("type", "lpp", "p3a"),
          options: opts(
            ["retirement", "Retraite", "Retirement", "Pensionierung"],
            ["home", "Logement (achat, amortissement)", "Home (purchase, repayment)", "Wohneigentum"],
            ["departure", "Départ de Suisse", "Leaving Switzerland", "Ausreise"],
            ["selfEmployment", "Activité indépendante", "Self-employment", "Selbständigkeit"],
            ["other", "Autre", "Other", "Andere"],
          ),
        }),
        whose(),
      ],
    }),
    f("work.severanceEmployer", "text", t("Employeur ayant versé l'indemnité de départ", "Employer who paid the severance", "Arbeitgeber, der die Abgangsentschädigung bezahlt hat"), { width: "half", showIf: has("severance") }),
    group({
      id: "work.foreignIncome",
      label: t("Revenus de l'étranger", "Foreign income", "Ausländische Einkünfte"),
      help: t("Hors salaires, rentes, comptes et immeubles déjà indiqués.", "Other than salaries, pensions, accounts and property already given.", "Ohne bereits erfasste Löhne, Renten, Konten und Liegenschaften."),
      itemLabel: t("Revenu", "Income", "Einkunft"),
      titleField: "country",
      showIf: has("foreignIncome"),
      minRows: 1,
      maxRows: 6,
      fields: [
        f("country", "text", t("Pays", "Country", "Land"), { required: true, width: "half" }),
        f("nature", "text", t("Nature", "Type", "Art"), { required: true, width: "half" }),
      ],
    }),
  ],
};


const assets: StepDef = {
  id: "assets",
  title: t("Comptes, placements et dettes", "Accounts, investments and debts", "Konten, Anlagen und Schulden"),
  intro: t("Indiquez seulement les noms : les soldes et revenus figurent sur les relevés.", "Just give the names: balances and income are on the statements.", "Nur die Namen: Saldi und Erträge stehen auf den Auszügen."),
  sheet: "Fortune et dettes",
  showIf: hasAny("banksCH", "banksForeign", "securities", "crypto", "lifeInsurance", "vehicles", "valuables", "loansGiven", "debts"),
  blocks: [
    group({
      id: "assets.banks",
      label: t("Banques et dépôts", "Banks and portfolios", "Banken und Depots"),
      itemLabel: t("Banque", "Bank", "Bank"),
      titleField: "bank",
      showIf: hasAny("banksCH", "banksForeign", "securities"),
      minRows: 1,
      maxRows: 20,
      fields: [
        f("bank", "text", t("Banque / courtier", "Bank / broker", "Bank / Broker"), { required: true, width: "half" }),
        f("country", "select", t("Pays", "Country", "Land"), {
          width: "half",
          options: opts(["CH", "Suisse", "Switzerland", "Schweiz"], ["other", "Autre pays", "Other country", "Anderes Land"]),
        }),
        f("countryName", "text", t("Lequel ?", "Which?", "Welches?"), { width: "half", showIf: rowIs("country", "other") }),
        f("securities", "yesno", t("Dépôt de titres ?", "Securities portfolio?", "Wertschriftendepot?"), { width: "half" }),
        f("statement", "radio", t("La banque fournit-elle un relevé fiscal annuel ?", "Does the bank provide an annual tax statement?", "Liefert die Bank einen jährlichen Steuerauszug?"), { options: YES_NO_UNKNOWN, showIf: rowIs("country", "other") }),
        f("balance", "money", t("Solde au 31.12 (si pas de relevé)", "Balance at 31.12 (if no statement)", "Saldo am 31.12. (falls kein Auszug)"), { width: "half", showIf: both(rowIs("country", "other"), rowNo("statement")) }),
        f("currency", "select", t("Devise", "Currency", "Währung"), { width: "half", options: CURRENCIES, showIf: both(rowIs("country", "other"), rowNo("statement")) }),
      ],
    }),
    f("assets.foreignWithholding", "yesno", t("Des impôts étrangers ont-ils été retenus sur des dividendes ou intérêts étrangers ?", "Were foreign taxes withheld on foreign dividends or interest?", "Wurden auf ausländischen Dividenden oder Zinsen ausländische Steuern abgezogen?"), { showIf: hasAny("securities", "banksForeign") }),
    f("assets.trading", "yesno", t("Avez-vous acheté et vendu des titres très souvent en {year}, ou utilisé un crédit ou des produits dérivés (options, CFD…) ?", "Did you buy and sell securities very often in {year}, or use credit or derivatives (options, CFDs…)?", "Haben Sie im Jahr {year} sehr oft Wertschriften gekauft und verkauft oder Kredit bzw. Derivate (Optionen, CFD…) eingesetzt?"), { showIf: has("securities") }),
    group({
      id: "assets.crypto",
      label: t("Cryptoactifs", "Crypto-assets", "Kryptowährungen"),
      itemLabel: t("Portefeuille", "Holding", "Bestand"),
      titleField: "platform",
      showIf: has("crypto"),
      minRows: 1,
      maxRows: 10,
      fields: [
        f("platform", "text", t("Plateforme ou wallet", "Platform or wallet", "Plattform oder Wallet"), { required: true, width: "half" }),
        f("custody", "select", t("Garde", "Custody", "Verwahrung"), {
          width: "half",
          options: opts(["exchange", "Sur une plateforme (relevé disponible)", "On a platform (statement available)", "Auf einer Plattform (Auszug verfügbar)"], ["self", "Auto-conservation (wallet personnel)", "Self-custody (own wallet)", "Selbstverwahrung (eigenes Wallet)"]),
        }),
        f("holdings", "textarea", t("Cryptoactifs et quantités au 31.12", "Assets and quantities at 31.12", "Kryptowährungen und Mengen am 31.12."), { showIf: rowIs("custody", "self"), maxLength: 600 }),
        f("income", "yesno", t("Revenus (staking, lending, minage) ?", "Income (staking, lending, mining)?", "Erträge (Staking, Lending, Mining)?"), { width: "half" }),
      ],
    }),
    group({
      id: "assets.insurances",
      label: t("Assurances-vie", "Life insurance", "Lebensversicherungen"),
      itemLabel: t("Police", "Policy", "Police"),
      titleField: "insurer",
      showIf: has("lifeInsurance"),
      minRows: 1,
      maxRows: 6,
      fields: [f("insurer", "text", t("Compagnie", "Insurer", "Gesellschaft"), { required: true, width: "half" })],
    }),
    group({
      id: "assets.vehicles",
      label: t("Véhicules, bateaux, avions", "Vehicles, boats, aircraft", "Fahrzeuge, Boote, Flugzeuge"),
      itemLabel: t("Véhicule", "Vehicle", "Fahrzeug"),
      titleField: "model",
      showIf: has("vehicles"),
      minRows: 1,
      maxRows: 6,
      fields: [
        f("year", "integer", t("Année d'achat", "Year of purchase", "Kaufjahr"), { required: true, width: "half" }),
        f("price", "money", t("Prix d'achat (CHF)", "Purchase price (CHF)", "Kaufpreis (CHF)"), { required: true, width: "half" }),
        f("model", "text", t("Véhicule", "Vehicle", "Fahrzeug"), { width: "half" }),
        f("leased", "yesno", t("En leasing ?", "Leased?", "Geleast?"), { width: "half" }),
      ],
    }),
    group({
      id: "assets.valuables",
      label: t("Objets de valeur", "Valuables", "Wertgegenstände"),
      help: t("Le mobilier de ménage et les effets personnels usuels ne sont pas à indiquer ; les seuils et exemptions dépendent du canton et de la nature du bien.", "Ordinary household furniture and personal effects need not be listed; thresholds and exemptions depend on the canton and the type of item.", "Übliches Mobiliar und persönliche Effekten nicht angeben; Freigrenzen hängen vom Kanton und der Art des Gegenstands ab."),
      itemLabel: t("Élément", "Item", "Position"),
      titleField: "description",
      showIf: has("valuables"),
      minRows: 1,
      maxRows: 8,
      fields: [
        f("description", "text", t("Description (or, bijoux, œuvre d'art…)", "Description (gold, jewellery, artwork…)", "Beschreibung (Gold, Schmuck, Kunstwerk…)"), { required: true, width: "half" }),
        f("value", "money", t("Valeur estimée au 31.12 (CHF)", "Estimated value at 31.12 (CHF)", "Geschätzter Wert am 31.12. (CHF)"), { width: "half" }),
      ],
    }),
    group({
      id: "assets.loans",
      label: t("Prêts accordés", "Loans granted", "Gewährte Darlehen"),
      itemLabel: t("Prêt", "Loan", "Darlehen"),
      titleField: "borrower",
      showIf: has("loansGiven"),
      minRows: 1,
      maxRows: 6,
      fields: [
        f("borrower", "text", t("Emprunteur", "Borrower", "Darlehensnehmer(in)"), { required: true, width: "half" }),
        f("balance", "money", t("Solde au 31.12", "Balance at 31.12", "Saldo am 31.12."), { width: "half" }),
        f("interest", "money", t("Intérêts reçus en {year}", "Interest received in {year}", "Erhaltene Zinsen {year}"), { width: "half" }),
        f("currency", "select", t("Devise", "Currency", "Währung"), { width: "half", options: CURRENCIES }),
      ],
    }),
    group({
      id: "assets.debts",
      label: t("Dettes (hors hypothèques)", "Debts (other than mortgages)", "Schulden (ohne Hypotheken)"),
      itemLabel: t("Dette", "Debt", "Schuld"),
      titleField: "lender",
      showIf: has("debts"),
      minRows: 1,
      maxRows: 8,
      fields: [
        f("lender", "text", t("Créancier", "Lender", "Gläubiger(in)"), { required: true, width: "half" }),
        f("kind", "select", t("Type", "Type", "Art"), {
          width: "half",
          options: opts(["bank", "Banque / organisme de crédit", "Bank / credit company", "Bank / Kreditinstitut"], ["private", "Personne privée / famille / employeur", "Private person / family / employer", "Privatperson / Familie / Arbeitgeber"]),
        }),
        f("lenderAddress", "text", t("Adresse et pays du prêteur", "Lender's address and country", "Adresse und Land des Darlehensgebers"), { width: "half", showIf: rowIs("kind", "private") }),
        f("balance", "money", t("Solde au 31.12", "Balance at 31.12", "Saldo am 31.12."), { width: "half", showIf: rowIs("kind", "private") }),
        f("interest", "money", t("Intérêts payés en {year}", "Interest paid in {year}", "Bezahlte Zinsen {year}"), { width: "half", showIf: rowIs("kind", "private") }),
        f("currency", "select", t("Devise", "Currency", "Währung"), { width: "half", options: CURRENCIES, showIf: rowIs("kind", "private") }),
      ],
    }),
  ],
};

// ---- real estate (owner: complete, every relevant question, but branched) ----------------------

const inCH = rowIs("where", "CH");
const abroad = rowIs("where", "abroad");
const rented = rowHas("uses", "rented", "partlyRented");
const ownUse = rowHas("uses", "main", "secondary", "relatives");
const bought = rowHas("events", "bought");
const sold = rowHas("events", "sold");
const works = rowHas("events", "works");
const toOwnUse = rowHas("events", "toOwnUse");
/**
 * Geneva rental-value questionnaire (former pages 8.1/8.2): own-use property in GE acquired since
 * the last notice, new construction / major works, or (uncertain, flagged) a change to own use.
 */
export const needsGeValuation = (_a: Answers, row?: Row) =>
  !!row && row.where === "CH" && row.canton === "GE" && ownUse(_a, row) && (row.inLastAvis === "no" || row.inLastAvis === "unknown" || bought(_a, row) || works(_a, row) || toOwnUse(_a, row));
const geBlock = (_a: Answers, row?: Row) => needsGeValuation(_a, row) && row?.geFill === "now";

function propertyFields(): FieldDef[] {
  const h = (id: string, type: FieldType, label: L, showIf: (a: Answers, row?: Row) => boolean, extra: FieldExtra = {}) => f(id, type, label, { width: "half", ...extra, showIf });
  const always = () => true;
  return [
    // Location and type
    f("where", "select", t("Situation", "Location", "Lage"), { required: true, width: "half", options: opts(["CH", "En Suisse", "In Switzerland", "In der Schweiz"], ["abroad", "À l'étranger", "Abroad", "Im Ausland"]) }),
    h("canton", "select", t("Canton", "Canton", "Kanton"), inCH, { options: CANTONS, required: true }),
    h("commune", "commune", t("Commune", "Municipality", "Gemeinde"), inCH, { required: true, cantonField: "canton" }),
    h("communeBfs", "text", t("N° OFS de la commune", "Municipality BFS number", "BFS-Gemeindenummer"), inCH, { hidden: true, maxLength: 6 }),
    h("country", "text", t("Pays", "Country", "Land"), abroad, { required: true }),
    h("city", "text", t("Ville", "Town", "Ort"), abroad, { required: true }),
    h("address", "text", t("Adresse", "Address", "Adresse"), always),
    h("kind", "select", t("Type de bien", "Type of property", "Art der Liegenschaft"), always, {
      required: true,
      options: opts(
        ["house", "Maison", "House", "Haus"],
        ["ppe", "Appartement en PPE", "Condominium apartment", "Stockwerkeigentum"],
        ["building", "Immeuble", "Apartment building", "Mehrfamilienhaus"],
        ["land", "Terrain", "Land", "Grundstück"],
        ["parking", "Place de parc / garage", "Parking / garage", "Parkplatz / Garage"],
        ["construction", "Bien en construction", "Under construction", "Im Bau"],
      ),
    }),
    // Ownership
    h("ownership", "select", t("Propriété", "Ownership", "Eigentum"), always, {
      required: true,
      options: opts(
        ["sole", "Seul(e) propriétaire", "Sole owner", "Alleineigentum"],
        ["spouses", "Avec mon conjoint", "With my spouse", "Mit meinem Ehegatten"],
        ["co", "Copropriété avec d'autres personnes", "Co-ownership with others", "Miteigentum mit anderen"],
        ["company", "Par une société", "Through a company", "Über eine Gesellschaft"],
        ["bareOwner", "Nue-propriété (usufruit accordé à un tiers)", "Bare ownership (usufruct granted to someone)", "Blosses Eigentum (Nutzniessung an Dritte)"],
        ["usufruct", "Usufruit (le bien appartient à un tiers)", "Usufruct (owned by someone else)", "Nutzniessung (Eigentum Dritter)"],
        ["habitation", "Droit d'habitation (le bien appartient à un tiers)", "Right of residence (owned by someone else)", "Wohnrecht (Eigentum Dritter)"],
      ),
    }),
    h("share", "percent", t("Votre part (%)", "Your share (%)", "Ihr Anteil (%)"), rowIs("ownership", "co")),
    // Use
    f("uses", "checkboxes", t("Utilisation en {year}", "Use in {year}", "Nutzung im Jahr {year}"), {
      required: true,
      options: opts(
        ["main", "Résidence principale", "Main home", "Hauptwohnsitz"],
        ["secondary", "Résidence secondaire", "Second home", "Zweitwohnung"],
        ["relatives", "Mis à disposition de proches (gratuitement ou à prix réduit)", "Made available to relatives (free or below market)", "Angehörigen zur Verfügung gestellt (gratis oder verbilligt)"],
        ["rented", "Loué entièrement", "Fully rented out", "Ganz vermietet"],
        ["partlyRented", "Loué en partie (chambre, appartement)", "Partly rented out (room, flat)", "Teilweise vermietet (Zimmer, Wohnung)"],
        ["professional", "Usage professionnel en partie", "Partly used for business", "Teilweise geschäftlich genutzt"],
        ["vacant", "Vide", "Vacant", "Leer"],
      ),
    }),
    h("useChanged", "text", t("Si l'utilisation a changé en cours d'année : périodes", "If the use changed during the year: periods", "Falls sich die Nutzung im Jahr geändert hat: Zeiträume"), always, { width: "full" }),
    h("vacantSearch", "yesno", t("Proposé à la location sans succès ?", "Offered for rent without success?", "Erfolglos zur Vermietung angeboten?"), rowHas("uses", "vacant")),
    h("vacantReason", "text", t("Pourquoi vide ? (vente en cours, travaux…)", "Why vacant? (sale pending, works…)", "Weshalb leer? (Verkauf, Umbau…)"), rowHas("uses", "vacant")),
    // Events
    f("events", "checkboxes", t("En {year}", "In {year}", "Im Jahr {year}"), {
      options: opts(
        ["bought", "Acheté", "Bought", "Gekauft"],
        ["sold", "Vendu", "Sold", "Verkauft"],
        ["inherited", "Reçu par héritage ou donation", "Received by inheritance or gift", "Durch Erbschaft oder Schenkung erhalten"],
        ["works", "Construction, agrandissement ou transformation importante", "Construction, extension or major renovation", "Neubau, Erweiterung oder grösserer Umbau"],
        ["toOwnUse", "Passé de loué à usage personnel", "Changed from rented to own use", "Von vermietet zu Eigennutzung gewechselt"],
      ),
    }),
    h("boughtDate", "date", t("Date d'achat", "Purchase date", "Kaufdatum"), bought),
    h("soldDate", "date", t("Date de vente", "Sale date", "Verkaufsdatum"), sold),
    h("soldPrice", "money", t("Prix de vente (si pas encore d'acte)", "Sale price (if no deed yet)", "Verkaufspreis (falls noch kein Vertrag)"), sold),
    h("notaryFiled", "radio", t("Le notaire a-t-il déjà déposé la déclaration de gain immobilier ?", "Has the notary already filed the property gains return?", "Hat das Notariat die Grundstückgewinnsteuererklärung bereits eingereicht?"), both(inCH, sold), { options: YES_NO_UNKNOWN, width: "full" }),
    // Value
    h("inLastAvis", "radio", t("Une valeur fiscale a-t-elle déjà été fixée pour ce bien (avis de taxation ou d'estimation) ?", "Has a tax value already been set for this property (assessment or valuation notice)?", "Wurde für diese Liegenschaft bereits ein Steuerwert festgesetzt (Veranlagungs- oder Schätzungsverfügung)?"), (a, row) => inCH(a, row) && !bought(a, row), { options: YES_NO_UNKNOWN, width: "full" }),
    h("value", "money", t("Valeur estimée au 31.12", "Estimated value at 31.12", "Geschätzter Wert am 31.12."), abroad),
    h("valueCurrency", "select", t("Devise", "Currency", "Währung"), abroad, { options: CURRENCIES }),
    h("foreignAssessment", "yesno", t("Avez-vous un avis d'impôt étranger pour ce bien ?", "Do you have a foreign tax notice for this property?", "Haben Sie eine ausländische Steuerveranlagung für diese Liegenschaft?"), abroad),
    // Rental
    h("agency", "yesno", t("Géré par une régie / agence ?", "Managed by an agency?", "Durch eine Verwaltung betreut?"), rented),
    h("furnished", "yesno", t("Location meublée ou de courte durée (ex. Airbnb) ?", "Furnished or short-term rental (e.g. Airbnb)?", "Möbliert oder kurzfristig vermietet (z. B. Airbnb)?"), rented),
    h("tenantCharges", "yesno", t("Charges facturées aux locataires ?", "Service charges billed to tenants?", "Nebenkosten den Mietern belastet?"), rented),
    h("rentGross", "money", t("Loyers bruts encaissés en {year} (sans décompte de régie)", "Gross rent received in {year} (if no agency statement)", "Bruttomieten {year} (falls keine Verwaltungsabrechnung)"), both(rented, rowNo("agency"))),
    h("rentCurrency", "select", t("Devise des loyers", "Rent currency", "Währung der Mieten"), both(rented, abroad, rowNo("agency")), { options: CURRENCIES }),
    h("rentNet", "radio", t("Ce montant est-il net des charges ?", "Is this amount net of service charges?", "Ist dieser Betrag ohne Nebenkosten?"), both(rented, rowNo("agency")), { options: YES_NO_UNKNOWN }),
    // Financing
    h("mortgage", "yesno", t("Hypothèque ?", "Mortgage?", "Hypothek?"), always),
    h("lenders", "text", t("Banque(s) prêteuse(s)", "Lending bank(s)", "Kreditgebende Bank(en)"), rowYes("mortgage"), { required: true }),
    h("amortisation", "select", t("Amortissement", "Repayment", "Amortisation"), rowYes("mortgage"), {
      options: opts(
        ["none", "Aucun", "None", "Keine"],
        ["direct", "Direct", "Direct", "Direkt"],
        ["indirect", "Indirect (3e pilier nanti)", "Indirect (pledged pillar 3a)", "Indirekt (verpfändete Säule 3a)"],
        ["unknown", "Je ne sais pas", "I don't know", "Weiss nicht"],
      ),
    }),
    h("privateLoan", "yesno", t("Prêt d'un particulier ou de la famille pour ce bien ?", "Loan from a private person or family for this property?", "Darlehen einer Privatperson oder der Familie für diese Liegenschaft?"), always),
    h("privateLender", "text", t("Prêteur", "Lender", "Darlehensgeber(in)"), rowYes("privateLoan")),
    h("privateBalance", "money", t("Solde au 31.12", "Balance at 31.12", "Saldo am 31.12."), rowYes("privateLoan")),
    h("privateInterest", "money", t("Intérêts payés en {year}", "Interest paid in {year}", "Bezahlte Zinsen {year}"), rowYes("privateLoan")),
    // Costs
    h("ppe", "yesno", t("Recevez-vous un décompte annuel de charges de la copropriété ?", "Do you receive an annual service charge statement from the condominium?", "Erhalten Sie eine jährliche Nebenkostenabrechnung der Stockwerkeigentümer?"), rowIs("kind", "ppe", "parking")),
    h("invoices", "yesno", t("Avez-vous des factures de travaux ou d'entretien pour {year} ?", "Do you have invoices for works or maintenance in {year}?", "Haben Sie Rechnungen für Arbeiten oder Unterhalt {year}?"), always, {
      help: t("Sans factures, une déduction forfaitaire s'applique en général.", "Without invoices, a flat-rate deduction generally applies.", "Ohne Rechnungen gilt in der Regel ein Pauschalabzug."),
    }),
    f("workTypes", "checkboxes", t("Nature des travaux et frais", "Type of works and costs", "Art der Arbeiten und Kosten"), {
      showIf: rowYes("invoices"),
      options: opts(
        ["upkeep", "Entretien et réparations", "Upkeep and repairs", "Unterhalt und Reparaturen"],
        ["improvement", "Améliorations / plus-value (agrandissement, équipement neuf)", "Improvements adding value (extension, new fittings)", "Wertvermehrende Investitionen (Ausbau, Neuausstattung)"],
        ["energy", "Économies d'énergie et environnement", "Energy-saving and environmental works", "Energiesparen und Umweltschutz"],
        ["demolition", "Démolition en vue d'une construction de remplacement", "Demolition for a replacement building", "Rückbau für einen Ersatzneubau"],
        ["heritage", "Monument historique", "Listed building", "Denkmalpflege"],
        ["insurance", "Assurance du bâtiment", "Building insurance", "Gebäudeversicherung"],
        ["fees", "Taxes et redevances (déchets, eaux…)", "Property charges (waste, water…)", "Gebühren (Kehricht, Wasser…)"],
        ["management", "Frais de gérance", "Management fees", "Verwaltungskosten"],
      ),
    }),
    h("subsidies", "yesno", t("Subventions reçues pour des travaux ?", "Subsidies received for works?", "Förderbeiträge für Arbeiten erhalten?"), rowYes("invoices")),
    // Geneva rental value (former pages 8.1 / 8.2): only when no valuation exists yet
    f("geFill", "radio", t("Genève : pour estimer la valeur locative, nous avons besoin de quelques caractéristiques du bien.", "Geneva: to estimate the rental value, we need a few features of the property.", "Genf: Für die Schätzung des Eigenmietwerts brauchen wir einige Merkmale der Liegenschaft."), {
      required: true,
      showIf: needsGeValuation,
      options: opts(["now", "Je les indique maintenant", "I'll give them now", "Ich gebe sie jetzt an"], ["later", "Plus tard, avec Ark", "Later, with Ark", "Später, mit Ark"]),
    }),
    ...geFields(),
  ];

  function geFields(): FieldDef[] {
    const g = (id: string, type: FieldType, label: L, extra: FieldExtra = {}) => f(id, type, label, { width: "half", ...extra, showIf: geBlock });
    return [
      g("geBuilt", "integer", t("Année de construction (ou de rénovation complète)", "Year built (or fully renovated)", "Baujahr (oder Jahr der Gesamtsanierung)")),
      g("geCondition", "select", t("État (si construit avant 1971)", "Condition (if built before 1971)", "Zustand (falls vor 1971 erbaut)"), {
        options: opts(["good", "Satisfaisant", "Satisfactory", "Befriedigend"], ["renovation", "Grande rénovation nécessaire", "Needs major renovation", "Grosser Sanierungsbedarf"], ["poor", "Très mauvais", "Very poor", "Sehr schlecht"]),
      }),
      g("geArea", "integer", t("Surface habitable (m²)", "Living area (m²)", "Wohnfläche (m²)"), {
        help: t("En principe, combles habitables et mansardes comptent là où la hauteur dépasse 1,5 m ; galetas, balcons, terrasses, caves, garages et locaux de service ne comptent pas. En cas de doute, indiquez la surface de vos plans.", "Include habitable attic rooms where the height exceeds 1.5 m; exclude unusable lofts, balconies, terraces, cellars, garages and utility rooms.", "Bewohnbare Dachräume ab 1,5 m Höhe einrechnen; nicht bewohnbare Estriche, Balkone, Terrassen, Keller, Garagen und Nebenräume ausschliessen."),
      }),
      g("geRooms", "text", t("Nombre de pièces", "Number of rooms", "Anzahl Zimmer"), { maxLength: 10, help: t("Comptez les pièces selon vos plans ; nous ferons le calcul.", "Count the rooms as on your plans; we will do the calculation.", "Zählen Sie die Zimmer gemäss Plänen; wir rechnen.") }),
      g("geLand", "integer", t("Surface du terrain (m², maison)", "Land area (m², house)", "Grundstücksfläche (m², Haus)")),
      g("geFloors", "integer", t("Nombre d'étages (maison)", "Floors (house)", "Geschosse (Haus)")),
      g("geType", "select", t("Type", "Type", "Typ"), {
        options: opts(
          ["detached", "Maison individuelle", "Detached house", "Freistehendes Haus"],
          ["grouped", "Maison groupée ou contiguë", "Semi-detached or terraced", "Doppel- oder Reihenhaus"],
          ["flat", "Appartement", "Apartment", "Wohnung"],
          ["duplex", "Duplex, triplex ou attique", "Duplex, triplex or penthouse", "Duplex, Triplex oder Attika"],
        ),
      }),
      g("gePpeShare", "text", t("Quote-part PPE (millièmes)", "Condominium share (thousandths)", "Wertquote (Promille)"), { maxLength: 30 }),
      g("geOccupants", "integer", t("Personnes vivant dans le logement", "People living there", "Bewohner(innen)")),
      g("geComfort", "checkboxes", t("Équipement", "Features", "Ausstattung"), {
        width: "full",
        options: opts(
          ["insulation", "Bonne isolation thermique", "Good thermal insulation", "Gute Wärmedämmung"],
          ["centralHeating", "Chauffage central", "Central heating", "Zentralheizung"],
          ["centralHotWater", "Eau chaude centrale", "Central hot water", "Zentrales Warmwasser"],
          ["kitchen", "Cuisine équipée", "Fitted kitchen", "Eingerichtete Küche"],
          ["twoBathrooms", "Deux salles de bains ou plus", "Two or more bathrooms", "Zwei oder mehr Badezimmer"],
          ["separateWc", "WC séparés", "Separate WC", "Separates WC"],
          ["fireplace", "Cheminée", "Fireplace", "Cheminée"],
          ["garage", "Une place de garage / parking intérieur", "One indoor garage / parking space", "Ein Garagen- / Innenparkplatz"],
          ["garages", "Plus d'une place intérieure", "More than one indoor space", "Mehr als ein Innenplatz"],
          ["poolOutSmall", "Piscine extérieure de moins de 25 m²", "Outdoor pool under 25 m²", "Aussenschwimmbad unter 25 m²"],
          ["poolOutLarge", "Piscine extérieure de 25 m² ou plus", "Outdoor pool of 25 m² or more", "Aussenschwimmbad ab 25 m²"],
          ["poolIn", "Piscine couverte ou intérieure", "Covered or indoor pool", "Hallen- oder gedecktes Schwimmbad"],
          ["poolShared", "Piscine en copropriété", "Shared (co-owned) pool", "Schwimmbad im Miteigentum"],
          ["tennis", "Court de tennis privé", "Private tennis court", "Privater Tennisplatz"],
          ["tennisShared", "Court de tennis en copropriété", "Shared tennis court", "Tennisplatz im Miteigentum"],
        ),
      }),
      g("geNuisances", "checkboxes", t("Nuisances", "Nuisances", "Immissionen"), {
        width: "full",
        options: opts(
          ["airport", "Bruit de l'aéroport (zone de bruit)", "Airport noise (noise zone)", "Fluglärm (Lärmzone)"],
          ["rail", "Autoroute ou voie CFF à moins de 100 m sans protection phonique", "Motorway or railway within 100 m without noise protection", "Autobahn oder SBB-Linie < 100 m ohne Lärmschutz"],
          ["junction", "Carrefour bruyant ou route à fort trafic à moins de 50 m sans protection", "Noisy junction or busy road within 50 m without protection", "Lärmige Kreuzung oder stark befahrene Strasse < 50 m ohne Schutz"],
          ["shooting", "Stand de tir à moins de 1,5 km sans obstacle naturel", "Shooting range within 1.5 km without natural obstacle", "Schiessstand < 1,5 km ohne natürliches Hindernis"],
          ["plant", "Usine, incinération ou épuration à moins de 1,5 km", "Factory, incinerator or treatment plant within 1.5 km", "Fabrik, Verbrennungs- oder Kläranlage < 1,5 km"],
        ),
      }),
      g("geLocation", "select", t("Situation", "Location", "Lage"), {
        options: opts(
          ["poor", "Peu de soleil, vue restreinte", "Little sun, restricted view", "Wenig Sonne, eingeschränkte Sicht"],
          ["normal", "Normale", "Normal", "Normal"],
          ["good", "Ensoleillée, belle vue", "Sunny, good view", "Sonnig, schöne Aussicht"],
          ["lake", "Vue sur le lac", "Lake view", "Seesicht"],
        ),
      }),
    ];
  }
}

const property: StepDef = {
  id: "property",
  title: t("Immobilier", "Real estate", "Liegenschaften"),
  intro: t("Une fiche par bien, en Suisse ou à l'étranger. Les montants des hypothèques figurent sur les attestations bancaires.", "One card per property, in Switzerland or abroad. Mortgage amounts are on the bank statements.", "Eine Karte pro Liegenschaft, in der Schweiz oder im Ausland. Hypothekarbeträge stehen auf den Bankbestätigungen."),
  sheet: "Immobilier",
  showIf: (a) => hasAny("propertyCH", "propertyAbroad")(a) || nonResidentReasons(a).includes("property"),
  blocks: [
    group({
      id: "property.items",
      label: t("Biens immobiliers", "Properties", "Liegenschaften"),
      itemLabel: t("Bien", "Property", "Liegenschaft"),
      titleField: "commune|city",
      minRows: 1,
      maxRows: 10,
      fields: propertyFields(),
    }),
  ],
};

const other: StepDef = {
  id: "other",
  title: t("Autres situations", "Other situations", "Weitere Situationen"),
  sheet: "Autres",
  showIf: hasAny("inheritance", "lottery", "trust", "unusual", "lppBuyin", "capital"),
  blocks: [
    group({
      id: "other.inheritance",
      label: t("Héritages et donations", "Inheritances and gifts", "Erbschaften und Schenkungen"),
      itemLabel: t("Héritage / donation", "Inheritance / gift", "Erbschaft / Schenkung"),
      titleField: "counterparty",
      showIf: has("inheritance"),
      minRows: 1,
      maxRows: 5,
      fields: [
        f("direction", "select", t("Reçu ou fait", "Received or made", "Erhalten oder gemacht"), { required: true, width: "half", options: opts(["received", "Reçu", "Received", "Erhalten"], ["made", "Fait", "Made", "Gemacht"]) }),
        f("type", "select", t("Nature", "Type", "Art"), {
          width: "half",
          options: opts(["estate", "Succession", "Inheritance", "Erbschaft"], ["gift", "Donation", "Gift", "Schenkung"], ["advance", "Avancement d'hoirie", "Advance on inheritance", "Erbvorbezug"]),
        }),
        f("counterparty", "text", t("Défunt / donateur / bénéficiaire", "Deceased / donor / recipient", "Erblasser(in) / Schenker(in) / Empfänger(in)"), { width: "half" }),
        f("date", "date", t("Date", "Date", "Datum"), { width: "half" }),
        f("residence", "text", t("Domicile du défunt / donateur (canton ou pays)", "Residence of the deceased / donor (canton or country)", "Wohnsitz Erblasser(in) / Schenker(in) (Kanton oder Land)"), { width: "half" }),
        f("settled", "select", t("Succession partagée au 31.12 ?", "Estate distributed by 31.12?", "Erbschaft am 31.12. geteilt?"), {
          width: "half",
          showIf: rowIs("type", "estate"),
          options: opts(["done", "Oui", "Yes", "Ja"], ["pending", "Non, encore indivise", "No, still undivided", "Nein, noch ungeteilt"]),
        }),
      ],
    }),
    group({
      id: "other.winnings",
      label: t("Gains de jeu", "Gambling wins", "Spielgewinne"),
      itemLabel: t("Gain", "Win", "Gewinn"),
      titleField: "source",
      showIf: has("lottery"),
      minRows: 1,
      maxRows: 4,
      fields: [
        f("source", "text", t("Loterie, casino ou site de jeu", "Lottery, casino or gaming site", "Lotterie, Casino oder Spielseite"), { required: true, width: "half" }),
        f("foreignOnline", "yesno", t("Jeu en ligne sur un site étranger ?", "Online game on a foreign site?", "Online-Spiel auf einer ausländischen Seite?"), { width: "half" }),
        f("date", "date", t("Date", "Date", "Datum"), { width: "half" }),
      ],
    }),
    f("other.trustRole", "checkboxes", t("Votre rôle dans le trust ou la fondation", "Your role in the trust or foundation", "Ihre Rolle im Trust oder in der Stiftung"), {
      showIf: has("trust"),
      options: opts(["settlor", "Constituant / fondateur", "Settlor / founder", "Errichter(in) / Stifter(in)"], ["beneficiary", "Bénéficiaire", "Beneficiary", "Begünstigte(r)"], ["other", "Autre", "Other", "Andere"]),
    }),
    f("other.lpp3years", "radio", t("Un retrait en capital (2e pilier) a-t-il eu lieu, ou est-il prévu, dans les trois ans qui suivent un rachat ?", "Has a pension capital withdrawal taken place, or is one planned, within three years after a buy-in?", "Erfolgte oder ist ein Kapitalbezug (2. Säule) innerhalb von drei Jahren nach einem Einkauf geplant?"), {
      options: YES_NO_UNKNOWN,
      showIf: hasAny("lppBuyin", "capital"),
    }),
    f("other.unusual", "textarea", t("Décrivez la situation", "Describe the situation", "Beschreiben Sie die Situation"), { maxLength: 2000, showIf: has("unusual") }),
  ],
};

/** Protected route: minimal questions, no AI, staff alerted at once, minimal client e-mail. */
const regularisation: StepDef = {
  id: "regularisation",
  title: t("Régularisation", "Regularisation", "Regularisierung"),
  intro: t(
    "Vos réponses restent confidentielles. Sous certaines conditions, une régularisation spontanée peut éviter une amende ; l'impôt et les intérêts restent dus pour les années concernées. Nous vous appellerons avant toute démarche.",
    "Your answers stay confidential. Under certain conditions, a voluntary disclosure may avoid a fine; the tax and interest remain due for the years concerned. We will call you before taking any step.",
    "Ihre Antworten bleiben vertraulich. Unter gewissen Bedingungen kann eine straflose Selbstanzeige eine Busse vermeiden; Steuer und Zinsen bleiben für die betroffenen Jahre geschuldet. Wir rufen Sie an, bevor wir etwas unternehmen.",
  ),
  sheet: "Régularisation",
  showIf: has("regularisation"),
  blocks: [
    f("regularisation.authorityContact", "radio", t("Une autorité fiscale vous a-t-elle déjà contacté(e) à ce sujet ?", "Has a tax authority already contacted you about this?", "Hat Sie eine Steuerbehörde bereits dazu kontaktiert?"), { options: YES_NO_UNKNOWN, required: true }),
    f("regularisation.priorDisclosure", "radio", t("Avez-vous déjà fait une telle régularisation par le passé ?", "Have you ever made such a disclosure before?", "Haben Sie früher schon eine solche Selbstanzeige gemacht?"), { options: YES_NO_UNKNOWN, required: true }),
    f("regularisation.years", "text", t("Années concernées (environ)", "Years concerned (approx.)", "Betroffene Jahre (ungefähr)"), { width: "half" }),
    f("regularisation.nature", "textarea", t("De quoi s'agit-il ? (restez général si vous préférez)", "What is it about? (stay general if you prefer)", "Worum geht es? (gerne allgemein)"), { maxLength: 1500 }),
  ],
};

const lumpSum: StepDef = {
  id: "lumpSum",
  title: t("Forfait fiscal", "Lump-sum taxation", "Pauschalbesteuerung"),
  sheet: "Forfait fiscal",
  showIf: isLumpSum,
  blocks: [
    f("lumpSum.ruling", "yesno", t("Avez-vous un accord écrit de l'administration (ruling ou décision) ?", "Do you have a written agreement from the tax authority (ruling or decision)?", "Haben Sie eine schriftliche Vereinbarung der Steuerverwaltung (Ruling oder Entscheid)?"), { required: true }),
    f("lumpSum.basis", "money", t("Base convenue (CHF), si vous la connaissez", "Agreed base (CHF), if you know it", "Vereinbarte Bemessungsgrundlage (CHF), falls bekannt"), { width: "half" }),
    f("lumpSum.swissItems", "textarea", t("Revenus et biens en Suisse (immeubles, comptes, rentes…)", "Income and assets in Switzerland (property, accounts, pensions…)", "Einkünfte und Vermögen in der Schweiz (Liegenschaften, Konten, Renten…)"), {
      maxLength: 2000,
      help: t("Pour le calcul de contrôle.", "For the control calculation.", "Für die Kontrollrechnung."),
    }),
    f("lumpSum.treaty", "radio", t("Certains revenus étrangers bénéficient-ils d'un impôt à la source réduit grâce à une convention fiscale ? Si vous ne savez pas, répondez « Je ne sais pas ».", "Do some foreign income items benefit from a reduced withholding tax under a tax treaty? If unsure, answer \"I don't know\".", "Profitieren gewisse ausländische Einkünfte dank eines Steuerabkommens von einer reduzierten Quellensteuer? Wenn unsicher: «Weiss nicht»."), { options: YES_NO_UNKNOWN }),
  ],
};

const documents: StepDef = {
  id: "documents",
  title: t("Vos documents", "Your documents", "Ihre Dokumente"),
  sheet: "Documents",
  special: "documents",
  blocks: [],
};

const review: StepDef = {
  id: "review",
  title: t("Vérification et envoi", "Review and submit", "Prüfen und absenden"),
  sheet: "Suivi",
  special: "review",
  blocks: [
    f("review.deadline", "select", t("Délai de dépôt", "Filing deadline", "Einreichefrist"), {
      width: "half",
      options: opts(
        ["standard", "Délai ordinaire", "Standard deadline", "Ordentliche Frist"],
        ["extended", "Prolongation déjà obtenue", "Extension already granted", "Fristerstreckung erhalten"],
        ["ask", "Merci de demander une prolongation", "Please request an extension", "Bitte Fristerstreckung beantragen"],
        ["unknown", "Je ne sais pas", "I don't know", "Weiss nicht"],
      ),
    }),
    f("review.extendedTo", "date", t("Prolongation jusqu'au", "Extended until", "Erstreckt bis"), { width: "half", showIf: is("review.deadline", "extended") }),
    f("review.comments", "textarea", t("Questions ou remarques", "Questions or remarks", "Fragen oder Bemerkungen"), { maxLength: 4000 }),
    f("other.p3aRetroInfo", "boolean", t("Je souhaite des informations sur les versements rétroactifs au 3e pilier A", "I would like information on retroactive pillar 3a contributions", "Ich wünsche Informationen zu rückwirkenden Einzahlungen in die Säule 3a"), { showIf: has("p3a") }),
    // Service reminder with opt-out (owner decision): ticked by default when the case is created.
    f("review.reminder", "boolean", t("Vous rappeler l'an prochain et préremplir votre questionnaire (désactivable à tout moment)", "Remind you next year and pre-fill your questionnaire (you can turn this off at any time)", "Sie nächstes Jahr erinnern und Ihren Fragebogen vorausfüllen (jederzeit abbestellbar)"), {
      help: t("Un email en février avec votre questionnaire prérempli. Chaque email contient un lien pour ne plus le recevoir.", "An email in February with your pre-filled questionnaire. Each email has a link to stop receiving it.", "Eine E-Mail im Februar mit Ihrem vorausgefüllten Fragebogen. Jede E-Mail enthält einen Abmeldelink."),
    }),
  ],
};

export const STEPS: StepDef[] = [start, regime, baseDocs, router, family, work, assets, property, other, regularisation, lumpSum, documents, review];

/** Router group → detail screen (used for "unchanged" skipping). */
export const GROUP_STEP: Record<string, string> = { family: "family", work: "work", assets: "assets", property: "property", other: "other" };
