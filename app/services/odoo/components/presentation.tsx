"use client";

import { useTranslation } from "react-i18next";
import {
  CheckCircle,
  Settings,
  Laptop,
  MessageSquare,
  Users,
  Clock,
} from "lucide-react";
import React from "react";
import { StylishList } from "@/src/components/ui/stylish-list";
import TranslatedText from "@/src/components/ui/translated-text";

const OdooPresentation = () => {
  const { t } = useTranslation();
  return (
    <section className="w-full flex justify-center py-16 sm:py-24 lg:py-32">
      <div className="w-full max-w-[1200px] px-4 sm:px-6">
        <h1 className="max-w-3xl text-3xl xs:text-4xl md:text-5xl md:leading-14 font-bold tracking-tight mb-8 text-left w-full">
          <TranslatedText
            translationKey={"Odoo.Presentation.Title"}
            fallbackText={"Odoo Presentation"}
          />
        </h1>
        <h2 className="text-xl xs:text-2xl md:text-2xl font-bold mb-8 md:leading-8 tracking-tight">
          <TranslatedText
            translationKey={"Odoo.Presentation.Subtitle"}
            fallbackText={"Subtitle"}
          />
        </h2>
        {(
          t("Odoo.Presentation.Intro", { returnObjects: true }) as string[]
        ).map((text, idx) => (
          <p key={idx} className="mb-8 text-lg text-justify">
            {text}
          </p>
        ))}
        <StylishList
          items={
            t("Odoo.Presentation.List", { returnObjects: true }) as string[]
          }
          Icon={CheckCircle}
          iconClass="text-green-400"
          bulletBg="bg-primary/5"
          className="mt-3 mb-8"
        />
        <h3 className="text-2xl font-semibold mb-6">
          <TranslatedText
            translationKey={"Odoo.Presentation.StrengthsTitle"}
            fallbackText={"Strengths"}
          />
        </h3>
        {(() => {
          const iconMap = [Settings, Laptop, MessageSquare, Users, Clock];
          const strengths = t("Odoo.Presentation.Strengths", {
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
      </div>
    </section>
  );
};

export default OdooPresentation;
