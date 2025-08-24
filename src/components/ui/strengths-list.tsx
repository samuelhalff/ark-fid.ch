"use client";

import { LucideIcon } from "lucide-react";
import TranslatedObjectArray from "./translated-object-array";
import ServiceCard from "./service-card";
import React from "react";

interface StrengthsListProps {
  ns: string;
  translationKey: string;
  fallbackItems: Array<{ Title: string; Desc: string }>;
  iconMap: LucideIcon[];
  className?: string;
}

const StrengthsList = ({
  ns,
  translationKey,
  fallbackItems,
  iconMap,
  className = "space-y-6 mt-4",
}: StrengthsListProps) => {
  return (
    <div className={className}>
      <TranslatedObjectArray
        ns={ns}
        translationKey={translationKey}
        fallbackItems={fallbackItems}
        renderItem={(item, index) => {
          // Convert object format to ServiceCard's expected string format
          const text = `${item.Title}: ${item.Desc}`;
          return (
            <ServiceCard
              key={index}
              text={text}
              index={index}
              iconMap={iconMap}
            />
          );
        }}
      />
    </div>
  );
};

export default StrengthsList;
