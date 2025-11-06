import type { Locale } from "./i18n-locales";

// Base-to-localized path mapping per locale.
// Only French is localized for service slugs for now; others fall back to English.
const frMap: Record<string, string> = {
  "/": "/",
  "/services": "/services",
  "/services/accounting": "/services/comptabilite",
  "/services/taxes": "/services/fiscalite",
  "/services/payroll": "/services/paie",
  "/services/outsourcing": "/services/externalisation",
  "/services/mergers-acquisitions": "/services/fusions-acquisitions",
  "/services/corporate": "/services/services-corporatifs",
  "/services/domiciliation": "/services/domiciliation",
  "/services/incorporation": "/services/constitution-entreprise",
  "/services/odoo": "/services/odoo",
  "/services/family-office": "/services/family-office",
};

const identity = (p: string) => p;

const maps: Record<Locale, (p: string) => string> = {
  en: identity,
  fr: (p: string) => frMap[p] || p,
  de: identity,
  es: identity,
  pt: identity,
};

// Localize a base path (e.g., "/services/accounting") to a locale-specific slug.
export function localizePath(path: string, locale: Locale): string {
  const normalize = (s: string) => (s.endsWith("/") && s !== "/" ? s.slice(0, -1) : s);
  const key = normalize(path);
  const mapper = maps[locale] || identity;
  const localized = mapper(key);
  return localized;
}

// Map a localized path back to the base path (for rewrites if needed).
// Currently only supports FR mappings.
export function delocalizePath(path: string, locale: Locale): string {
  const normalize = (s: string) => (s.endsWith("/") && s !== "/" ? s.slice(0, -1) : s);
  const key = normalize(path);
  if (locale === "fr") {
    const entry = Object.entries(frMap).find(([, v]) => v === key);
    return entry ? entry[0] : key;
  }
  return key;
}
