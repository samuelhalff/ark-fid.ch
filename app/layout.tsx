import { Providers } from "@/src/components/providers"; // Import your new client provider
import { Metadata, Viewport } from "next";
import {
  generateOrganizationStructuredData,
  generateLocalBusinessStructuredData,
} from "@/src/lib/metadata";
import { inter } from "./fonts";
import { headers } from "next/headers";
// Vercel Analytics is rendered conditionally via ConsentAnalytics
import dynamic from "next/dynamic";
import Defer from "@/src/components/Defer";
import ErrorBoundary from "@/src/components/ErrorBoundary";
import "./globals.css";
const CookieConsent = dynamic(() => import("@/src/components/CookieConsent"), {
  ssr: false,
  loading: () => null,
});
const ConsentAnalytics = dynamic(
  () => import("@/src/components/ConsentAnalytics"),
  { ssr: false, loading: () => null }
);
import { getTranslations, getCurrentLocale } from "@/src/lib/i18n";

// Using self-hosted Inter via next/font/local (see app/fonts.ts)

// Here we define the STATIC metadata for the entire site
// This is the baseline, and can be overridden by individual pages

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"
  ),
  title: {
    template: "%s - Ark Fiduciaire SA",
    default: "Ark Fiduciaire SA - Swiss Fiduciary Services",
  },
  description:
    "Expert fiduciary, accounting, and tax services in Switzerland. Corporate services, payroll management, domiciliation, and comprehensive business solutions for SMEs and international companies in Geneva and Lausanne.",
  keywords:
    "fiduciary services, accounting, tax services, Switzerland, corporate services, payroll, domiciliation",
  authors: [{ name: "Ark Fiduciaire SA" }],
  creator: "Ark Fiduciaire SA",
  publisher: "Ark Fiduciaire SA",
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
  icons: {
    icon: [
      {
        url: new URL(
          "/favicon.ico",
          process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"
        ).toString(),
        sizes: "any",
      },
      {
        url: new URL(
          "/favicon.png",
          process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"
        ).toString(),
        type: "image/png",
      },
    ],
    apple: [
      {
        url: new URL(
          "/favicon.png",
          process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"
        ).toString(),
        sizes: "180x180",
        type: "image/png",
      },
    ],
  },
  other: {
    "msvalidate.01": "C5C559E7A2F5598C1884F1DB1EBB8AA6",
  },
};

// Viewport configuration for SEO and mobile
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const nonce = headers().get("x-nonce") || undefined;
  const userAgent = headers().get("user-agent") || "";
  const isIOS = /iPad|iPhone|iPod/.test(userAgent);
  const isAndroid = /Android/.test(userAgent);
  const gaId = isIOS
    ? "G-6YG8R7QMN7"
    : isAndroid
    ? "G-PBFJ9TQ7NR"
    : "G-BXZ54E31FL";
  const currentLocale = getCurrentLocale();
  // Load cookie consent labels server-side to avoid client i18n
  const tCookie = await getTranslations(currentLocale, "cookie");
  const cookieLabels = {
    Title: tCookie("Title"),
    Text: tCookie("Text"),
    LearnMore: tCookie("LearnMore"),
    Accept: tCookie("Accept"),
    Decline: tCookie("Decline"),
    Manage: tCookie("Manage"),
  } as const;
  const orgJsonLd = generateOrganizationStructuredData();
  const localBizJsonLd = generateLocalBusinessStructuredData();
  const webSiteJsonLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    url: "https://ark-fid.ch/",
    name: "Ark Fiduciaire SA",
    potentialAction: {
      "@type": "SearchAction",
      target: "https://ark-fid.ch/?q={search_term_string}",
      "query-input": "required name=search_term_string",
    },
  } as const;
  return (
    <html
      suppressHydrationWarning
      lang={currentLocale}
      className={inter.variable}
    >
      <head>
        {/* GTM is now loaded only after consent via ConsentAnalytics */}
        {/** Defer Google Maps connections to pages that actually use Maps (e.g., contact). Removing global preconnect helps mobile Speed Index. */}
        {/* Ensure font swap to avoid layout shifts */}
        <meta httpEquiv="Accept-CH" content="Sec-CH-Prefers-Color-Scheme" />
        {/* Title, description and viewport are managed by Next metadata API */}
      </head>
      <body className={inter.className}>
        {/* GTM noscript removed to comply with consent gating */}
        {/* Accessibility: Skip link */}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[999] focus:w-auto focus:h-auto focus:px-5 focus:py-3 focus:rounded-lg bg-primary text-primary-foreground focus:shadow-xl"
        >
          Skip to content
        </a>
        {/* JSON-LD Structured Data */}
        <script
          type="application/ld+json"
          nonce={nonce}
          dangerouslySetInnerHTML={{ __html: JSON.stringify(orgJsonLd) }}
        />
        <script
          type="application/ld+json"
          nonce={nonce}
          dangerouslySetInnerHTML={{ __html: JSON.stringify(localBizJsonLd) }}
        />
        <script
          type="application/ld+json"
          nonce={nonce}
          dangerouslySetInnerHTML={{ __html: JSON.stringify(webSiteJsonLd) }}
        />
        <Providers>
          <ErrorBoundary>
            <div className="pt-3 abstract-background text-foreground pt-15 mt-10">
              {children}
              {/* Cookie Consent banner - must render immediately for GDPR compliance */}
              <CookieConsent
                nonce={nonce}
                locale={currentLocale}
                labels={cookieLabels}
              />
              {/* Render Vercel Analytics only when user accepted cookies - can be deferred */}
              <Defer rootMargin="0px" idle={200} placeholder={null}>
                <ConsentAnalytics gaId={gaId} gtmId="GTM-P6QT792D" />
              </Defer>
            </div>
          </ErrorBoundary>
        </Providers>
      </body>
    </html>
  );
}
