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
      '@type': 'Question',
      name: e.question,
      acceptedAnswer: { '@type': 'Answer', text: e.answer },
    }));
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
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
    '@context': 'https://schema.org',
    '@type': 'HowTo',
    name: cfg.name,
    description: cfg.description,
    ...(cfg.totalTime ? { totalTime: cfg.totalTime } : {}),
    ...(cfg.estimatedCost
      ? {
          estimatedCost: {
            '@type': 'MonetaryAmount',
            currency: cfg.estimatedCost.currency,
            value: cfg.estimatedCost.value,
            ...(cfg.estimatedCost.name ? { name: cfg.estimatedCost.name } : {}),
          },
        }
      : {}),
    ...(cfg.tools ? { tool: cfg.tools.map((t) => ({ '@type': 'HowToTool', name: t })) } : {}),
    ...(cfg.supplies
      ? { supply: cfg.supplies.map((s) => ({ '@type': 'HowToSupply', name: s })) }
      : {}),
    step: cfg.steps.map((s, idx) => ({
      '@type': 'HowToStep',
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
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((it, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: it.name,
      item: it.item,
    })),
  } as const;
}

export interface OrganizationAggregateRatingConfig {
  name: string;
  url: string;
  ratingValue: string;
  reviewCount: number;
  logo?: string;
}

export function buildOrganizationAggregateRating(cfg: OrganizationAggregateRatingConfig) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: cfg.name,
    url: cfg.url,
    ...(cfg.logo ? { logo: cfg.logo } : {}),
    aggregateRating: {
      '@type': 'AggregateRating',
      ratingValue: cfg.ratingValue,
      reviewCount: cfg.reviewCount,
    },
  } as const;
}

export function buildWebSiteSearchAction(siteUrl: string) {
  // Potential future enhancement – not wired yet.
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    url: siteUrl,
    potentialAction: {
      '@type': 'SearchAction',
      target: `${siteUrl}/search?q={search_term_string}`,
      'query-input': 'required name=search_term_string',
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
    '@context': 'https://schema.org',
    '@type': 'Service',
    name: cfg.name,
    description: cfg.description,
    ...(cfg.serviceType ? { serviceType: cfg.serviceType } : {}),
    url: cfg.url,
    ...(cfg.areaServed ? { areaServed: cfg.areaServed } : {}),
    ...(cfg.provider
      ? {
          provider: {
            '@type': 'Organization',
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
}

export function buildLocalBusiness(cfg: LocalBusinessConfig) {
  return {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    '@id': cfg.url,
    name: cfg.name,
    description: cfg.description,
    url: cfg.url,
    logo: cfg.logo,
    ...(cfg.telephone ? { telephone: cfg.telephone } : {}),
    email: cfg.email,
    address: {
      '@type': 'PostalAddress',
      streetAddress: cfg.address.streetAddress,
      postalCode: cfg.address.postalCode,
      addressLocality: cfg.address.addressLocality,
      addressCountry: cfg.address.addressCountry,
    },
    ...(cfg.geo ? {
      geo: {
        '@type': 'GeoCoordinates',
        latitude: cfg.geo.latitude,
        longitude: cfg.geo.longitude,
      },
    } : {}),
    ...(cfg.openingHours ? { openingHours: cfg.openingHours } : {}),
    ...(cfg.priceRange ? { priceRange: cfg.priceRange } : {}),
    ...(cfg.areaServed ? { areaServed: cfg.areaServed } : {}),
  } as const;
}
