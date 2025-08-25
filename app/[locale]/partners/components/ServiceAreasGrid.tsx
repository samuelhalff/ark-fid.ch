"use client";
import React from "react";
import { Shield, Scale, TrendingUp, FileCheck } from "lucide-react";
import { useTranslation } from "react-i18next";

interface ServiceArea {
  title: string;
  description: string;
}

const ServiceAreasGrid = () => {
  const { t } = useTranslation("partners");
  const serviceAreas =
    (t("ServiceAreas.Areas", { returnObjects: true }) as ServiceArea[]) || [];
  const icons = [Scale, Shield, TrendingUp, FileCheck];

  return (
    <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
      {serviceAreas.map((area, index) => {
        const Icon = icons[index] || FileCheck;

        return (
          <div
            key={index}
            className="bg-white dark:bg-gray-800 rounded-xl shadow-md hover:shadow-lg hover:shadow-blue-100 dark:hover:shadow-blue-900/20 transition-all duration-300 p-6 border border-gray-100 dark:border-gray-700 hover:border-blue-200 dark:hover:border-primary-800"
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
