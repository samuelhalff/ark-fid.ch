"use client";

/** The tax schema plugged into the shared form model (src/lib/questionnaire): labels (with the tax year) and rows. */
import { FIELD_ERRORS } from "@/src/lib/tax-questionnaire/ui";
import { validateStep, type FieldError } from "@/src/lib/tax-questionnaire/logic";
import { taxIssueAdapter } from "@/src/lib/tax-questionnaire/kit";
import type { Answers, QfLocale, StepDef } from "@/src/lib/tax-questionnaire/types";
import { collectIssues as collect, issuesFromKeys, stepSchema as schema, type Issue } from "@/src/lib/questionnaire/issues";

import { fromForm as valuesToAnswers, type FormValues } from "@/src/lib/questionnaire/form-values";

export { focusField, toForm, toId, toName, type FormValues } from "@/src/lib/questionnaire/form-values";

/** Form values back to answers (empty values dropped). */
export const fromForm = (values: FormValues): Answers => valuesToAnswers<Answers>(values);
export type { Issue } from "@/src/lib/questionnaire/issues";

/** zod schema for one screen: delegates to the shared validator (same rules as the server). */
export const stepSchema = (step: StepDef, locale: QfLocale) => schema((a) => validateStep(step, a as Answers), (code) => FIELD_ERRORS[code as FieldError]?.[locale]);

export const collectIssues = (errors: Record<string, unknown>, locale: QfLocale, answers: Answers) => collect(errors, answers, taxIssueAdapter(locale));

/** An error key of the shared validator ("start.email" or "assets.banks[rowid].bank") as a form issue. */
export const issueFromKey = (key: string, locale: QfLocale, answers: Answers): Issue | null => issuesFromKeys([key], answers, taxIssueAdapter(locale))[0] || null;
