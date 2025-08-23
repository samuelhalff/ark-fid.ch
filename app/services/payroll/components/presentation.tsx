"use client";

import TranslatedText from "@/src/components/ui/translated-text";
import { CheckCircle } from "lucide-react";
import TranslatedTextArray from "@/src/components/ui/translated-text-array";

const PayrollPresentation = () => {
  return (
    <section
      className="w-full flex justify-center py-16 sm:py-24 lg:py-32"
      id="presentation"
    >
      <div className="w-full max-w-[1200px] px-4 sm:px-6">
        <h1 className="max-w-3xl text-3xl xs:text-4xl md:text-5xl md:leading-14 font-bold tracking-tight mb-8 text-left w-full">
          <TranslatedText
            ns="payroll"
            translationKey="Presentation.Title"
            fallbackText="Payroll Presentation"
          />
        </h1>
        <h2 className="text-xl xs:text-2xl md:text-2xl font-bold mb-8 md:leading-8 tracking-tight">
          <TranslatedText
            ns="payroll"
            translationKey="Presentation.Subtitle"
            fallbackText="Subtitle"
          />
        </h2>
        <TranslatedTextArray
          ns="payroll"
          translationKey="Presentation.Intro"
          fallbackText={["Welcome to our Payroll Services"]}
        />
        <div className="mt-3 mb-8">
          <TranslatedTextArray
            ns="payroll"
            translationKey="Presentation.List"
            fallbackText={["List item 1", "List item 2", "List item 3"]}
            renderItem={(text, index) => (
              <div
                key={index}
                className="flex items-start gap-3 px-4 py-2 rounded-lg bg-primary/5 mb-2"
              >
                <CheckCircle
                  className="text-blue-400 mt-1 min-w-[18px]"
                  size={18}
                />
                <span className="text-base">{text}</span>
              </div>
            )}
          />
        </div>
        <div className="space-y-6 mt-4">
          <TranslatedTextArray
            ns="payroll"
            translationKey="Presentation.Services"
            fallbackText={[
              "Service 1: Description",
              "Service 2: Description",
              "Service 3: Description",
            ]}
            renderItem={(text, idx) => {
              const [title, ...descParts] = text.split(":");
              const desc = descParts.join(":").trim();
              return (
                <div
                  key={idx}
                  className="flex items-start gap-4 px-4 py-3 rounded-xl bg-muted/50 shadow-none hover:shadow-md transition-shadow"
                >
                  <span className="mt-1">
                    <CheckCircle
                      className="text-primary min-w-[22px]"
                      size={22}
                    />
                  </span>
                  <div>
                    <span className="font-semibold text-lg text-gray-900 dark:text-gray-100">
                      {title}
                    </span>
                    {desc && (
                      <span className="ml-1 text-lg text-gray-700 dark:text-gray-300">
                        : {desc}
                      </span>
                    )}
                  </div>
                </div>
              );
            }}
          />
        </div>
      </div>
    </section>
  );
};

export default PayrollPresentation;
