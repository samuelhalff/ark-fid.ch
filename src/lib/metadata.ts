import { Metadata } from "next";
import { headers } from "next/headers";

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

// Function to get the current locale from various sources
function getCurrentLocale(): string {
  try {
    // Try to get locale from headers (for server-side rendering)
    const headersList = headers();
    const acceptLanguage = headersList.get('accept-language');
    
    if (acceptLanguage) {
      // Parse the Accept-Language header to get preferred locale
      const locales = acceptLanguage.split(',').map(lang => {
        const [locale] = lang.trim().split(';');
        return locale.split('-')[0]; // Get base language (en from en-US)
      });
      
      // Check if any preferred locale is supported
      const supportedLocales = ['en', 'fr', 'de', 'es', 'pt'];
      for (const locale of locales) {
        if (supportedLocales.includes(locale)) {
          return locale;
        }
      }
    }
  } catch (error) {
    // Headers might not be available in all contexts
    console.log('Could not get locale from headers, defaulting to en');
  }
  
  // Default to English
  return 'en';
}

// Function to load metadata config for a specific locale
async function loadMetadataConfig(locale: string): Promise<MetadataConfig> {
  try {
    const config = await import(`@/src/translations/${locale}/metadata.json`);
    return config.default;
  } catch (error) {
    // Fallback to English if locale not found
    const config = await import(`@/src/translations/en/metadata.json`);
    return config.default;
  }
}

export async function getPageMetadata(path: string, customData?: {
  articleTitle?: string;
  articleDescription?: string;
  locale?: string;
}): Promise<Metadata> {
  const locale = customData?.locale || getCurrentLocale();
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
  
  const metadata: Metadata = {
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
              locale === 'es' ? 'es_ES' : 'en_US',
      url: `https://ark-fid.ch${path}`,
      title,
      description,
      siteName: config.default.siteName,
      images: [
        {
          url: "https://ark-fid.ch/assets/arkfid--color.svg",
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
      images: ["https://ark-fid.ch/assets/arkfid--color.svg"],
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
      canonical: `https://ark-fid.ch${path}`,
      languages: {
        'en': `https://ark-fid.ch/en${path}`,
        'fr': `https://ark-fid.ch/fr${path}`,
        'de': `https://ark-fid.ch/de${path}`,
        'es': `https://ark-fid.ch/es${path}`,
      },
    },
  };

  return metadata;
}

// Helper function for static pages
export async function generateMetadataForPage(path: string, locale?: string) {
  return await getPageMetadata(path, { locale });
}

// Helper function for dynamic pages (like articles)
export async function generateMetadataForArticle(
  slug: string,
  articleTitle: string,
  articleDescription: string,
  locale?: string
) {
  return await getPageMetadata(`/ressources/articles/${slug}`, {
    articleTitle,
    articleDescription,
    locale,
  });
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
      "availableLanguage": ["English", "French", "German", "Spanish"]
    },
    "address": {
      "@type": "PostalAddress",
      "addressCountry": "CH"
    },
    "sameAs": []
  };
}
