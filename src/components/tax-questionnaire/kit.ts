"use client";

import type { QuestionnaireKit } from "@/src/components/questionnaire/kit";
import { taxKit } from "@/src/lib/tax-questionnaire/kit";
import type { QfLocale } from "@/src/lib/tax-questionnaire/types";
import { taxFieldTypes } from "./field-types";

/** The tax kit of the shared components: its strings, labels with the tax year, and its own field types (commune, tax years). */
export const taxFormKit = (locale: QfLocale): QuestionnaireKit => ({ ...taxKit(locale), fieldTypes: taxFieldTypes(locale) });
