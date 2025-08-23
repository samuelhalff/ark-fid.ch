"use client";

import {
  Building2,
  UserCheck,
  FileText,
  CheckCircle,
  Lightbulb,
} from "lucide-react";
import { StylishList } from "@/src/components/ui/stylish-list";
import TranslatedText from "@/src/components/ui/translated-text";
import TranslatedTextArray from "@/src/components/ui/translated-text-array";
import { useTranslation } from "react-i18next";
import { convertRawToList } from "@/lib/utils";

const iconList = [Building2, UserCheck, FileText, CheckCircle, Lightbulb];

const CorporatePresentation = () => {
  const { t } = useTranslation("corporate");

  return (
    <section
      className="max-w-[100%] mx-auto w-full py-12 xs:py-20 px-4 sm:px-6 flex flex-col items-center pt-25"
      id="presentation"
    >
      <h1 className="text-3xl xs:text-4xl md:text-5xl md:leading-14 font-bold tracking-tight mb-8 text-left w-full">
        <TranslatedText
          ns="corporate"
          translationKey="Presentation.Title"
          fallbackText="Corporate Services"
        />
      </h1>
      <div className="text-left">
        <h2 className="text-xl xs:text-2xl md:text-2xl font-bold mb-8 md:leading-8 tracking-tight">
          <TranslatedText
            ns="corporate"
            translationKey="Presentation.Subtitle"
            fallbackText="Expert Corporate Services"
          />
        </h2>
        <TranslatedTextArray
          ns="corporate"
          translationKey="Presentation.Intro"
          fallbackText={["Corporate services description"]}
          renderItem={(text, idx) => (
            <p key={idx} className="mb-8 text-lg text-left">
              {text}
            </p>
          )}
        />
        <StylishList
          items={
            t("Presentation.List", {
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
            <TranslatedText
              ns="corporate"
              translationKey="Presentation.StrengthsTitle"
              fallbackText="Our Strengths"
            />
          </h3>
          <ul className="space-y-6 mt-4">
            {convertRawToList(
              t("Presentation.Strengths", {
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
                      <TranslatedText
                        ns="corporate"
                        translationKey={item.Title}
                        fallbackText="Service title"
                      />
                    </span>
                    <span className="ml-1 text-lg text-gray-700 dark:text-gray-300">
                      :{" "}
                      <TranslatedText
                        ns="corporate"
                        translationKey={item.Desc}
                        fallbackText="Service description"
                      />
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
