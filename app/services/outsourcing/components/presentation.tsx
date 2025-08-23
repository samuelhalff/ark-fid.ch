"use client";

import React from "react";

import {
  Users,
  Clock,
  Settings,
  Laptop,
  MessageSquare,
  CheckCircle,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import TranslatedText from "@/src/components/ui/translated-text";
import TranslatedTextArray from "@/src/components/ui/translated-text-array";
import { StylishList } from "@/src/components/ui/stylish-list";

const iconMap = [Users, Clock, Settings, Laptop, MessageSquare];

const OutsourcingPresentation = () => {
  const { t } = useTranslation();
  const listItemsRaw = t("Outsourcing.Presentation.Strengths", {
    returnObjects: true,
  }) as Array<{ Title: string; Desc: string }>;
  const listItems = listItemsRaw.map((item, idx) => ({
    ...item,
    icon: iconMap[idx]
      ? React.createElement(iconMap[idx], {
          className: "text-primary min-w-[22px]",
          size: 22,
        })
      : null,
  }));
  return (
    <section className="w-full flex justify-center py-16 sm:py-24 lg:py-32">
      <div className="w-full max-w-[1200px] px-4 sm:px-6">
        <div className="space-y-6 sm:space-y-8 mb-12 sm:mb-16">
          <TranslatedTextArray
            translationKey="Outsourcing.Presentation.Intro"
            fallbackText={[
              "We understand that managing back-office operations can be time-consuming and resource-intensive. Our comprehensive outsourcing solutions are designed to streamline your business processes and improve operational efficiency.",
              "By leveraging our expertise and Swiss precision, we help you focus on your core business while ensuring your administrative tasks are handled with utmost professionalism and attention to detail.",
            ]}
          />
        </div>
        <StylishList
          items={
            t("Outsourcing.Presentation.List", {
              returnObjects: true,
            }) as string[]
          }
          Icon={CheckCircle}
          iconClass="text-blue-400"
          bulletBg="bg-primary/5"
          className="mt-3 mb-8"
        />
        <div className="space-y-12 sm:space-y-16 lg:space-y-20">
          <section>
            <h3 className="text-2xl font-semibold mb-6">
              <TranslatedText
                translationKey="Outsourcing.Presentation.StrengthsTitle"
                fallbackText="Our strengths for your outsourcing"
              />
            </h3>
            <ul className="space-y-6 mt-4">
              {listItems.map((item, idx) => (
                <li
                  key={idx}
                  className="flex items-start gap-4 px-4 py-3 rounded-xl bg-muted/50 shadow-none hover:shadow-md transition-shadow"
                >
                  <span className="mt-1">{item.icon}</span>
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
          </section>
        </div>
      </div>
    </section>
  );
};

export default OutsourcingPresentation;
