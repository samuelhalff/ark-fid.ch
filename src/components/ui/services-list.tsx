"use client";

import { LucideIcon } from "lucide-react";
import TranslatedTextArray from "./translated-text-array";
import ServiceCard from "./service-card";

interface ServicesListProps {
  ns: string;
  translationKey: string;
  fallbackText: string[];
  iconMap: LucideIcon[];
  className?: string;
}

const ServicesList = ({
  ns,
  translationKey,
  fallbackText,
  iconMap,
  className = "space-y-6 mt-4",
}: ServicesListProps) => {
  return (
    <div className={className}>
      <TranslatedTextArray
        ns={ns}
        translationKey={translationKey}
        fallbackText={fallbackText}
        renderItem={(text, idx) => (
          <ServiceCard key={idx} text={text} index={idx} iconMap={iconMap} />
        )}
      />
    </div>
  );
};

export default ServicesList;
