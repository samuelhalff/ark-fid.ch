"use client";
import React from "react";
import { ExternalLink, Users } from "lucide-react";
import { useTranslation } from "react-i18next";
import Image from "next/image";

interface Partner {
  title: string;
  description: string;
  website: string;
  logo?: string;
}

const PartnersGrid = () => {
  const { t } = useTranslation("partners");
  const partners = (t("Partners", { returnObjects: true }) as Partner[]) || [];

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
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md hover:shadow-xl hover:shadow-blue-100 dark:hover:shadow-blue-900/20 transition-all duration-300 hover:scale-[1.02] p-6 h-full">
            <div className="flex items-center gap-4 mb-4">
              <div className="flex-shrink-0">
                {partner.logo ? (
                  <div className="w-12 h-12 p-3 bg-white dark:bg-gray-900/50 rounded-lg flex items-center justify-center transition-colors overflow-hidden">
                    <Image
                      src={partner.logo}
                      alt={`${partner.title} logo`}
                      width={40}
                      height={40}
                      className="object-contain"
                      onError={(e) => {
                        // Fallback to icon if logo fails to load
                        e.currentTarget.style.display = "none";
                        e.currentTarget.nextElementSibling?.classList.remove(
                          "hidden"
                        );
                      }}
                    />
                    <Users className="w-6 h-6 text-blue-600 dark:text-blue-400 hidden" />
                  </div>
                ) : (
                  <div className="w-12 h-12 bg-blue-50 dark:bg-blue-900/20 rounded-lg flex items-center justify-center group-hover:bg-blue-100 dark:group-hover:bg-blue-900/30 transition-colors">
                    <Users className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-lg font-semibold leading-tight group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors text-gray-900 dark:text-white">
                  {partner.title}
                </h3>
              </div>
              <div className="flex-shrink-0">
                <ExternalLink className="w-5 h-5 text-gray-400 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors" />
              </div>
            </div>

            <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
              {partner.description}
            </p>

            <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
              <span className="text-sm text-blue-600 dark:text-blue-400 font-medium group-hover:underline">
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
