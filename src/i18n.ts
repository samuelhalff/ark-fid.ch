import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import aboutUs from "@/src/translations/en/about-us.json";
import accounting from "@/src/translations/en/accounting.json";
import contact from "@/src/translations/en/contact.json";
import corporate from "@/src/translations/en/corporate.json";
import domiciliation from "@/src/translations/en/domiciliation.json";
import faq from "@/src/translations/en/faq.json";
import footer from "@/src/translations/en/footer.json";
import home from "@/src/translations/en/home.json";
import legal from "@/src/translations/en/legal.json";
import navbar from "@/src/translations/en/navbar.json";
import odoo from "@/src/translations/en/odoo.json";
import outsourcing from "@/src/translations/en/outsourcing.json";
import partners from "@/src/translations/en/partners.json";
import payroll from "@/src/translations/en/payroll.json";
import ressources from "@/src/translations/en/ressources.json";
import services from "@/src/translations/en/services.json";
import servicesItems from "@/src/translations/en/servicesItems.json";
import taxes from "@/src/translations/en/taxes.json";
import team from "@/src/translations/en/team.json";
import testimonials from "@/src/translations/en/testimonials.json";
import frJSON from "@/src/translations/fr.json";
import esJSON from "@/src/translations/es.json";
import deJSON from "@/src/translations/de.json";
import detector from "i18next-browser-languagedetector";

// Collect all English translations
const englishTranslations = {
  aboutUs,
  accounting,
  contact,
  corporate,
  domiciliation,
  faq,
  footer,
  home,
  legal,
  navbar,
  odoo,
  outsourcing,
  partners,
  payroll,
  ressources,
  services,
  servicesItems,
  taxes,
  team,
  testimonials,
};

i18n
  .use(detector)
  .use(initReactI18next)
  .init({
    supportedLngs: ['de', 'en', 'fr', 'es'],
    fallbackLng: 'en',
    //ns: Object.keys(englishTranslations),
    interpolation: {
      escapeValue: false,
    },
    resources: {
      en: englishTranslations,
      fr: { ...frJSON },
      de: { ...deJSON },
      es: { ...esJSON },
    },
  });
