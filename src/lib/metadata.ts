import { Metadata } from "next";
import { Locale, locales, getCurrentLocale } from "./i18n";
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

// Function to load metadata config for a specific locale
async function loadMetadataConfig(locale: Locale): Promise<MetadataConfig> {
  try {
    const config = await import(`@/src/translations/${locale}/metadata.json`);
    return config.default;
  } catch (error) {
    // Fallback to English if locale not found
    const config = await import(`@/src/translations/en/metadata.json`);
    return config.default;
  }
}

const hreflangFor = (loc: Locale): string => {
  switch (loc) {
    case 'fr':
      return 'fr-CH';
    case 'de':
      return 'de-CH';
    case 'es':
      return 'es-ES';
    case 'pt':
      return 'pt-PT';
    default:
      return 'en';
  }
};

export async function getPageMetadata(
  locale: Locale,
  path: string,
  customData?: {
    articleTitle?: string;
    articleDescription?: string;
  }
): Promise<Metadata> {
  const config = await loadMetadataConfig(locale);
  
  // Get page-specific metadata or fall back to default
  const pageData = config.pages[path] || config.default;
  
  let title = pageData.title;
  let description = pageData.description;
  
  // Handle dynamic pages (like articles)
  if (path.startsWith("/ressources/articles/") && customData?.articleTitle) {
    title = config.dynamic.articles.titleTemplate.replace("{articleTitle}", customData.articleTitle);
    description = config.dynamic.articles.descriptionTemplate.replace("{articleDescription}", customData.articleDescription || "");
  }
  
  // Generate proper URLs for each locale (all locales have prefix in our setup)
  const canonicalPath = `/${locale}${path}`;
  const alternateUrls = locales.reduce((acc, loc) => {
    const locPath = `/${loc}${path}`;
    const key = hreflangFor(loc);
    acc[key] = `https://ark-fid.ch${locPath}`;
    return acc;
  }, {} as Record<string, string>);

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
  // Dynamic article OG image route (Next.js /opengraph-image) if this is an article detail page
  const isArticle = path.startsWith('/ressources/articles/');
  const slug = isArticle ? path.split('/').pop() : undefined;
  const dynamicArticleOg = isArticle && slug ? `https://ark-fid.ch/${locale}/ressources/articles/${slug}/opengraph-image` : undefined;

  const ogImage = (() => {
    if (dynamicArticleOg) return dynamicArticleOg;
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
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
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
      languages: Object.assign({ 'x-default': `https://ark-fid.ch/fr${path}` }, alternateUrls),
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
  description?: string
): Promise<Metadata> {
  if (typeof localeOrSlug === 'string' && slugOrTitle && titleOrDescription && !description) {
    // Old signature: generateMetadataForArticle(slug, title, description)
    return await getPageMetadata('fr' as Locale, `/ressources/articles/${localeOrSlug}`, {
      articleTitle: slugOrTitle,
      articleDescription: titleOrDescription,
    });
  } else {
    // New signature: generateMetadataForArticle(locale, slug, title, description)
    return await getPageMetadata(localeOrSlug as Locale, `/ressources/articles/${slugOrTitle}`, {
      articleTitle: titleOrDescription,
      articleDescription: description,
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
    "telephone": "+41"
  };
}
