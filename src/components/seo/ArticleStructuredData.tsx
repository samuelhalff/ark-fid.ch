import Script from "next/script";

interface ArticleStructuredDataProps {
  title: string;
  description: string;
  author: string;
  authorUrl?: string;
  datePublished: string;
  dateModified?: string;
  image?: string;
  url: string;
  locale: string;
}

export default function ArticleStructuredData({
  title,
  description,
  author,
  authorUrl,
  datePublished,
  dateModified,
  image,
  url,
  locale,
}: ArticleStructuredDataProps) {
  const organizationSchema = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "Ark Fiduciaire SA",
    url: "https://ark-fid.ch",
    logo: "https://ark-fid.ch/assets/arkfid--color.svg",
    sameAs: ["https://www.linkedin.com/company/ark-fiduciaire/"],
    address: {
      "@type": "PostalAddress",
      streetAddress: "26 Boulevard Georges Favon",
      addressLocality: "Genève",
      postalCode: "1204",
      addressCountry: "CH",
    },
    contactPoint: {
      "@type": "ContactPoint",
      contactType: "customer service",
      email: "info@ark-fid.ch",
      availableLanguage: ["fr", "en", "de", "es", "pt"],
    },
  };

  const articleSchema = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: title,
    description: description,
    author: {
      "@type": authorUrl ? "Person" : "Organization",
      name: author,
      ...(authorUrl && { url: authorUrl }),
    },
    publisher: {
      "@type": "Organization",
      name: "Ark Fiduciaire SA",
      logo: {
        "@type": "ImageObject",
        url: "https://ark-fid.ch/assets/arkfid--color.svg",
      },
    },
    datePublished: datePublished,
    dateModified: dateModified || datePublished,
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": url,
    },
    ...(image && {
      image: {
        "@type": "ImageObject",
        url: image,
      },
    }),
    inLanguage: locale,
    about: [
      {
        "@type": "Thing",
        name: "Fiscalité Suisse",
      },
      {
        "@type": "Thing",
        name: "Comptabilité",
      },
    ],
  };

  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Accueil",
        item: `https://ark-fid.ch/${locale}/`,
      },
      {
        "@type": "ListItem",
        position: 2,
        name: "Ressources",
        item: `https://ark-fid.ch/${locale}/ressources/`,
      },
      {
        "@type": "ListItem",
        position: 3,
        name: title,
        item: url,
      },
    ],
  };

  return (
    <>
      <Script
        id="article-structured-data"
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(articleSchema),
        }}
      />
      <Script
        id="organization-structured-data"
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(organizationSchema),
        }}
      />
      <Script
        id="breadcrumb-structured-data"
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(breadcrumbSchema),
        }}
      />
    </>
  );
}
