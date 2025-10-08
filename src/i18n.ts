/**
 * Dynamic i18n configuration using lazy-loaded translation imports
 * 
 * This approach uses dynamic imports instead of http-backend to:
 * - Work with Next.js SSR/SSG
 * - Split translations into separate chunks
 * - Load only required locale and namespaces
 * - Reduce initial bundle by ~660KB
 * 
 * Strategy:
 * 1. Import translations dynamically via import()
 * 2. Use webpack's code splitting to create separate chunks
 * 3. Load translations on-demand per locale/namespace
 */

import i18n from "i18next";
import { initReactI18next } from "react-i18next";

// Available namespaces
export const namespaces = [
  "aboutUs",
  "accounting",
  "contact",
  "corporate",
  "domiciliation",
  "faq",
  "footer",
  "home",
  "legal",
  "navbar",
  "odoo",
  "outsourcing",
  "partners",
  "payroll",
  "ressources",
  "services",
  "servicesItems",
  "taxes",
  "team",
  "testimonials",
  "incorporation",
  "cookie",
  "family-office",
] as const;

// Dynamic translation loader
const loadTranslation = async (locale: string, namespace: string) => {
  try {
    // Use dynamic import to load translation file
    // Webpack will automatically code-split these
    const translation = await import(
      /* webpackChunkName: "translations-[request]" */
      `@/src/translations/${locale}/${namespace}.json`
    );
    return translation.default || translation;
  } catch (error) {
    console.error(`Failed to load translation: ${locale}/${namespace}`, error);
    return {};
  }
};

// Custom backend plugin for dynamic imports
const DynamicBackend = {
  type: "backend" as const,
  
  init: function(_services: any, _backendOptions: any, _i18nextOptions: any) {
    // No initialization needed
  },
  
  read: async function(language: string, namespace: string, callback: (err: Error | null, data?: any) => void) {
    try {
      const data = await loadTranslation(language, namespace);
      callback(null, data);
    } catch (error) {
      callback(error as Error);
    }
  },
};

// Get initial language from pathname (browser) or default to 'fr'
const getInitialLang = () => {
  if (typeof window === "undefined") return "fr"; // SSR default
  try {
    const segments = window.location.pathname.split("/").filter(Boolean);
    const potential = segments[0];
    const valid = ["en", "fr", "de", "es", "pt"];
    return valid.includes(potential) ? potential : "fr";
  } catch {
    return "fr";
  }
};

const initialLng = getInitialLang();

// Initialize i18next with dynamic backend
i18n
  .use(DynamicBackend as any)
  .use(initReactI18next)
  .init({
    lng: initialLng,
    fallbackLng: "fr",
    supportedLngs: ["de", "en", "fr", "es", "pt"],
    
    // Preload only critical namespaces
    ns: ["home", "navbar", "footer"],
    defaultNS: "home",
    
    interpolation: {
      escapeValue: false, // React already escapes
    },
    
    // Performance optimizations
    load: "currentOnly", // Don't load fallback locale
    
    react: {
      useSuspense: false,
    },
    
    // Disable debug in production for cleaner logs
    debug: false,
  });

export default i18n;
