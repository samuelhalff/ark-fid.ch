import React from "react";
import {
  FileText,
  Scales,
  ShieldCheck,
  TrendUp,
} from "@phosphor-icons/react/dist/ssr";

interface ServiceArea {
  title: string;
  description: string;
}

interface ServiceAreasGridProps {
  serviceAreas: ServiceArea[];
}

const ServiceAreasGrid = ({ serviceAreas }: ServiceAreasGridProps) => {
  const icons = [Scales, ShieldCheck, TrendUp, FileText];

  return (
    <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
      {serviceAreas.map((area, index) => {
        const Icon = icons[index] || FileText;

        return (
          <div
            key={index}
            className="rounded-xl bg-white p-6 shadow-md transition-colors duration-200 hover:bg-surface-warm dark:bg-gray-800 dark:hover:bg-card"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="flex-shrink-0">
                <div className="w-10 h-10 bg-primary-50 dark:bg-gray-900/20 rounded-lg flex items-center justify-center">
                  <Icon className="w-5 h-5 text-primary-600 dark:text-grey-400" />
                </div>
              </div>
              <h3 className="text-lg font-semibold leading-tight text-gray-900 dark:text-white">
                {area.title}
              </h3>
            </div>

            <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
              {area.description}
            </p>
          </div>
        );
      })}
    </div>
  );
};

export default ServiceAreasGrid;
