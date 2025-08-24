"use client";

import React from "react";
import { Award, Users, Lightbulb, Handshake } from "lucide-react";
import TranslatedText from "@/src/components/ui/translated-text";
import { useTranslation } from "react-i18next";

const iconMap = [Award, Users, Lightbulb, Handshake];

export default function DNAValuesSection() {
  const { t } = useTranslation("aboutUs");

  // Get the translated values or use fallback
  const values = (t("DNA.Values", {
    returnObjects: true,
  }) as Array<{ Title: string; Desc: string }>) || [
    {
      Title: "Swiss Precision",
      Desc: "We embody traditional Swiss values of accuracy and reliability.",
    },
    {
      Title: "Innovation Forward",
      Desc: "We embrace cutting-edge technology and modern methodologies.",
    },
    {
      Title: "Client-Centric Approach",
      Desc: "Our diverse team provides tailored solutions for each client.",
    },
    {
      Title: "Collaborative Excellence",
      Desc: "Our culture of collaboration drives superior results.",
    },
  ];

  return (
    <section>
      <h3 className="text-xl xs:text-2xl md:text-2xl font-bold mb-4 md:leading-[2rem] tracking-tight">
        <TranslatedText
          ns="aboutUs"
          translationKey="DNA.Title"
          fallbackText="Our DNA"
        />
      </h3>
      <h4 className="text-lg font-semibold mb-8 text-muted-foreground">
        <TranslatedText
          ns="aboutUs"
          translationKey="DNA.Subtitle"
          fallbackText="The Values That Define Us"
        />
      </h4>
      <div className="space-y-6">
        {values.map((item, index) => (
          <div
            key={index}
            className="flex items-start gap-4 p-6 rounded-lg bg-primary/5"
          >
            {React.createElement(iconMap[index % iconMap.length], {
              className: "text-blue-400 mt-1 min-w-[24px]",
              size: 24,
            })}
            <div>
              <h5 className="font-semibold text-lg mb-2">{item.Title}</h5>
              <p className="text-base leading-relaxed text-muted-foreground">
                {item.Desc}
              </p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
