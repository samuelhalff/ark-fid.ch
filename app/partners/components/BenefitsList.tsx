"use client";
import React from "react";
import { CheckCircle } from "lucide-react";
import { useTranslation } from "react-i18next";

const BenefitsList = () => {
  const { t } = useTranslation("partners");
  const benefits =
    (t("Partnership.Benefits", { returnObjects: true }) as string[]) || [];

  return (
    <div className="max-w-4xl mx-auto">
      <div className="grid gap-4">
        {benefits.map((benefit, index) => (
          <div key={index} className="flex items-center gap-3">
            <div className="flex-shrink-0">
              <CheckCircle className="w-5 h-5 text-green-500" />
            </div>
            <p className="text-muted-foreground leading-relaxed">{benefit}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default BenefitsList;
