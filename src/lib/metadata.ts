import { Metadata } from "next";
import { Locale, locales } from "./i18n";
import { localizePath } from "./paths";
import { hreflangFor } from "./hreflang";
import fs from 'fs';
import { join as pathJoin } from 'path';

interface MetadataConfig {
  default: {
    title: string;
    description: string;
    keywords: string;
    author: string;
    siteName: string;
  };
  pages: Record<string, {
    title: string;
    description: string;
    keywords: string;
  }>;
  dynamic: {
    articles: {
      titleTemplate: string;
      descriptionTemplate: string;
      keywords: string;
    };
  };
}

const metadataConfigCache = new Map<Locale, MetadataConfig>();

// Function to load metadata config for a specific locale
async function loadMetadataConfig(locale: Locale): Promise<MetadataConfig> {
  const cached = metadataConfigCache.get(locale);
  if (cached) return cached;

  const readMetadata = (loc: string): MetadataConfig | null => {
    try {
      const filePath = pathJoin(process.cwd(), "src", "translations", loc, "metadata.json");
      if (!fs.existsSync(filePath)) return null;
      const fileContent = fs.readFileSync(filePath, "utf8");
      return JSON.parse(fileContent);
    } catch {
      return null;
    }
  };

  const primary = readMetadata(locale);
  const fallback = primary ? null : readMetadata("en");

  if (!primary && !fallback) {
    throw new Error(`Metadata config not found for locale ${locale}`);
  }

  const resolved = primary ?? fallback!;
  metadataConfigCache.set(locale, resolved);
  return resolved;
}

const withTrailingSlash = (value: string) =>
  value.endsWith("/") ? value : `${value}/`;

// Parse placeholder locales from env (e.g., PLACEHOLDER_LOCALES="es,pt").
function getPlaceholderLocales(): Set<Locale> {
  const raw = process.env.PLACEHOLDER_LOCALES || '';
  const set = new Set<Locale>();
  raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .forEach((s) => {
      if ((locales as readonly string[]).includes(s)) set.add(s as Locale);
    });
  return set;
}

