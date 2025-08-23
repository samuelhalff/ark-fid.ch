"use client";

import {
  Building2,
  UserCheck,
  FileText,
  CheckCircle,
  Lightbulb,
} from "lucide-react";
import { StylishList } from "@/src/components/ui/stylish-list";
import { useTranslation } from "react-i18next";
import { convertRawToList } from "@/lib/utils";

const iconList = [Building2, UserCheck, FileText, CheckCircle, Lightbulb];

const CorporatePresentation = () => {
  const { t } = useTranslation();

  return (
    <section
      className="max-w-[100%] mx-auto w-full py-12 xs:py-20 px-4 sm:px-6 flex flex-col items-center pt-25"
      id="presentation"
    >
      <h1 className="text-3xl xs:text-4xl md:text-5xl md:leading-14 font-bold tracking-tight mb-8 text-left w-full">
        {t("Corporate.Presentation.Title")}
      </h1>
      <div className="text-left">
        <h2 className="text-xl xs:text-2xl md:text-2xl font-bold mb-8 md:leading-8 tracking-tight">
          {t("Corporate.Presentation.Subtitle")}
        </h2>
        {(
          t("Corporate.Presentation.Intro", { returnObjects: true }) as string[]
        ).map((text, idx) => (
          <p key={idx} className="mb-8 text-lg text-left">
            {text}
          </p>
        ))}
        <StylishList
          items={
            t("Corporate.Presentation.List", {
              returnObjects: true,
            }) as string[]
          }
          Icon={CheckCircle}
          iconClass="text-blue-400"
          bulletBg="bg-primary/5"
          className="mt-3 mb-8"
        />
        <section>
          <h3 className="text-2xl font-semibold mb-6">
            {t("Corporate.Presentation.StrengthsTitle")}
          </h3>
          <ul className="space-y-6 mt-4">
            {convertRawToList(
              t("Corporate.Presentation.Strengths", {
                returnObjects: true,
              }) as { Title: string; Desc: string }[]
            ).map((item, idx) => {
              const Icon = iconList[idx] || CheckCircle;
              return (
                <li
                  key={idx}
                  className="flex items-start gap-4 px-4 py-5 rounded-xl bg-muted/50 shadow-none hover:shadow-md transition-shadow"
                >
                  <span className="mt-1">
                    <Icon className="text-primary min-w-[22px]" size={22} />
                  </span>
                  <div>
                    <span className="font-semibold text-lg text-gray-900 dark:text-gray-100">
                      {t(item.Title)}
                    </span>
                    <span className="ml-1 text-lg text-gray-700 dark:text-gray-300">
                      : {t(item.Desc)}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      </div>
    </section>
  );
};

export default CorporatePresentation;
