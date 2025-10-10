import { Providers } from "@/src/components/providers"; // Import your new client provider
import { Metadata, Viewport } from "next";
import Script from "next/script";
import {
  generateOrganizationStructuredData,
  generateLocalBusinessStructuredData,
} from "@/src/lib/metadata";
import { inter } from "./fonts";
import { headers } from "next/headers";
import "./globals.css";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
// Vercel Analytics is rendered conditionally via ConsentAnalytics
import dynamic from "next/dynamic";
import Defer from "@/src/components/Defer";
import ErrorBoundary from "@/src/components/ErrorBoundary";
import DeferredNonCriticalStyles from "@/src/components/DeferredNonCriticalStyles";
const CookieConsent = dynamic(() => import("@/src/components/CookieConsent"), {
  ssr: false,
  loading: () => null,
});
const ConsentAnalytics = dynamic(
  () => import("@/src/components/ConsentAnalytics"),
  { ssr: false, loading: () => null }
);
import { getTranslations, getCurrentLocale } from "@/src/lib/i18n";

// Read and inline critical CSS to eliminate render-blocking request
const criticalCss = (() => {
  try {
    const filePath = path.join(
      process.cwd(),
      "public",
      "assets",
      "css",
      "critical.css"
    );
    return readFileSync(filePath, "utf-8");
  } catch (error) {
    console.error("Failed to read critical.css:", error);
    return "";
  }
})();

const nonCriticalCssHref = (() => {
  const baseHref = "/assets/css/non-critical.css" as const;
  try {
    const filePath = path.join(
      process.cwd(),
      "public",
      "assets",
      "css",
      "non-critical.css"
    );
    const fileContents = readFileSync(filePath);
    const digest = createHash("sha256").update(fileContents).digest("hex");
    const version = digest.slice(0, 10);
    return `${baseHref}?v=${version}`;
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      const err = error instanceof Error ? error : new Error(String(error));
      console.warn(
        "Unable to compute non-critical CSS hash; falling back to base href",
        err
      );
    }
  }
  return baseHref;
})();

// Using self-hosted Inter via next/font/local (see app/fonts.ts)

// Page-level metadata is exported later in this file.

// import { Inter } from "next/font/google";

// const inter = Inter({ subsets: ["latin"] });

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
        {/* Google Tag Manager */}
        <Script
          id="gtm"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','GTM-P6QT792D');`,
          }}
        />
        {/* End Google Tag Manager */}
        {/* Remove early preconnect to analytics to avoid competing with LCP; analytics loads only after consent */}
        {/** Defer Google Maps connections to pages that actually use Maps (e.g., contact). Removing global preconnect helps mobile Speed Index. */}
        {/* Preload most likely LCP hero image (accounting is first in rotation array) */}
        <link
          rel="preload"
          as="image"
          href="/assets/hero/services/accounting-hero.optimized.webp"
          type="image/webp"
          fetchPriority="high"
        />
        {/* Ensure font swap to avoid layout shifts */}
        <meta httpEquiv="Accept-CH" content="Sec-CH-Prefers-Color-Scheme" />
        {/* Title, description and viewport are managed by Next metadata API */}
        {/* Inline critical CSS to eliminate render-blocking request */}
        <style dangerouslySetInnerHTML={{ __html: criticalCss }} />
      </head>
      <body className={inter.className}>
        {/* Google Tag Manager (noscript) */}
        <noscript>
          <iframe
            src="https://www.googletagmanager.com/ns.html?id=GTM-P6QT792D"
            height="0"
            width="0"
            style={{ display: "none", visibility: "hidden" }}
          />
        </noscript>
        {/* End Google Tag Manager (noscript) */}
        {/* Accessibility: Skip link */}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 bg-primary text-primary-foreground px-3 py-2 rounded critical-skip-link"
        >
          Skip to content
        </a>
        <DeferredNonCriticalStyles href={nonCriticalCssHref} />
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
                <ConsentAnalytics gaId={gaId} />
              </Defer>
            </div>
          </ErrorBoundary>
        </Providers>
      </body>
    </html>
  );
}
