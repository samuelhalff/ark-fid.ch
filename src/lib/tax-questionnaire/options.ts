import { t, type Option } from "./types";

/** The 26 cantons (official abbreviations) plus "no Swiss residence at 31.12". */
export const CANTONS: Option[] = [
  ["GE", "Genève", "Geneva", "Genf"],
  ["VD", "Vaud", "Vaud", "Waadt"],
  ["VS", "Valais", "Valais", "Wallis"],
  ["FR", "Fribourg", "Fribourg", "Freiburg"],
  ["NE", "Neuchâtel", "Neuchâtel", "Neuenburg"],
  ["JU", "Jura", "Jura", "Jura"],
  ["BE", "Berne", "Bern", "Bern"],
  ["ZH", "Zurich", "Zurich", "Zürich"],
  ["BS", "Bâle-Ville", "Basel-Stadt", "Basel-Stadt"],
  ["BL", "Bâle-Campagne", "Basel-Landschaft", "Basel-Landschaft"],
  ["AG", "Argovie", "Aargau", "Aargau"],
  ["SO", "Soleure", "Solothurn", "Solothurn"],
  ["LU", "Lucerne", "Lucerne", "Luzern"],
  ["ZG", "Zoug", "Zug", "Zug"],
  ["SZ", "Schwytz", "Schwyz", "Schwyz"],
  ["UR", "Uri", "Uri", "Uri"],
  ["OW", "Obwald", "Obwalden", "Obwalden"],
  ["NW", "Nidwald", "Nidwalden", "Nidwalden"],
  ["GL", "Glaris", "Glarus", "Glarus"],
  ["SG", "Saint-Gall", "St. Gallen", "St. Gallen"],
  ["AR", "Appenzell Rhodes-Extérieures", "Appenzell Ausserrhoden", "Appenzell Ausserrhoden"],
  ["AI", "Appenzell Rhodes-Intérieures", "Appenzell Innerrhoden", "Appenzell Innerrhoden"],
  ["TG", "Thurgovie", "Thurgau", "Thurgau"],
  ["SH", "Schaffhouse", "Schaffhausen", "Schaffhausen"],
  ["GR", "Grisons", "Graubünden", "Graubünden"],
  ["TI", "Tessin", "Ticino", "Tessin"],
].map(([value, fr, en, de]) => ({ value, label: t(fr, en, de) }));

export const RESIDENCE_OPTIONS: Option[] = [
  ...CANTONS,
  {
    value: "ABROAD",
    label: t(
      "Pas de domicile en Suisse au 31.12 (départ ou résidence à l'étranger)",
      "No residence in Switzerland at 31.12 (departure or living abroad)",
      "Kein Wohnsitz in der Schweiz am 31.12. (Wegzug oder Wohnsitz im Ausland)",
    ),
  },
];

export const YES_NO_UNKNOWN: Option[] = [
  { value: "yes", label: t("Oui", "Yes", "Ja") },
  { value: "no", label: t("Non", "No", "Nein") },
  { value: "unknown", label: t("Je ne sais pas", "I don't know", "Weiss nicht") },
];

/** Who an item belongs to (the original questionnaire's C / E / EàC). */
export const HOLDER: Option[] = [
  { value: "taxpayer", label: t("Contribuable", "Taxpayer", "Steuerpflichtige Person") },
  { value: "spouse", label: t("Conjoint(e) / partenaire", "Spouse / partner", "Ehegatte / Partner(in)") },
  { value: "joint", label: t("Commun", "Joint", "Gemeinsam") },
  { value: "child", label: t("Enfant à charge", "Dependent child", "Unterhaltsberechtigtes Kind") },
];

export const PERSON: Option[] = HOLDER.filter((o) => o.value === "taxpayer" || o.value === "spouse");

export const CURRENCIES: Option[] = ["CHF", "EUR", "USD", "GBP", "other"].map((value) => ({
  value,
  label: value === "other" ? t("Autre", "Other", "Andere") : t(value, value, value),
}));

export const CONFESSION: Option[] = [
  { value: "none", label: t("Sans confession / autre", "None / other", "Keine / andere") },
  { value: "catholic", label: t("Catholique romaine", "Roman Catholic", "Römisch-katholisch") },
  { value: "protestant", label: t("Protestante (réformée)", "Protestant (Reformed)", "Evangelisch-reformiert") },
  { value: "christcatholic", label: t("Catholique-chrétienne", "Christ Catholic", "Christkatholisch") },
  { value: "undisclosed", label: t("Je préfère ne pas répondre", "Prefer not to say", "Keine Angabe") },
];

export const PERMITS: Option[] = [
  ["B", "Permis B (séjour)", "B permit (residence)", "Ausweis B (Aufenthalt)"],
  ["C", "Permis C (établissement)", "C permit (settlement)", "Ausweis C (Niederlassung)"],
  ["L", "Permis L (courte durée)", "L permit (short stay)", "Ausweis L (Kurzaufenthalt)"],
  ["G", "Permis G (frontalier)", "G permit (cross-border commuter)", "Ausweis G (Grenzgänger)"],
  ["F", "Permis F (admission provisoire)", "F permit (provisional admission)", "Ausweis F (vorläufig aufgenommen)"],
  ["N", "Permis N (requérant d'asile)", "N permit (asylum seeker)", "Ausweis N (Asylsuchende)"],
  ["S", "Permis S (protection)", "S permit (protection)", "Ausweis S (Schutzstatus)"],
  ["Ci", "Permis Ci", "Ci permit", "Ausweis Ci"],
  ["DFAE", "Carte de légitimation DFAE", "FDFA legitimation card", "Legitimationskarte EDA"],
  ["EU", "Ressortissant UE/AELE sans permis (annonce)", "EU/EFTA national without permit (notification)", "EU/EFTA ohne Ausweis (Meldeverfahren)"],
  ["other", "Autre", "Other", "Andere"],
].map(([value, fr, en, de]) => ({ value, label: t(fr, en, de) }));
