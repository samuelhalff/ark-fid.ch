// You'll want a global CSS file for base styles and Tailwind imports
import "./globals.css";

// NavBar moved into locale layout so it can receive the current locale from params

import { Providers } from "@/src/components/providers"; // Import your new client provider
import { Metadata, Viewport } from "next";
import {
  generateOrganizationStructuredData,
  generateLocalBusinessStructuredData,
} from "@/src/lib/metadata";
import { Inter } from "next/font/google";
import { headers } from "next/headers";
// Vercel Analytics is rendered conditionally via ConsentAnalytics
import CookieConsent from "@/src/components/CookieConsent";
import ConsentAnalytics from "@/src/components/ConsentAnalytics";
import { getTranslations } from "@/src/lib/i18n";

const inter = Inter({ subsets: ["latin"], display: "swap" });

// import { Inter } from "next/font/google";

// const inter = Inter({ subsets: ["latin"] });

// Here we define the STATIC metadata for the entire site
// This is the baseline, and can be overridden by individual pages

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"
  ),
  title: {
    template: "%s - Ark Fiduciaire",
    default: "Ark Fiduciaire - Professional Fiduciary Services in Switzerland",
  },
  description:
    "Expert fiduciary, accounting, and tax services in Switzerland. Corporate services, payroll management, domiciliation, and comprehensive business solutions.",
  keywords:
    "fiduciary services, accounting, tax services, Switzerland, corporate services, payroll, domiciliation",
  authors: [{ name: "Ark Fiduciaire" }],
  creator: "Ark Fiduciaire",
  publisher: "Ark Fiduciaire",
  robots: {
    index: true,
    follow: true,
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
  const currentLocale = headers().get("x-locale") || "fr";
  // Load cookie consent labels server-side to avoid client i18n
  const tCookie = await getTranslations(currentLocale as any, "cookie");
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
    name: "Ark Fiduciaire",
    potentialAction: {
      "@type": "SearchAction",
      target: "https://ark-fid.ch/?q={search_term_string}",
      "query-input": "required name=search_term_string",
    },
  } as const;
  return (
    <html suppressHydrationWarning lang={currentLocale}>
      <head>
        <link
          rel="preconnect"
          href="https://vitals.vercel-analytics.com"
          crossOrigin="anonymous"
        />
        {/** Defer Google Maps connections to pages that actually use Maps (e.g., contact). Removing global preconnect helps mobile Speed Index. */}
        {/* Next/Image with priority handles preloading of LCP image. Avoid duplicate preload to keep mobile SI low. */}
        {/* Ensure font swap to avoid layout shifts */}
        <meta httpEquiv="Accept-CH" content="Sec-CH-Prefers-Color-Scheme" />
      </head>
      <body className={inter.className}>
        {/* Accessibility: Skip link */}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 bg-primary text-primary-foreground px-3 py-2 rounded"
        >
          Skip to content
        </a>
        {/* Inline script to set theme class before React hydrates to avoid flicker */}
        <script
          nonce={nonce}
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var theme=localStorage.getItem('theme');if(theme==='dark'||(!theme&&window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches)){document.documentElement.classList.add('dark');}else{document.documentElement.classList.remove('dark');}}catch(e){} })()`,
          }}
        />
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
          <div className="pt-3 abstract-background text-foreground pt-15 mt-10">
            {children}
            {/* Cookie Consent banner and GA4 loader (loads GA only after acceptance) */}
            <CookieConsent
              nonce={nonce}
              locale={currentLocale}
              labels={cookieLabels}
            />
            {/* Render Vercel Analytics only when user accepted cookies */}
            <ConsentAnalytics />
          </div>
        </Providers>
      </body>
    </html>
  );
}
