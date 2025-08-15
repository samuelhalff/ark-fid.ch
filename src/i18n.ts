import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import enJSON from "@/translations/en.json";
import frJSON from "@/translations/fr.json";
import esJSON from "@/translations/es.json";
import deJSON from "@/translations/de.json";
import detector from "i18next-browser-languagedetector";
import Backend from "i18next-http-backend";

i18n
  .use(detector)
  .use(Backend)
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
