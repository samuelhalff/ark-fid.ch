"use client";

import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
// import "@/src/i18n";

interface TranslatedTextArrayProps {
  translationKey: string;
  fallbackText?: string[];
  ns?: string;
  renderItem?: (text: string, index: number) => React.ReactNode;
  className?: string;
}

const TranslatedTextArray = ({
  translationKey,
  fallbackText = [],
  ns,
  className,
  renderItem = (text, index) => (
    <p key={index} className={`mb-8 text-lg text-justify ${className || ""}`}>
      {text}
    </p>
  ),
}: TranslatedTextArrayProps) => {
  const { t } = useTranslation(ns);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  // Get the translated array safely
  const getTranslatedArray = () => {
    if (!isClient) return fallbackText;

    const translation = t(translationKey, { returnObjects: true });
    if (!Array.isArray(translation)) {
      console.warn(
        `Translation key "${translationKey}" did not return an array`
      );
      return fallbackText;
    }

    return translation;
  };

  const textArray = getTranslatedArray();

  return <>{textArray.map((text, index) => renderItem(text, index))}</>;
};

export default TranslatedTextArray;
