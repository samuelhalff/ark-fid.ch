"use client";

import { useFormContext } from "react-hook-form";
import { NameChoices } from "@/src/components/questionnaire/NameChoices";
import { StepView as SharedStepView } from "@/src/components/questionnaire/StepView";
import { useSubScreen } from "@/src/components/questionnaire/SubScreen";
import { toName } from "@/src/lib/questionnaire/form-values";
import { getField, isBlockAsked } from "@/src/lib/kyc-questionnaire/engine";
import { choiceLabel, CONTACT_HEADING, contactChoices, contactFromPerson } from "@/src/lib/kyc-questionnaire/people";
import { declarations } from "@/src/lib/kyc-questionnaire/schema";
import { UI } from "@/src/lib/kyc-questionnaire/ui";
import type { Answers, GroupDef, KycLocale, StepDef } from "@/src/lib/kyc-questionnaire/types";
import { HoldersSection } from "./HoldersSection";

interface StepProps {
  step: StepDef;
  locale: KycLocale;
  answers: Answers;
  /** Ids (top-level fields and groups) pre-filled by Ark: shown as « déjà rempli, à vérifier » rows. */
  prefilled: Set<string>;
}

/** A KYC screen in the shared step view, with what only this form has: the holders tree, the declarations, the contact picked among the people above. */
export function StepView({ step, locale, answers, prefilled }: StepProps) {
  const { setValue } = useFormContext();
  // Blocks the holders component asks itself (section B of a company) are not fields of their own here.
  const asked = step.blocks.filter((b) => isBlockAsked(b, answers) && !((b.kind === "field" || b.kind === "group") && b.ui === "hidden"));
  // A company holder's own screen is open: it alone shows, the rest of the step waits behind it.
  const { open: subScreen } = useSubScreen();
  const blocks = subScreen ? asked.filter((b) => b.kind === "group" && b.ui === "holders") : asked;
  return (
    <SharedStepView
      blocks={blocks}
      answers={answers}
      prefilled={prefilled}
      fieldOf={getField}
      renderBlock={(block) => {
        if (block.kind === "group" && (block as GroupDef).ui === "holders") return <HoldersSection key={block.id} group={block as GroupDef} locale={locale} answers={answers} />;
        if (block.kind === "note" && block.id === "i.declarations") return <Declarations answers={answers} locale={locale} />;
        return undefined;
      }}
      headingExtra={(heading) =>
        heading.id === CONTACT_HEADING ? (
          <ContactChoices
            answers={answers}
            locale={locale}
            onPick={(values) => {
              for (const [id, value] of Object.entries(values)) setValue(toName(id), value, { shouldDirty: true, shouldValidate: true });
            }}
          />
        ) : null
      }
    />
  );
}

/** The contact person block, still empty: one tap names a person given above (a director), still editable. */
function ContactChoices({ answers, locale, onPick }: { answers: Answers; locale: KycLocale; onPick: (values: Answers) => void }) {
  const people = contactChoices(answers);
  if (!people.length) return null;
  return (
    <div className="pt-2">
      <NameChoices
        choices={people.map((person) => ({ key: person.key, label: choiceLabel(person, locale) }))}
        other={UI.otherPerson[locale]}
        onPick={(key) => {
          const person = people.find((p) => p.key === key);
          if (person) onPick(contactFromPerson(person));
        }}
      />
    </div>
  );
}

/** "i.declarations": the declarations of the client's form instead of the note's text. */
function Declarations({ answers, locale }: { answers: Answers; locale: KycLocale }) {
  const d = declarations(answers);
  return (
    <div className="flex flex-col gap-3 rounded-md bg-surface-warm p-4 text-sm leading-6 dark:bg-card">
      <p className="font-medium">{d.intro[locale]}</p>
      <ul className="list-disc space-y-1 pl-5">
        {d.items.map((item, i) => (
          <li key={i}>{item[locale]}</li>
        ))}
      </ul>
      <p className="text-muted-foreground">{d.closing[locale]}</p>
    </div>
  );
}
