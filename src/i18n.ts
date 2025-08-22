import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import enJSON from "@/src/translations/en.json";
import frJSON from "@/src/translations/fr.json";
import esJSON from "@/src/translations/es.json";
import deJSON from "@/src/translations/de.json";
import detector from "i18next-browser-languagedetector";

i18n
  .use(detector)
  .use(initReactI18next)
  .init({
    supportedLngs: ['de', 'en', 'fr', 'es'],
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false,
    },
    resources: {
      en: { ...enJSON },
      fr: { ...frJSON },
      de: { ...deJSON },
      es: { ...esJSON },
    },
  });
