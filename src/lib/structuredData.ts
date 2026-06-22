/**
 * Structured Data (JSON-LD) builder utilities.
 * Keep objects small & serialisable – we only assemble plain JSON here.
 * All functions return POJOs ready to be stringified.
 */

export interface FAQEntry {
  question: string;
  answer: string;
}

export function buildFAQPage(entries: FAQEntry[], limit?: number) {
  const list = entries
    .filter((e) => e.question && e.answer)
    .slice(0, limit || entries.length)
    .map((e) => ({
      "@type": "Question",
      name: e.question,
      acceptedAnswer: { "@type": "Answer", text: e.answer },
    }));
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: list,
  } as const;
}

export interface HowToStep {
  name: string;
  text?: string;
  /** Optional extra details (e.g. tools, supplies) appended for later enrichment */
  image?: string;
  url?: string;
  /** Estimated time in ISO 8601 duration (e.g. PT10M) */
  estimatedTime?: string;
}

export interface HowToConfig {
  name: string;
  description: string;
  steps: HowToStep[];
  /** Total estimated time (ISO 8601) */
  totalTime?: string;
  /** Tools used across the process */
  tools?: string[];
  /** Supplies / materials required */
  supplies?: string[];
  /** Overall cost description */
  estimatedCost?: { currency: string; value: string; name?: string };
}

export function buildHowTo(cfg: HowToConfig) {
  return {
    "@context": "https://schema.org",
    "@type": "HowTo",
    name: cfg.name,
    description: cfg.description,
    ...(cfg.totalTime ? { totalTime: cfg.totalTime } : {}),
    ...(cfg.estimatedCost
      ? {
          estimatedCost: {
            "@type": "MonetaryAmount",
            currency: cfg.estimatedCost.currency,
            value: cfg.estimatedCost.value,
            ...(cfg.estimatedCost.name ? { name: cfg.estimatedCost.name } : {}),
          },
        }
      : {}),
    ...(cfg.tools
      ? { tool: cfg.tools.map((t) => ({ "@type": "HowToTool", name: t })) }
      : {}),
    ...(cfg.supplies
      ? {
          supply: cfg.supplies.map((s) => ({
            "@type": "HowToSupply",
            name: s,
          })),
        }
      : {}),
    step: cfg.steps.map((s, idx) => ({
      "@type": "HowToStep",
      position: idx + 1,
      name: s.name,
      ...(s.text ? { text: s.text } : {}),
      ...(s.image ? { image: s.image } : {}),
      ...(s.url ? { url: s.url } : {}),
      ...(s.estimatedTime ? { estimatedTime: s.estimatedTime } : {}),
    })),
  } as const;
}

export interface BreadcrumbItem {
  name: string;
  item: string; // absolute URL
}

export function buildBreadcrumbList(items: BreadcrumbItem[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((it, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: it.name,
      item: it.item,
    })),
  } as const;
}

export const arkOrganization = {
  name: "Ark Fiduciaire SA",
  url: "https://ark-fid.ch",
  logo: "https://ark-fid.ch/assets/arkfid--color.svg",
  telephone: "+41 22 512 50 50",
  email: "info@ark-fid.ch",
  address: {
    streetAddress: "26 Boulevard Georges Favon",
    postalCode: "1204",
    addressLocality: "Genève",
    addressRegion: "GE",
    addressCountry: "CH",
  },
  areaServed: ["Geneva", "Lausanne", "Suisse romande", "Switzerland"],
  sameAs: [
    "https://www.linkedin.com/company/ark-fiduciaire/",
    "https://maps.google.com/?cid=14946625157719331801",
  ],
  languages: ["fr", "en", "de", "es", "pt"],
} as const;

export function buildOrganizationGraph(locale: string = "fr") {
  const serviceNames =
    locale === "fr"
      ? [
          "Comptabilité",
          "Fiscalité",
          "Gestion des salaires",
          "Domiciliation",
          "Création de société",
          "Administration corporate",
          "Externalisation back-office",
          "Implémentation Odoo",
          "Family office administratif",
          "M&A",
          "Immigration et permis",
        ]
      : [
          "Accounting",
          "Tax",
          "Payroll",
          "Business domiciliation",
          "Company incorporation",
          "Corporate administration",
          "Back-office outsourcing",
          "Odoo implementation",
          "Administrative family office",
          "M&A",
          "Immigration and permits",
        ];

  const organizationId = `${arkOrganization.url}/#organization`;
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": ["Organization", "ProfessionalService", "AccountingService"],
        "@id": organizationId,
        name: arkOrganization.name,
        url: arkOrganization.url,
        logo: arkOrganization.logo,
        image: arkOrganization.logo,
        telephone: arkOrganization.telephone,
        email: arkOrganization.email,
        address: {
          "@type": "PostalAddress",
          ...arkOrganization.address,
        },
        areaServed: arkOrganization.areaServed.map((name) => ({
          "@type": name === "Switzerland" ? "Country" : "Place",
          name,
        })),
        sameAs: arkOrganization.sameAs,
        knowsLanguage: arkOrganization.languages,
        description:
          locale === "fr"
            ? "Ark Fiduciaire SA est une fiduciaire basée à Genève pour PME suisses, entrepreneurs, familles et sociétés internationales."
            : "Ark Fiduciaire SA is a Geneva-based fiduciary firm for Swiss SMEs, entrepreneurs, families and international companies.",
        hasOfferCatalog: {
          "@type": "OfferCatalog",
          name:
            locale === "fr"
              ? "Services fiduciaires Ark Fiduciaire"
              : "Ark Fiduciaire services",
          itemListElement: serviceNames.map((name) => ({
            "@type": "Offer",
            itemOffered: {
              "@type": "Service",
              name,
              provider: { "@id": organizationId },
            },
          })),
        },
      },
      {
        "@type": "WebSite",
        "@id": `${arkOrganization.url}/#website`,
        url: arkOrganization.url,
        name: arkOrganization.name,
        publisher: { "@id": organizationId },
        inLanguage: locale,
      },
    ],
  } as const;
}

