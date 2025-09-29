"use client";

import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import "@/src/i18n";

interface TranslatedObjectArrayProps {
  ns: string;
  translationKey: string;
  fallbackItems: Array<{ Title: string; Desc: string }>;
  renderItem: (
    item: { Title: string; Desc: string },
    index: number
  ) => React.ReactNode;
  className?: string;
}

const TranslatedObjectArray = ({
  ns,
  translationKey,
  fallbackItems,
  renderItem,
  className,
}: TranslatedObjectArrayProps) => {
  const { t } = useTranslation(ns);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  if (!isClient) {
    // Return fallback items during SSR
    return (
      <div className={className}>
        {fallbackItems.map((item, index) => renderItem(item, index))}
      </div>
    );
  }

  // Get the array of objects from translation
  const items = t(translationKey, { returnObjects: true }) as Array<{
    Title: string;
    Desc: string;
  }>;

  // Fallback to default items if translation fails or returns invalid data
  const validItems = Array.isArray(items) ? items : fallbackItems;

  return (
    <div className={className}>
      {validItems.map((item, index) => renderItem(item, index))}
    </div>
  );
};

export default TranslatedObjectArray;
