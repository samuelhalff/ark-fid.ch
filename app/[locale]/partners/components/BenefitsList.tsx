import React from "react";
import { CheckCircle as CheckIcon } from "@phosphor-icons/react/dist/ssr";

interface BenefitsListProps {
  benefits: string[];
}

const BenefitsList = ({ benefits }: BenefitsListProps) => {
  return (
    <div className="max-w-4xl mx-auto">
      <div className="grid gap-4">
        {benefits.map((benefit, index) => (
          <div key={index} className="flex items-center gap-3">
            <div className="flex-shrink-0">
              <CheckIcon className="w-5 h-5 text-green-500" />
            </div>
            <p className="leading-relaxed">{benefit}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default BenefitsList;