export async function getPageMetadata(
  locale: Locale,
  path: string,
  customData?: {
    articleTitle?: string;
    articleDescription?: string;
    validLocales?: Locale[];
  }
): Promise<Metadata> {
  const config = await loadMetadataConfig(locale);
  const placeholderLocales = getPlaceholderLocales();
  
  // Normalize path for consistent lookup (remove trailing slash for lookup)
  const normalizedPath = path === "/" ? "/" : path.replace(/\/+$/, "");
  
  // Get page-specific metadata or fall back to default
  const pageData = config.pages[normalizedPath] || config.default;
  
  let title = pageData.title;
  let description = pageData.description;
  
  // Handle dynamic pages (like articles)
  if (normalizedPath.startsWith("/ressources/articles/") && customData?.articleTitle) {
    title = config.dynamic.articles.titleTemplate.replace("{articleTitle}", customData.articleTitle);
    description = config.dynamic.articles.descriptionTemplate.replace("{articleDescription}", customData.articleDescription || "");
  }
  
  // Generate locale-aware URLs (all locales have prefix in our setup, but slugs may differ per locale)
  const localizedCanonical = localizePath(normalizedPath, locale);
  const canonicalPath = withTrailingSlash(`/${locale}${localizedCanonical}`);
  
  // Determine which locales to include in alternates
  // If validLocales is provided, use only those; otherwise use all locales
  const localesToInclude: Locale[] = customData?.validLocales ?? [...locales];
  
  const alternateUrls = localesToInclude.reduce<Record<string, string>>((acc, loc) => {
    const localized = localizePath(normalizedPath, loc);
    const locPath = withTrailingSlash(`/${loc}${localized}`);
    const key = hreflangFor(loc);
    acc[key] = `https://ark-fid.ch${locPath}`;
    return acc;
  }, {});

  const ogLocale =
    locale === 'fr' ? 'fr_CH' :
    locale === 'de' ? 'de_CH' :
    locale === 'es' ? 'es_ES' :
    locale === 'pt' ? 'pt_PT' :
    'en_US';

  // Prefer locale-specific OG image if available under public/assets/og/og-<locale>.webp|png
  const ogCandidates = [
    `/assets/og/og-${locale}.webp`
  ];
  const ogImage = (() => {
    for (const rel of ogCandidates) {
      const abs = pathJoin(process.cwd(), 'public', rel.replace(/^\//, ''));
      try {
        if (fs.existsSync(abs)) return rel;
      } catch {}
    }
    return "/assets/main-bg.webp";
  })();

  const metadata: Metadata = {
    metadataBase: new URL('https://ark-fid.ch'),
    title,
    description,
    keywords: pageData.keywords || config.default.keywords,
    authors: [{ name: config.default.author }],
    creator: config.default.author,
    publisher: config.default.siteName,
    robots: {
      index: !placeholderLocales.has(locale),
      follow: !placeholderLocales.has(locale),
      googleBot: {
        index: !placeholderLocales.has(locale),
        follow: !placeholderLocales.has(locale),
        "max-video-preview": -1,
        "max-image-preview": "large",
        "max-snippet": -1,
      },
    },
    openGraph: {
      type: "website",
      locale: ogLocale,
      url: `https://ark-fid.ch${canonicalPath}`,
      title,
      description,
      siteName: config.default.siteName,
      images: [
        {
          url: ogImage,
          width: 1200,
          height: 630,
          alt: "Ark Fiduciaire",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
  images: [ogImage],
    },
    icons: {
      icon: [
        {
          url: "/favicon.ico",
          sizes: "any",
        },
        {
          url: "/favicon.png",
          type: "image/png",
        },
      ],
      apple: [
        {
          url: "/favicon.png",
          sizes: "180x180",
          type: "image/png",
        },
      ],
    },
    alternates: {
      canonical: `https://ark-fid.ch${canonicalPath}`,
      languages: Object.assign(
        {
          'x-default': (() => {
            const defaultLocale = localesToInclude.includes('fr' as Locale) ? 'fr' : localesToInclude[0];
            return `https://ark-fid.ch${withTrailingSlash(
              `/${defaultLocale}${localizePath(normalizedPath, defaultLocale as Locale)}`
            )}`;
          })(),
        },
        alternateUrls
      ),
    },
  };

  return metadata;
}

// Helper function for static pages (backward compatibility)
export async function generateMetadataForPage(
  localeOrPath: Locale | string,
  path?: string
): Promise<Metadata> {
  if (typeof localeOrPath === 'string' && !path) {
    // Old signature: generateMetadataForPage("/path") - default to French
    return await getPageMetadata('fr' as Locale, localeOrPath);
  } else if (typeof localeOrPath === 'string' && path) {
    // New signature: generateMetadataForPage(locale, path)
    return await getPageMetadata(localeOrPath as Locale, path);
  } else {
    // New signature: generateMetadataForPage(locale, path)
    return await getPageMetadata(localeOrPath as Locale, path || '/');
  }
}

// Helper function for dynamic pages (like articles)
export async function generateMetadataForArticle(
  localeOrSlug: Locale | string,
  slugOrTitle?: string,
  titleOrDescription?: string,
  description?: string,
  validLocales?: Locale[]
): Promise<Metadata> {
  if (typeof localeOrSlug === 'string' && slugOrTitle && titleOrDescription && !description) {
    // Old signature: generateMetadataForArticle(slug, title, description)
    return await getPageMetadata('fr' as Locale, `/ressources/articles/${localeOrSlug}`, {
      articleTitle: slugOrTitle,
      articleDescription: titleOrDescription,
      validLocales,
    });
  } else {
    // New signature: generateMetadataForArticle(locale, slug, title, description, validLocales)
    return await getPageMetadata(localeOrSlug as Locale, `/ressources/articles/${slugOrTitle}`, {
      articleTitle: titleOrDescription,
      articleDescription: description,
      validLocales,
    });
  }
}

// Generate structured data for organization
export function generateOrganizationStructuredData() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    "name": "Ark Fiduciaire",
    "description": "Fiduciary, accounting, payroll and tax compliance services based in Geneva and active across French-speaking Switzerland (Romandy) and Switzerland",
    "url": "https://ark-fid.ch",
    "logo": "https://ark-fid.ch/assets/arkfid--color.svg",
    "aggregateRating": {
      "@type": "AggregateRating",
      "ratingValue": "5.0",
      "reviewCount": 6
    },
    "contactPoint": {
      "@type": "ContactPoint",
      "contactType": "customer service",
      "availableLanguage": ["English", "French", "German", "Spanish", "Portuguese"]
    },
    "address": {
      "@type": "PostalAddress",
      "addressCountry": "CH"
    },
    "sameAs": [
      // Populate with real profiles when available
      "https://www.linkedin.com/company/ark-fiduciaire/",
      "https://maps.google.com/?cid=11595836239142935457"
    ],
    "areaServed": ["Geneva", "Romandy", "Switzerland", "International"],
    "knowsAbout": [
      "Swiss accounting",
      "payroll Geneva",
      "tax compliance Switzerland",
      "domiciliation Geneva",
      "outsourced CFO Switzerland",
      "accounting services Geneva",
      "fiduciary services Romandy",
      "tax advisory Switzerland",
      "corporate services Geneva",
      "financial reporting Switzerland",
      "tax declarations Geneva",
      "company creation Switzerland"
    ]
  };
}

// Local SEO: specify presence in Romandy with offices in Geneva and Lausanne
export function generateLocalBusinessStructuredData() {
  return {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    "name": "Ark Fiduciaire",
    "image": "https://ark-fid.ch/assets/arkfid--color.svg",
    "url": "https://ark-fid.ch",
    "address": [
      {
        "@type": "PostalAddress",
        "addressCountry": "CH",
        "addressRegion": "GE",
        "addressLocality": "Genève"
      },
      {
        "@type": "PostalAddress",
        "addressCountry": "CH",
        "addressRegion": "VD",
        "addressLocality": "Lausanne"
      }
    ],
    "areaServed": ["Geneva", "Lausanne", "Romandy", "Suisse romande", "French-speaking Switzerland", "Switzerland", "International"],
    "serviceArea": [
      {
        "@type": "Place",
        "name": "Geneva"
      },
      {
        "@type": "Place",
        "name": "Romandy"
      },
      {
        "@type": "Country",
        "name": "Switzerland"
      }
    ],
    "sameAs": [
      "https://www.linkedin.com/company/ark-fiduciaire",
      "https://maps.google.com/?cid=11595836239142935457"
    ],
    "priceRange": "CHF",
    "telephone": "+41 22 512 50 50"
  };
}
