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
import React, { useState, useEffect } from "react";
import { StylishList } from "@/src/components/ui/stylish-list";
import TranslatedText from "@/src/components/ui/translated-text";

const OdooPresentation = () => {
  // 1. CRITICAL CHANGE: Tell useTranslation to use the 'odoo' namespace.
  //    This corresponds to the `odoo` variable in your i18n.ts config.
  const { t } = useTranslation("odoo");

  // 2. The isClient guard is still essential for hydration safety.
  const [isClient, setIsClient] = useState(false);
  useEffect(() => {
    setIsClient(true);
  }, []);

  // 3. These calls now correctly fetch the data because `t()` is scoped to the right file.
  const introParagraphs = isClient
    ? (t("Presentation.Intro", { returnObjects: true }) as string[])
    : [];
  const listItems = isClient
    ? (t("Presentation.List", { returnObjects: true }) as string[])
    : [];
  const strengths = isClient
    ? (t("Presentation.Strengths", { returnObjects: true }) as Array<{
        Title: string;
        Desc: string;
      }>)
    : [];

  const iconMap = [Settings, Laptop, MessageSquare, Users, Clock];

  // The rest of your component logic remains the same.
  return (
    <section className="w-full flex justify-center py-16 sm:py-24 lg:py-32">
      <div className="w-full max-w-[1200px] px-4 sm:px-6">
        <h1 className="max-w-3xl text-3xl xs:text-4xl md:text-5xl md:leading-14 font-bold tracking-tight mb-8 text-left w-full">
          {/* 
            4. IMPORTANT: For TranslatedText, you must now use the namespace syntax with a colon (:)
               because it uses its own `useTranslation` hook internally.
          */}
          <TranslatedText
            ns="odoo"
            translationKey="Presentation.Title"
            fallbackText="Odoo Presentation"
          />
        </h1>
        <h2 className="text-xl xs:text-2xl md:text-2xl font-bold mb-8 md:leading-8 tracking-tight">
          <TranslatedText
            ns="odoo"
            translationKey="Presentation.Subtitle"
            fallbackText="Subtitle"
          />
        </h2>

        {introParagraphs.map((text, idx) => (
          <p key={idx} className="mb-8 text-lg text-justify">
            {text}
          </p>
        ))}

        <StylishList
          items={listItems}
          Icon={CheckCircle}
          iconClass="text-green-400"
          bulletBg="bg-primary/5"
          className="mt-3 mb-8"
        />
        <h3 className="text-2xl font-semibold mb-6">
          <TranslatedText
            ns="odoo"
            translationKey="Presentation.StrengthsTitle"
            fallbackText="Strengths"
          />
        </h3>
        <ul className="space-y-6 mt-4">
          {strengths.map((item, idx) => (
            <li key={idx} className="flex items-start gap-4 px-4 py-3 ...">
              <span className="mt-1">
                {iconMap[idx]
                  ? React.createElement(iconMap[idx], {
                      className: "text-primary min-w-[22px]",
                      size: 22,
                    })
                  : null}
              </span>
              <div>
                <span className="font-semibold text-lg ...">{item.Title}</span>
                <span className="ml-1 text-lg ...">: {item.Desc}</span>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
};

export default OdooPresentation;
