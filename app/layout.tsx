// app/layout.tsx
import { Providers } from "@/src/components/providers";
import { Metadata, Viewport } from "next";
import { buildOrganizationGraph } from "@/src/lib/structuredData";
import { inter } from "./fonts";
import { headers } from "next/headers";
import ErrorBoundary from "@/src/components/ErrorBoundary";
import { CookieConsent } from "@/src/components/ClientOnlyDynamic";
import EngagementTracker from "@/src/components/EngagementTracker";
import OpenAiPixel from "@/src/components/OpenAiPixel";
import AttributionTracker from "@/src/components/AttributionTracker";
import {
  buildConsentBootstrap,
  isValidMeasurementId,
} from "@/src/lib/consent-mode";
import WhatsAppLink from "@/src/components/ui/whatsapp-link";
import { ANALYTICS_FREE_HEADER, isAnalyticsFree } from "@/src/lib/analytics-free";
import "./globals.css";
import { getTranslations, getCurrentLocale } from "@/src/lib/i18n";
import {
  WHATSAPP_BADGE_FALLBACK,
  WHATSAPP_CTA_FALLBACK,
} from "@/src/lib/whatsapp";

const GTM_ID = "GTM-P6QT792D";

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL || "https://ark-fid.ch"
  ),
  // No title template: every page sets its full title (brand included) via
  // src/translations/<locale>/metadata.json, so a template would double the brand.
  title: "Ark Fiduciaire SA - Swiss Fiduciary Services",
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
  // ✅ read nonce from the middleware
  const requestHeaders = await headers();
  const nonce = requestHeaders.get("x-nonce") || undefined;
  // KYC and tax questionnaires (client data): no analytics at all, see src/lib/analytics-free.ts.
  const analyticsFree =
    requestHeaders.get(ANALYTICS_FREE_HEADER) === "1" ||
    isAnalyticsFree(requestHeaders.get("host") || "", requestHeaders.get("x-pathname") || "");
  const configuredGaId =
    process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID || process.env.NEXT_PUBLIC_GA_ID;
  const gaId = isValidMeasurementId(configuredGaId)
    ? configuredGaId
    : "G-BXZ54E31FL";
  const currentLocale = await getCurrentLocale();

  const tCookie = await getTranslations(currentLocale, "cookie");
  const tContact = await getTranslations(currentLocale, "contact");
  const cookieLabels = {
    Title: tCookie("Title"),
    Text: tCookie("Text"),
    LearnMore: tCookie("LearnMore"),
    Accept: tCookie("Accept"),
    Decline: tCookie("Decline"),
    Manage: tCookie("Manage"),
  } as const;
  const whatsappLabels = {
    badge: (tContact("WhatsApp.Badge") as string) || WHATSAPP_BADGE_FALLBACK,
    cta: (tContact("WhatsApp.Open") as string) || WHATSAPP_CTA_FALLBACK,
  } as const;

  const organizationGraphJsonLd = buildOrganizationGraph(currentLocale);

  return (
    <html
      suppressHydrationWarning
      lang={currentLocale}
      className={inter.variable}
    >
      <head>
        {/* Consent Mode v2 bootstrap: regional defaults + stored choice, then
            gtag.js and gtm.js after load + idle. Must run before any other gtag call. */}
        {analyticsFree ? null : (
          <script
            nonce={nonce}
            dangerouslySetInnerHTML={{ __html: buildConsentBootstrap(gaId, GTM_ID) }}
          />
        )}
        {nonce ? <meta name="csp-nonce" content={nonce} /> : null}
        <meta httpEquiv="Accept-CH" content="Sec-CH-Prefers-Color-Scheme" />
        <link
          rel="preload"
          href="/assets/fonts/Inter-Regular.woff2?v=2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
        <link
          rel="preload"
          href="/assets/fonts/Inter-SemiBold.woff2?v=2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
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
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(organizationGraphJsonLd),
          }}
        />

        <Providers nonce={nonce}>
          <ErrorBoundary>
            <div className="text-foreground">
              {children}

              <WhatsAppLink
                badgeText={whatsappLabels.badge}
                ctaLabel={whatsappLabels.cta}
              />

              {analyticsFree ? null : (
                <>
                  <CookieConsent
                    nonce={nonce}
                    locale={currentLocale}
                    labels={cookieLabels}
                  />

                  <OpenAiPixel nonce={nonce} />
                  <AttributionTracker />

                  {/* GTM se charge dans l'amorce du <head> (après chargement + moment libre), pour tous les visiteurs sauf KYC et questionnaire fiscal. */}
                  <EngagementTracker />
                </>
              )}
            </div>
          </ErrorBoundary>
        </Providers>
      </body>
    </html>
  );
}
