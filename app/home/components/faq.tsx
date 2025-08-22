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
  { questionKey: "FAQ.Question1", answerKey: "FAQ.Answer1" },
  { questionKey: "FAQ.Question2", answerKey: "FAQ.Answer2" },
  { questionKey: "FAQ.Question3", answerKey: "FAQ.Answer3" },
  { questionKey: "FAQ.Question4", answerKey: "FAQ.Answer4" },
  { questionKey: "FAQ.Question5", answerKey: "FAQ.Answer5" },
  { questionKey: "FAQ.Question6", answerKey: "FAQ.Answer6" },
  { questionKey: "FAQ.Question7", answerKey: "FAQ.Answer7" },
  { questionKey: "FAQ.Question8", answerKey: "FAQ.Answer8" },
  { questionKey: "FAQ.Question9", answerKey: "FAQ.Answer9" },
  { questionKey: "FAQ.Question10", answerKey: "FAQ.Answer10" },
  { questionKey: "FAQ.Question11", answerKey: "FAQ.Answer11" },
  { questionKey: "FAQ.Question12", answerKey: "FAQ.Answer12" },
];

const FAQ = () => {
  return (
    <div
      id="faq"
      className="w-full max-w-(--breakpoint-xl) mx-auto py-8 xs:py-16 px-6 mb-10"
    >
      <h2 className="md:text-center text-3xl xs:text-4xl md:text-5xl leading-[1.15]! font-bold tracking-tighter">
        <TranslatedText translationKey="Home.FAQ.Title" fallbackText="FAQ" />
      </h2>
      <p className="mt-1.5 md:text-center xs:text-lg text-muted-foreground">
        <TranslatedText
          translationKey="Home.FAQ.Subtitle"
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
                    translationKey={questionKey}
                    fallbackText={questionKey.replace("FAQ.", "")}
                  />
                  <PlusIcon className="h-5 w-5 shrink-0 text-muted-foreground transition-transform duration-200" />
                </AccordionPrimitive.Trigger>
              </AccordionPrimitive.Header>
              <AccordionContent className="text-[15px] text-left text-muted-foreground">
                <TranslatedText
                  translationKey={answerKey}
                  fallbackText={answerKey.replace("FAQ.", "")}
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
