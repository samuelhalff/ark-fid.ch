import React from "react";
const ExternalLinkIcon = (props: any) => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M18 13v6a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
    <path d="M15 3h6v6" />
    <path d="M10 14 21 3" />
  </svg>
);
import PartnerLogo from "./PartnerLogo";

interface Partner {
  title: string;
  description: string;
  website: string;
  logo?: string;
}

interface PartnersGridProps {
  partners: Partner[];
}

const PartnersGrid = ({ partners }: PartnersGridProps) => {
  return (
    <div className="grid md:grid-cols-2 gap-6">
      {partners.map((partner, index) => (
        <a
          key={index}
          href={partner.website}
          target="_blank"
          rel="noopener noreferrer"
          className="group block"
        >
          <div className="h-full rounded-xl bg-white p-6 shadow-md transition-colors duration-200 hover:bg-surface-warm dark:bg-gray-800 dark:hover:bg-card">
            <div className="flex items-center gap-4 mb-4">
              <div className="flex-shrink-0">
                <PartnerLogo logo={partner.logo} title={partner.title} />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-lg font-semibold leading-tight group-hover:text-brand-hover dark:group-hover:text-brand transition-colors text-gray-900 dark:text-white">
                  {partner.title}
                </h3>
              </div>
              <div className="flex-shrink-0">
                <ExternalLinkIcon className="w-5 h-5 text-gray-400 group-hover:text-brand-hover dark:group-hover:text-brand transition-colors" />
              </div>
            </div>

            <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
              {partner.description}
            </p>

            <div className="mt-4 rounded-full bg-surface-warm/70 px-3 py-2">
              <span className="text-sm text-brand-hover dark:text-brand font-medium group-hover:underline">
                Visit Website →
              </span>
            </div>
          </div>
        </a>
      ))}
    </div>
  );
};

export default PartnersGrid;
