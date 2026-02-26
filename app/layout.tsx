// app/layout.tsx
import { Providers } from "@/src/components/providers";
import { Metadata, Viewport } from "next";
import {
  generateOrganizationStructuredData,
  generateLocalBusinessStructuredData,
} from "@/src/lib/metadata";
import { inter } from "./fonts";
import { headers } from "next/headers";
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
        url: "/favicon.ico",
        sizes: "any",
      },
      { url: "/favicon.png", type: "image/png" },
    ],
    apple: [{ url: "/favicon.png", sizes: "180x180", type: "image/png" }],
  },
  other: {
    "msvalidate.01": "C5C559E7A2F5598C1884F1DB1EBB8AA6",
  },
};

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
  // ✅ read nonce and UA headers from the middleware
  const nonce = (await headers()).get("x-nonce") || undefined;
  const userAgent = (await headers()).get("user-agent") || "";
  const isIOS = /iPad|iPhone|iPod/.test(userAgent);
  const isAndroid = /Android/.test(userAgent);
  const gaId = isIOS
    ? "G-6YG8R7QMN7"
    : isAndroid
    ? "G-PBFJ9TQ7NR"
    : "G-BXZ54E31FL";
  const currentLocale = await getCurrentLocale();

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

  return (
    <html
      suppressHydrationWarning
      lang={currentLocale}
      className={inter.variable}
    >
      {/* ✅ add nonce to <head> so Next’s internal scripts use it */}
      <head nonce={nonce}>
        {nonce ? <meta name="csp-nonce" content={nonce} /> : null}
        <meta httpEquiv="Accept-CH" content="Sec-CH-Prefers-Color-Scheme" />
        <link
          rel="preload"
          href="/assets/abstract-background-light.avif"
          as="image"
          fetchPriority="high"
        />
        <link
          rel="preload"
          href="/assets/abstract-background-dark.avif"
          as="image"
          fetchPriority="high"
        />
      </head>

      <body className={inter.className}>
        {/* ✅ expose nonce to client so dynamic scripts can reuse it */}
        <script
          nonce={nonce}
          dangerouslySetInnerHTML={{
            __html: `window.__CSP_NONCE__ = ${JSON.stringify(nonce)};`,
          }}
        />

        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[999] focus:w-auto focus:h-auto focus:px-5 focus:py-3 focus:rounded-lg bg-primary text-primary-foreground focus:shadow-xl"
        >
          Skip to content
        </a>

        {/* ✅ All inline JSON-LD scripts keep the same nonce */}
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

        <Providers nonce={nonce}>
          <ErrorBoundary>
            <div className="pt-3 abstract-background text-foreground pt-15 mt-10">
              {children}

              <CookieConsent
                nonce={nonce}
                locale={currentLocale}
                labels={cookieLabels}
              />

              <Defer rootMargin="0px" idle={200} placeholder={null}>
                <ConsentAnalytics
                  gaId={gaId}
                  gtmId="GTM-P6QT792D"
                  nonce={nonce}
                />
              </Defer>
            </div>
          </ErrorBoundary>
        </Providers>
      </body>
    </html>
  );
}
