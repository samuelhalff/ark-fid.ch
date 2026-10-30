/**
 * Points for Ark's review (internal LBA note), computed from the answers. Never shown to the
 * client as such. The legal qualification and the risk class stay Ark's decision (Cadence).
 */
import { isListed, isNonOp, isOp, isPM, isPP } from "./schema";
import type { Answers } from "./types";

export type Flag =
  | "pep"
  | "sanctions"
  | "criminal"
  | "trustOrFoundation"
  | "nominee"
  | "listed"
  | "forThird"
  | "cash"
  | "crypto"
  | "valuables"
  | "licence"
  | "notStarted"
  | "noSubstance"
  | "routeMismatch";

export const FLAG_LABELS: Record<Flag, string> = {
  pep: "PPE ou proche d'une PPE",
  sanctions: "Sanctions déclarées",
  criminal: "Procédure ou condamnation pénale déclarée",
  trustOrFoundation: "Trust ou fondation dans la structure (route manuelle)",
  nominee: "Prête-nom / fiduciaire dans la détention",
  listed: "Société cotée ou filiale détenue majoritairement par une société cotée — application de l'art. 4 al. 1 LBA à vérifier",
  forThird: "Détient des avoirs pour le compte d'un tiers (point B)",
  cash: "Opérations en espèces prévues",
  crypto: "Crypto-actifs prévus",
  valuables: "Métaux précieux / art prévus",
  licence: "Activité soumise à autorisation",
  notStarted: "Société pas encore active",
  noSubstance: "Formulaire opérationnel, mais ni locaux ni employés propres : qualification (société de domicile ?) à vérifier",
  routeMismatch: "Réponses du client contraires au formulaire choisi par Ark",
};

const list = (a: Answers, id: string) => (Array.isArray(a[id]) ? (a[id] as unknown[]) : []);

/**
 * The client's description of the company contradicts Ark's choice of form: an operating form
 * for a company that only holds assets, or a non-operating form for a company that runs or
 * supports a business. The submission then goes back to Ark instead of being signed.
 */
export function routeMismatch(a: Answers): boolean {
  const kind = a["a.activityKind"];
  if (isOp(a)) return kind === "assets";
  if (isNonOp(a)) return kind === "operates" || kind === "supports";
  return false;
}

export function flagsOf(a: Answers): Flag[] {
  const out = new Set<Flag>();
  if (a["c.pep"] === "pep" || a["c.pep"] === "close") out.add("pep");
  if (a["c.sanctions"] === "yes") out.add("sanctions");
  if (a["c.criminal"] === "yes") out.add("criminal");
  const kinds = list(a, "b.structureKinds");
  if (kinds.includes("trust") || kinds.includes("foundation")) out.add("trustOrFoundation");
  if (kinds.includes("nominee") || list(a, "b.shareholders").some((r) => (r as Record<string, unknown>).kind === "nominee")) out.add("nominee");
  if (list(a, "b.shareholders").some((r) => (r as Record<string, unknown>).kind === "trust")) out.add("trustOrFoundation");
  if (isPP(a) && a["b.ppStructure"] === "yes") out.add("nominee");
  if (isListed(a)) out.add("listed");
  if (isOp(a) && a["b.forThird"] === "yes") out.add("forThird");
  const ops = [...list(a, "g.typesPm"), ...list(a, "g.typesPp")];
  if (ops.includes("cash")) out.add("cash");
  if (ops.includes("crypto")) out.add("crypto");
  if (ops.includes("valuables")) out.add("valuables");
  if (a["d.licence"] === "yes") out.add("licence");
  if (isPM(a) && a["a.activityKind"] === "notStarted") out.add("notStarted");
  // Dima's internal note: a domiciliary company has no premises or staff of its own.
  if (isOp(a) && a["a.ownPremises"] === "no" && a["a.ownStaff"] === "no") out.add("noSubstance");
  if (routeMismatch(a)) out.add("routeMismatch");
  return [...out];
}
