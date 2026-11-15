"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { ControllerFieldState, ControllerRenderProps, FieldValues } from "react-hook-form";
import type { AnyAnswers, AnyRow } from "@/src/lib/questionnaire/form-values";
import type { AskReply, KitBase, KitField, KitOption } from "@/src/lib/questionnaire/kit";

export { fill, type AskReply, type KitBlock, type KitField, type KitGroup, type KitHeading, type KitNote, type KitOption, type KitStrings, type LabelText } from "@/src/lib/questionnaire/kit";

/**
 * The questionnaires' one component set (KYC and tax) is parameterised by a kit: the form's strings
 * in the page's language, how it words and checks a field (src/lib/questionnaire/kit.ts, built per
 * form in src/lib/<form>/kit.ts), plus here its server calls and its own field types. Each form
 * provides its kit around its form; the shared components read it with useKit().
 */

/** What a form-specific field type receives to render itself inside the shared field frame. */
export interface FieldTypeContext {
  field: KitField;
  name: string;
  answers: AnyAnswers;
  row?: AnyRow;
  f: ControllerRenderProps<FieldValues, string>;
  fieldState: ControllerFieldState;
  invalid: boolean;
  /** The label line (label, optional tag, (i), green check). */
  labelNode: ReactNode;
  /** The explanation (screen-reader description, or the visible line), and the error message, to place. */
  help: ReactNode;
  /** The grid span of a field of this width. */
  span: string;
  /** Renders checkbox cards for these options (e.g. tax years), `className` on their grid. */
  checkboxes: (options: KitOption[], className?: string) => ReactNode;
}

export interface QuestionnaireKit extends KitBase {
  /** « Poser une question » in the (i): the form's assistant. */
  ask?: {
    send: (fieldId: string, question: string, answers: AnyAnswers) => Promise<AskReply>;
    display: (field: KitField, value: string | string[]) => string;
    errorText: (error: unknown) => string;
  };
  /** Field types of this form only (tax: commune, taxyears), rendered inside the shared frame. */
  fieldTypes?: Record<string, (ctx: FieldTypeContext) => ReactNode>;
}
const KitContext = createContext<QuestionnaireKit | null>(null);

export function KitProvider({ kit, children }: { kit: QuestionnaireKit; children: ReactNode }) {
  return <KitContext.Provider value={kit}>{children}</KitContext.Provider>;
}

export function useKit(): QuestionnaireKit {
  const kit = useContext(KitContext);
  if (!kit) throw new Error("questionnaire kit missing: wrap the form in <KitProvider>");
  return kit;
}

