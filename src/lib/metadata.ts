import { Metadata } from "next";
import { Locale, locales, getCurrentLocale } from "./i18n";

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
    // hreflang keys should be locale codes like 'en', 'fr' etc.
    acc[loc] = `https://ark-fid.ch${locPath}`;
    return acc;
  }, {} as Record<string, string>);

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
      locale: locale === 'en' ? 'en_US' : 
              locale === 'fr' ? 'fr_FR' : 
              locale === 'de' ? 'de_DE' : 
              locale === 'es' ? 'es_ES' : 
              locale === 'pt' ? 'pt_PT' : 'en_US',
      url: `https://ark-fid.ch${canonicalPath}`,
      title,
      description,
      siteName: config.default.siteName,
      images: [
        {
          url: "/assets/arkfid--color.svg",
          width: 800,
          height: 600,
          alt: "Ark Fiduciaire Logo",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: ["/assets/arkfid--color.svg"],
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
      languages: Object.assign({ 'x-default': `https://ark-fid.ch${path}` }, alternateUrls),
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
    "description": "Expert fiduciary, accounting, and tax services in Switzerland",
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
    "sameAs": []
  };
}
