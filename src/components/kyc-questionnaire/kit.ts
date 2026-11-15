"use client";

import type { AskReply, QuestionnaireKit } from "@/src/components/questionnaire/kit";
import { displayValue } from "@/src/lib/kyc-questionnaire/engine";
import { kycKit } from "@/src/lib/kyc-questionnaire/kit";
import type { Answers, FieldDef, KycLocale } from "@/src/lib/kyc-questionnaire/types";
import { SERVER_ERRORS } from "@/src/lib/kyc-questionnaire/ui";
import { ApiError, api } from "./api";

/** The KYC kit of the shared components: its strings and wording, and the assistant behind the (i). */
export function kycFormKit(locale: KycLocale): QuestionnaireKit {
  return {
    ...kycKit(locale),
    ask: {
      send: (fieldId, question, answers) => api.caseAction<AskReply>("ask", { fieldId, question, answers: answers as Answers, language: locale }),
      display: (field, value) => displayValue(field as FieldDef, value, locale),
      errorText: (error) => (SERVER_ERRORS[error instanceof ApiError ? error.code : "generic"] || SERVER_ERRORS.assist_unavailable)[locale],
    },
  };
}
