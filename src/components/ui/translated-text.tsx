"use client";

import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";

// This component wraps the logic, so you don't have to repeat it.
const TranslatedText = ({
  translationKey,
  fallbackText,
}: {
  translationKey: string;
  fallbackText: string;
}) => {
  const { t } = useTranslation();
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  // Return the translated text if on the client, otherwise the fallback.
  return <>{isClient ? t(translationKey) : fallbackText}</>;
};

export default TranslatedText;
