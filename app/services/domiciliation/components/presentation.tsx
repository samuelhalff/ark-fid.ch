"use client";

import {
  ListChecks,
  CalendarCheck2,
  Users,
  Clock,
  ShieldCheck,
  Rocket,
  MessageSquare,
  CheckCircle,
} from "lucide-react";
import { StylishList } from "@/src/components/ui/stylish-list";
import TranslatedText from "@/src/components/ui/translated-text";
import TranslatedTextArray from "@/src/components/ui/translated-text-array";
import { useTranslation } from "react-i18next";
import React from "react";
import { convertRawToList } from "@/lib/utils";

const iconMap = [Users, Clock, ShieldCheck, Rocket, MessageSquare];

const DomiciliationPresentation = () => {
  const { t } = useTranslation();
  return (
    <section
      className="mx-auto w-full py-12 xs:py-20 px-6 flex flex-col items-center pt-25"
      id="presentation"
    >
      <h1 className="text-3xl xs:text-4xl md:text-5xl md:leading-[3.5rem] font-bold tracking-tight mb-8 text-left w-full">
        <TranslatedText
          translationKey="Domiciliation.Presentation.Title"
          fallbackText="Professional Domiciliation Services"
        />
      </h1>
      <div className="text-left w-full">
        <h2 className="text-xl xs:text-2xl md:text-2xl font-bold mb-8 md:leading-[2rem] tracking-tight">
          <TranslatedText
            translationKey="Domiciliation.Presentation.Subtitle"
            fallbackText="Your Swiss Business Address Solution"
          />
        </h2>
        <div className="space-y-6 mb-12">
          <TranslatedTextArray
            translationKey="Domiciliation.Presentation.Intro"
            fallbackText={[
              "Our domiciliation services provide your company with a prestigious Swiss address, mail handling, and compliance support. We help you establish a credible presence in Switzerland, whether you are a startup, SME, or international group.",
              "Benefit from our expertise in regulatory requirements and our commitment to confidentiality and efficiency.",
            ]}
          />
        </div>
        <StylishList
          items={
            t("Domiciliation.Presentation.List", {
              returnObjects: true,
            }) as string[]
          }
          Icon={CheckCircle}
          iconClass="text-blue-400"
          bulletBg="bg-primary/5"
          className="mt-3 mb-8"
        />
        <div className="space-y-12">
          <section>
            <h3 className="text-2xl font-semibold mb-6">
              <TranslatedText
                translationKey="Domiciliation.Presentation.StrengthsTitle"
                fallbackText="Our Domiciliation Strengths"
              />
            </h3>
            {(() => {
              const strengths = t("Domiciliation.Presentation.Strengths", {
                returnObjects: true,
              }) as Array<{ Title: string; Desc: string }>;
              return (
                <ul className="space-y-6 mt-4">
                  {strengths.map((item, idx) => (
                    <li
                      key={idx}
                      className="flex items-start gap-4 px-4 py-3 rounded-xl bg-muted/50 shadow-none hover:shadow-md transition-shadow"
                    >
                      <span className="mt-1">
                        {iconMap[idx]
                          ? React.createElement(iconMap[idx], {
                              className: "text-primary min-w-[22px]",
                              size: 22,
                            })
                          : null}
                      </span>
                      <div>
                        <span className="font-semibold text-lg text-gray-900 dark:text-gray-100">
                          {item.Title}
                        </span>
                        <span className="ml-1 text-lg text-gray-700 dark:text-gray-300">
                          : {item.Desc}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              );
            })()}
          </section>
        </div>
      </div>
    </section>
  );
};

export default DomiciliationPresentation;
