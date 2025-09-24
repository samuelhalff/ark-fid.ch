"use client";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
} from "@/src/components/ui/accordion";
import { cn } from "@/src/lib/utils";
import * as AccordionPrimitive from "@radix-ui/react-accordion";
import { PlusIcon } from "lucide-react";

import TranslatedText from "@/src/components/ui/translated-text";
import { useTranslation } from "react-i18next";
import "@/src/i18n";

const faq = Array.from({ length: 16 }).map((_, i) => ({
  questionKey: `Question${i + 1}`,
  answerKey: `Answer${i + 1}`,
}));

const FAQ = () => {
  const { t } = useTranslation("faq");
  // Resolve and filter out empty or placeholder entries
  const items = faq
    .map(({ questionKey, answerKey }) => {
      const q = t(questionKey);
      const a = t(answerKey);
      return { questionKey, answerKey, q, a };
    })
    .filter(({ questionKey, answerKey, q, a }) => {
      const isMissingQ = !q || q === questionKey;
      const isMissingA = !a || a === answerKey;
      return !(isMissingQ || isMissingA);
    });

  return (
    <div
      id="faq"
      className="w-full max-w-[var(--breakpoint-xl)] mx-auto py-8 xs:py-16 px-6 mb-10"
    >
      <h2 className="text-center text-3xl xs:text-4xl md:text-5xl leading-[1.15]! font-bold tracking-tighter max-w-4xl mx-auto">
        <TranslatedText ns="faq" translationKey="Title" fallbackText="FAQ" />
      </h2>
      <p className="mt-1.5 text-center xs:text-lg max-w-2xl mx-auto">
        <TranslatedText
          ns="faq"
          translationKey="Subtitle"
          fallbackText="Subtitle"
        />
      </p>
      <p className="mt-1 text-center text-sm text-muted-foreground">
        <span>
          <TranslatedText
            ns="faq"
            translationKey="LastUpdated"
            fallbackText="dernière mise à jour"
          />
        </span>{" "}
        <span suppressHydrationWarning>
          {new Intl.DateTimeFormat(undefined, {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
          }).format(new Date())}
        </span>
      </p>

      <div className="min-h-[550px] md:min-h-[320px] xl:min-h-[300px]">
        <Accordion
          type="single"
          collapsible
          className="mt-8 space-y-4 md:columns-2 gap-4"
        >
          {items.map(({ questionKey, answerKey }, index) => (
            <AccordionItem
              key={questionKey}
              value={`question-${index}`}
              className="bg-accent py-1 px-4 rounded-xl border-none mt-0! mb-4! break-inside-avoid"
            >
              <AccordionPrimitive.Header className="flex">
                <AccordionPrimitive.Trigger
                  className={cn(
                    "flex flex-1 items-center justify-between py-4 font-semibold tracking-tight transition-all hover:underline [&[data-state=open]>svg]:rotate-45",
                    "text-start text-lg"
                  )}
                >
                  <TranslatedText
                    ns="faq"
                    translationKey={questionKey}
                    fallbackText={questionKey.replace("", "")}
                  />
                  <PlusIcon className="h-5 w-5 shrink-0 transition-transform duration-200" />
                </AccordionPrimitive.Trigger>
              </AccordionPrimitive.Header>
              <AccordionContent className="text-[15px] text-left">
                <TranslatedText
                  ns="faq"
                  translationKey={answerKey}
                  fallbackText={answerKey.replace("", "")}
                />
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </div>
  );
};

export default FAQ;
