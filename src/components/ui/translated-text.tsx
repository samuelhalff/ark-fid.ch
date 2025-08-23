"use client";

import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";

// This component wraps the logic, so you don't have to repeat it.
const TranslatedText = ({
  translationKey,
  fallbackText,
  ns,
}: {
  translationKey: string;
  fallbackText: string;
  ns: string;
}) => {
  const { t } = useTranslation(ns || "");
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  // Return the translated text if on the client, otherwise the fallback.

  return <>{isClient ? t(translationKey) : fallbackText}</>;
};

export default TranslatedText;
