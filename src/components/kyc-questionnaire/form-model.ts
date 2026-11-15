"use client";

/** The KYC schema plugged into the shared form model (src/lib/questionnaire): labels, rows, the holders component. */
import { validateStep, type FieldError } from "@/src/lib/kyc-questionnaire/engine";
import { kycIssueAdapter } from "@/src/lib/kyc-questionnaire/kit";
import { FIELD_ERRORS } from "@/src/lib/kyc-questionnaire/ui";
import type { Answers, KycLocale, StepDef } from "@/src/lib/kyc-questionnaire/types";
import { collectIssues as collect, issuesFromKeys as fromKeys, stepSchema as schema } from "@/src/lib/questionnaire/issues";

import { fromForm as valuesToAnswers, type FormValues } from "@/src/lib/questionnaire/form-values";

export { focusField, toForm, toId, toName, type FormValues } from "@/src/lib/questionnaire/form-values";

/** Form values back to answers (empty values dropped). */
export const fromForm = (values: FormValues): Answers => valuesToAnswers<Answers>(values);
export type { Issue } from "@/src/lib/questionnaire/issues";
export { stepOfKey } from "@/src/lib/kyc-questionnaire/engine";

/** zod schema for one screen. The route is the server's (Ark's choice): it decides the branching, never the form. */
export const stepSchema = (step: StepDef, locale: KycLocale, route: string) =>
  schema((a) => validateStep(step, a as Answers), (code) => FIELD_ERRORS[code as FieldError]?.[locale], { route });

export const collectIssues = (errors: Record<string, unknown>, locale: KycLocale, answers: Answers) => collect(errors, answers, kycIssueAdapter(locale));

/** Error keys of the server (422 invalid_answers) as form issues. */
export const issuesFromKeys = (keys: string[], locale: KycLocale, answers: Answers) => fromKeys(keys, answers, kycIssueAdapter(locale));
