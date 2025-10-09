import React from "react";
import { CheckCircle } from "lucide-react";

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
              <CheckCircle className="w-5 h-5 text-green-500" />
            </div>
            <p className="leading-relaxed">{benefit}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default BenefitsList;