export interface PersonSchemaConfig {
  id: string;
  name: string;
  jobTitle?: string;
  description?: string;
  image?: string;
  url: string;
  sameAs?: string[];
  knowsLanguage?: string[];
  alumniOf?: string[];
  memberOf?: string[];
  knowsAbout?: string[];
}

export function buildPersonSchema(cfg: PersonSchemaConfig) {
  return {
    "@context": "https://schema.org",
    "@type": "Person",
    "@id": cfg.id,
    name: cfg.name,
    ...(cfg.jobTitle ? { jobTitle: cfg.jobTitle } : {}),
    ...(cfg.description ? { description: cfg.description } : {}),
    ...(cfg.image ? { image: cfg.image } : {}),
    url: cfg.url,
    worksFor: {
      "@type": "Organization",
      "@id": `${arkOrganization.url}/#organization`,
      name: arkOrganization.name,
      url: arkOrganization.url,
    },
    ...(cfg.sameAs?.length ? { sameAs: cfg.sameAs } : {}),
    ...(cfg.knowsLanguage?.length ? { knowsLanguage: cfg.knowsLanguage } : {}),
    ...(cfg.knowsAbout?.length ? { knowsAbout: cfg.knowsAbout } : {}),
    ...(cfg.alumniOf?.length
      ? {
          alumniOf: cfg.alumniOf.map((name) => ({
            "@type": "EducationalOrganization",
            name,
          })),
        }
      : {}),
    ...(cfg.memberOf?.length
      ? {
          memberOf: cfg.memberOf.map((name) => ({
            "@type": "Organization",
            name,
          })),
        }
      : {}),
  } as const;
}

export interface ArticleSchemaConfig {
  headline: string;
  description?: string;
  datePublished?: string;
  dateModified?: string;
  author?: string;
  authorUrl?: string;
  publisherName?: string;
  image?: string;
  url: string;
  locale: string;
  section?: string;
  keywords?: string[];
  timeRequired?: string;
}

export function buildArticleSchema(cfg: ArticleSchemaConfig) {
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: cfg.headline,
    ...(cfg.description ? { description: cfg.description } : {}),
    ...(cfg.author
      ? {
          author: {
            "@type": cfg.authorUrl ? "Person" : "Organization",
            name: cfg.author,
            ...(cfg.authorUrl ? { url: cfg.authorUrl } : {}),
          },
        }
      : {}),
    publisher: {
      "@type": "Organization",
      "@id": `${arkOrganization.url}/#organization`,
      name: cfg.publisherName || arkOrganization.name,
      logo: {
        "@type": "ImageObject",
        url: arkOrganization.logo,
      },
    },
    ...(cfg.datePublished ? { datePublished: cfg.datePublished } : {}),
    dateModified: cfg.dateModified || cfg.datePublished,
    url: cfg.url,
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": cfg.url,
    },
    inLanguage: cfg.locale,
    ...(cfg.image
      ? {
          image: {
            "@type": "ImageObject",
            url: cfg.image,
          },
        }
      : {}),
    ...(cfg.section ? { articleSection: cfg.section } : {}),
    ...(cfg.keywords?.length ? { keywords: cfg.keywords.join(", ") } : {}),
    ...(cfg.timeRequired ? { timeRequired: cfg.timeRequired } : {}),
  } as const;
}

export function buildWebSiteSearchAction(siteUrl: string) {
  // Potential future enhancement – not wired yet.
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    url: siteUrl,
    potentialAction: {
      "@type": "SearchAction",
      target: `${siteUrl}/search?q={search_term_string}`,
      "query-input": "required name=search_term_string",
    },
  } as const;
}

export interface ServiceSchemaConfig {
  name: string;
  description: string;
  serviceType?: string;
  url: string; // absolute URL
  areaServed?: string[];
  provider?: { name: string; url?: string; logo?: string };
}

