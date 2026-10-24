/**
 * Service page -> related article slugs (highest-impression on-topic articles).
 * Slugs missing in a locale are skipped at render time.
 */
export const serviceArticles: Record<string, string[]> = {
  "/services/domiciliation": [
    "domiciliation-suisse-substance-risques-guide-2026",
    "domiciliation-entreprise-geneve",
    "reglementations-domiciliation-entreprise-suisse-substance-transparence-2026",
  ],
  "/services/accounting": [
    "controle-interne-pme-separation-taches-matrice-acces-risques-2026",
    "externalisation-comptabilite-geneve-pme-avantages-etapes-solutions-2025",
    "swiss-gaap-fer-pme-choisir",
  ],
  "/services/corporate": [
    "roles-et-responsabilites-administrateurs-sa-sarl-geneve-2025",
    "ayants-droit-economiques-registre-actions-sa-sarl-obligations-2026",
    "proces-verbal-assemblee-generale-obligations-redaction-suisse-2025",
  ],
  "/services/incorporation": [
    "creer-entreprise-suisse",
    "creer-sarl-sa-geneve-criteres-capital-fiscalite-gouvernance-2026",
    "registre-commerce-suisse-inscription-etapes-documents-delais-erreurs-2026",
  ],
  "/services/payroll": [
    "guide-cotisations-sociales-employeurs-suisse-2026",
    "externalisation-paie-geneve-2025-avantages-securite-pme",
    "certificat-salaire-erreurs-controles",
  ],
  "/services/taxes": [
    "reforme-fiscale-geneve-2025-impact-contribuables-pme",
    "baisse-impots-geneve-2025",
    "optimiser-fiscalite-geneve-2025-preparer-2026",
  ],
  "/services/odoo": [
    "odoo-comptabilite-tva-suisse-parametrage-controles",
    "odoo-controle-interne-droits-acces-piste-audit-factures-fournisseurs-pme-2026",
    "facturation-electronique-suisse-2026-qr-archivage-odoo-automatismes-pme",
  ],
  "/services/immigration": ["anobag-suisse-permis-travail"],
  "/services/family-office": [
    "gestion-et-optimisation-du-patrimoine-en-suisse-strategies-pme-hni-geneve-2025",
    "succession-entrepreneur-suisse-preparer-patrimoine-societe-fiscalite-2026",
    "ridger-multi-family-office-groupe-ark",
  ],
  "/services/mergers-acquisitions": [
    "due-diligence-financiere-achat-pme-suisse-checklist-experts-2026",
    "due-diligence-financiere-pme-suisse-controles-avant-acquisition-2026",
    "rapport-due-diligence-financiere-acquisition-pme-suisse-2026",
  ],
  "/services/outsourcing": [
    "externalisation-comptabilite-geneve-pme-avantages-etapes-solutions-2025",
    "externalisation-paie-geneve-2025-avantages-securite-pme",
    "outsourcing-finance-cfo-a-la-demande",
  ],
};

/**
 * Reference ("pillar") article per core service, shown first and highlighted.
 * Four services only; the article must exist in the active locale.
 */
export const servicePillarArticle: Record<string, string> = {
  "/services/domiciliation": "domiciliation-suisse-substance-risques-guide-2026",
  "/services/payroll": "guide-cotisations-sociales-employeurs-suisse-2026",
  "/services/accounting":
    "externalisation-comptabilite-geneve-pme-avantages-etapes-solutions-2025",
  "/services/incorporation":
    "creer-sarl-sa-geneve-criteres-capital-fiscalite-gouvernance-2026",
};
