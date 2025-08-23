"use client";

import TranslatedText from "@/src/components/ui/translated-text";
import { useTranslation } from "react-i18next";
import { CheckCircle } from "lucide-react";
import TranslatedTextArray from "@/src/components/ui/translated-text-array";
import { StylishList } from "@/src/components/ui/stylish-list";

interface ServiceItem {
  Title: string;
  Desc: string;
}

const PayrollPresentation = () => {
  const { t } = useTranslation();

  const services = t("Payroll.Presentation.Services", {
    returnObjects: true,
  }) as ServiceItem[];

  return (
    <section
      className="w-full flex justify-center py-16 sm:py-24 lg:py-32"
      id="presentation"
    >
      <div className="w-full max-w-[1200px] px-4 sm:px-6">
        <h1 className="max-w-3xl text-3xl xs:text-4xl md:text-5xl md:leading-14 font-bold tracking-tight mb-8 text-left w-full">
          <TranslatedText
            translationKey="Payroll.Presentation.Title"
            fallbackText="Payroll Presentation"
          />
        </h1>
        <h2 className="text-xl xs:text-2xl md:text-2xl font-bold mb-8 md:leading-8 tracking-tight">
          <TranslatedText
            translationKey="Payroll.Presentation.Subtitle"
            fallbackText="Subtitle"
          />
        </h2>
        <TranslatedTextArray
          translationKey="Payroll.Presentation.Intro"
          fallbackText={["Welcome to our Payroll Services"]}
        />
        <StylishList
          items={
            t("Payroll.Presentation.List", {
              returnObjects: true,
            }) as string[]
          }
          Icon={CheckCircle}
          iconClass="text-blue-400"
          bulletBg="bg-primary/5"
          className="mt-3 mb-8"
        />
        <div className="space-y-6 mt-4">
          {services.map((item, idx) => (
            <div
              key={idx}
              className="flex items-start gap-4 px-4 py-3 rounded-xl bg-muted/50 shadow-none hover:shadow-md transition-shadow"
            >
              <span className="mt-1">
                <CheckCircle className="text-primary min-w-[22px]" size={22} />
              </span>
              <div>
                <span className="font-semibold text-lg text-gray-900 dark:text-gray-100">
                  {item.Title}
                </span>
                <span className="ml-1 text-lg text-gray-700 dark:text-gray-300">
                  : {item.Desc}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default PayrollPresentation;