export function buildServiceSchema(cfg: ServiceSchemaConfig) {
  return {
    "@context": "https://schema.org",
    "@type": "Service",
    name: cfg.name,
    description: cfg.description,
    ...(cfg.serviceType ? { serviceType: cfg.serviceType } : {}),
    url: cfg.url,
    ...(cfg.areaServed ? { areaServed: cfg.areaServed } : {}),
    ...(cfg.provider
      ? {
          provider: {
            "@type": "Organization",
            name: cfg.provider.name,
            ...(cfg.provider.url ? { url: cfg.provider.url } : {}),
            ...(cfg.provider.logo ? { logo: cfg.provider.logo } : {}),
          },
        }
      : {}),
  } as const;
}

export interface LocalBusinessConfig {
  name: string;
  description: string;
  url: string;
  logo: string;
  telephone?: string;
  email: string;
  address: {
    streetAddress: string;
    postalCode: string;
    addressLocality: string;
    addressCountry: string;
  };
  geo?: {
    latitude: number;
    longitude: number;
  };
  openingHours?: string[];
  priceRange?: string;
  areaServed?: string[];
  sameAs?: string[]; // Social media profiles, Google Maps, etc.
}

export function buildLocalBusiness(cfg: LocalBusinessConfig) {
  return {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    "@id": cfg.url,
    name: cfg.name,
    description: cfg.description,
    url: cfg.url,
    logo: cfg.logo,
    ...(cfg.telephone ? { telephone: cfg.telephone } : {}),
    email: cfg.email,
    address: {
      "@type": "PostalAddress",
      streetAddress: cfg.address.streetAddress,
      postalCode: cfg.address.postalCode,
      addressLocality: cfg.address.addressLocality,
      addressCountry: cfg.address.addressCountry,
    },
    ...(cfg.geo
      ? {
          geo: {
            "@type": "GeoCoordinates",
            latitude: cfg.geo.latitude,
            longitude: cfg.geo.longitude,
          },
        }
      : {}),
    ...(cfg.openingHours ? { openingHours: cfg.openingHours } : {}),
    ...(cfg.priceRange ? { priceRange: cfg.priceRange } : {}),
    ...(cfg.areaServed ? { areaServed: cfg.areaServed } : {}),
    ...(cfg.sameAs ? { sameAs: cfg.sameAs } : {}),
  } as const;
}

export interface AccountingServiceConfig {
  name: string;
  description: string;
  serviceType: string;
  url: string; // absolute URL
  areaServed?: string[];
  provider?: {
    name: string;
    url: string;
    telephone?: string;
    email?: string;
    address?: {
      streetAddress: string;
      postalCode: string;
      addressLocality: string;
      addressCountry: string;
    };
  };
  offers?: {
    description: string;
    priceRange?: string;
  };
}

export function buildAccountingService(cfg: AccountingServiceConfig) {
  return {
    "@context": "https://schema.org",
    "@type": "FinancialService",
    serviceType: cfg.serviceType,
    name: cfg.name,
    description: cfg.description,
    url: cfg.url,
    ...(cfg.areaServed ? { areaServed: cfg.areaServed } : {}),
    ...(cfg.provider
      ? {
          provider: {
            "@type": "ProfessionalService",
            name: cfg.provider.name,
            url: cfg.provider.url,
            ...(cfg.provider.telephone
              ? { telephone: cfg.provider.telephone }
              : {}),
            ...(cfg.provider.email ? { email: cfg.provider.email } : {}),
            ...(cfg.provider.address
              ? {
                  address: {
                    "@type": "PostalAddress",
                    streetAddress: cfg.provider.address.streetAddress,
                    postalCode: cfg.provider.address.postalCode,
                    addressLocality: cfg.provider.address.addressLocality,
                    addressCountry: cfg.provider.address.addressCountry,
                  },
                }
              : {}),
          },
        }
      : {}),
    ...(cfg.offers
      ? {
          offers: {
            "@type": "Offer",
            description: cfg.offers.description,
            ...(cfg.offers.priceRange
              ? { priceRange: cfg.offers.priceRange }
              : {}),
          },
        }
      : {}),
  } as const;
}

export interface SoftwareApplicationConfig {
  name: string;
  description: string;
  applicationCategory: string;
  operatingSystem?: string;
  offers?: {
    price: string;
    priceCurrency: string;
  };
  author?: {
    name: string;
    url?: string;
  };
}

export function buildSoftwareApplication(cfg: SoftwareApplicationConfig) {
  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: cfg.name,
    description: cfg.description,
    applicationCategory: cfg.applicationCategory,
    ...(cfg.operatingSystem ? { operatingSystem: cfg.operatingSystem } : {}),
    ...(cfg.offers
      ? {
          offers: {
            "@type": "Offer",
            price: cfg.offers.price,
            priceCurrency: cfg.offers.priceCurrency,
          },
        }
      : {}),
    ...(cfg.author
      ? {
          author: {
            "@type": "Organization",
            name: cfg.author.name,
            ...(cfg.author.url ? { url: cfg.author.url } : {}),
          },
        }
      : {}),
  } as const;
}
