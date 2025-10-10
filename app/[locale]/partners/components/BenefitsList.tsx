import React from "react";
const CheckIcon = (props: any) => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M9 12l2 2 4-4" />
    <circle cx="12" cy="12" r="9" />
  </svg>
);

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
