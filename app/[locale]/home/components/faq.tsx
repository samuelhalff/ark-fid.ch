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

const faq = [
  { questionKey: "Question1", answerKey: "Answer1" },
  { questionKey: "Question2", answerKey: "Answer2" },
  { questionKey: "Question3", answerKey: "Answer3" },
  { questionKey: "Question4", answerKey: "Answer4" },
  { questionKey: "Question5", answerKey: "Answer5" },
  { questionKey: "Question6", answerKey: "Answer6" },
  { questionKey: "Question7", answerKey: "Answer7" },
  { questionKey: "Question8", answerKey: "Answer8" },
  { questionKey: "Question9", answerKey: "Answer9" },
  { questionKey: "Question10", answerKey: "Answer10" },
  { questionKey: "Question11", answerKey: "Answer11" },
  { questionKey: "Question12", answerKey: "Answer12" },
];

const FAQ = () => {
  return (
    <div
      id="faq"
      className="w-full max-w-[var(--breakpoint-xl)] mx-auto py-8 xs:py-16 px-6 mb-10"
    >
      <h2 className="text-center text-3xl xs:text-4xl md:text-5xl leading-[1.15]! font-bold tracking-tighter max-w-4xl mx-auto">
        <TranslatedText ns="faq" translationKey="Title" fallbackText="FAQ" />
      </h2>
      <p className="mt-1.5 text-center xs:text-lg text-muted-foreground max-w-2xl mx-auto">
        <TranslatedText
          ns="faq"
          translationKey="Subtitle"
          fallbackText="Subtitle"
        />
      </p>

      <div className="min-h-[550px] md:min-h-[320px] xl:min-h-[300px]">
        <Accordion
          type="single"
          collapsible
          className="mt-8 space-y-4 md:columns-2 gap-4"
        >
          {faq.map(({ questionKey, answerKey }, index) => (
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
                  <PlusIcon className="h-5 w-5 shrink-0 text-muted-foreground transition-transform duration-200" />
                </AccordionPrimitive.Trigger>
              </AccordionPrimitive.Header>
              <AccordionContent className="text-[15px] text-left text-muted-foreground">
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
