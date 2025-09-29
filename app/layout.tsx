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

// Using self-hosted Inter via next/font/local (see app/fonts.ts)

if (process.env.NODE_ENV !== "production") {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  require("./globals.css");
}

// Page-level metadata is exported later in this file.

const criticalCss = `:root {color-scheme: light;--background: 1 0 0;--foreground: 0.145 0 0;--card: 1 0 0;--card-foreground: 0.145 0 0;--popover: 1 0 0;--popover-foreground: 0.145 0 0;--primary: 0.205 0 0;--primary-foreground: 0.985 0 0;--secondary: 0.97 0 0;--secondary-foreground: 0.205 0 0;--muted: 0.97 0 0;--muted-foreground: 0.556 0 0;--accent: 0.97 0 0;--accent-foreground: 0.205 0 0;--destructive: 0.577 0.245 27.325;--border: 0.922 0 0;--input: 0.922 0 0;--ring: 0.708 0 0;--radius: 0.625rem;--breakpoint-xl: 1200px;}
.dark {--background: 0.145 0 0;--foreground: 0.985 0 0;--card: 0.205 0 0;--card-foreground: 0.985 0 0;--popover: 0.205 0 0;--popover-foreground: 0.985 0 0;--primary: 0.922 0 0;--primary-foreground: 0.205 0 0;--secondary: 0.269 0 0;--secondary-foreground: 0.985 0 0;--muted: 0.269 0 0;--muted-foreground: 0.708 0 0;--accent: 0.269 0 0;--accent-foreground: 0.985 0 0;--destructive: 0.704 0.191 22.216;--border: 1 0 0 / 0.1;--input: 1 0 0 / 0.15;--ring: 0.556 0 0;color-scheme: dark;}
*,*::before,*::after{box-sizing:border-box;}
html{scroll-behavior:smooth;}
body{margin:0;min-height:100vh;background-color:oklch(var(--background));color:oklch(var(--foreground));font-family:var(--font-inter, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif);line-height:1.6;}
img{display:block;max-width:100%;}
a{color:inherit;text-decoration:none;}
button,input,select,textarea{font:inherit;}
main{position:relative;z-index:0;padding-top:4rem;}
.abstract-background{position:relative;background-image:linear-gradient(to bottom,oklch(var(--background) / 0.5),oklch(var(--background) / 0.75),oklch(var(--background) / 0.9),oklch(var(--background)));}
.dark .abstract-background{background-color:#000;background-image:linear-gradient(to bottom,oklch(var(--background) / 0.5),oklch(var(--background) / 0.8),oklch(var(--background)));}
.critical-skip-link{position:absolute;left:-999px;top:auto;width:1px;height:1px;overflow:hidden;}
.critical-skip-link:focus{left:1rem;top:1rem;width:auto;height:auto;padding:0.75rem 1.25rem;border-radius:0.75rem;z-index:999;background:oklch(var(--primary));color:oklch(var(--primary-foreground));box-shadow:0 12px 28px rgba(32,54,98,0.25);}
.critical-nav__container{position:fixed;top:0;left:0;right:0;z-index:50;width:100%;max-width:100vw;}
.critical-nav{backdrop-filter:blur(14px);background:rgba(255,255,255,0.92);border-bottom:1px solid oklch(var(--accent));}
.dark .critical-nav{background:rgba(8,12,24,0.82);border-color:oklch(var(--border));}
.critical-nav__surface{height:4rem;background:transparent;display:flex;align-items:center;}
.critical-nav__inner{display:flex;align-items:center;justify-content:space-between;gap:1rem;height:100%;margin:0 auto;max-width:1200px;padding:0 1rem;width:100%;}
@media(min-width:640px){.critical-nav__inner{padding:0 1.5rem;}}
.critical-nav__logo{display:flex;align-items:center;}
.critical-nav__links{display:none;}
@media(min-width:768px){.critical-nav__links{display:block;}}
.critical-nav__link{display:inline-flex;align-items:center;justify-content:center;padding:0.5rem 0.75rem;border-radius:0.75rem;font-weight:500;font-size:0.95rem;transition:background-color 160ms ease,color 160ms ease;}
.critical-nav__link:hover{background-color:oklch(var(--accent));color:oklch(var(--accent-foreground));}
.critical-nav__mobile{display:flex;}
@media(min-width:768px){.critical-nav__mobile{display:none;}}
.critical-hero{position:relative;width:100%;overflow:hidden;border-bottom:1px solid oklch(var(--accent));padding:6rem 1.5rem 3rem;display:flex;align-items:center;justify-content:center;min-height:calc(100vh - 4rem);}
@media(min-width:1024px){.critical-hero{padding:6rem 2rem 4rem;}}
.critical-hero__inner{display:flex;flex-direction:column;gap:3rem;align-items:center;justify-content:space-between;width:100%;max-width:var(--breakpoint-xl);}
@media(min-width:1024px){.critical-hero__inner{flex-direction:row;}}
.critical-hero__content{max-width:640px;text-align:center;}
.critical-hero__content h1{font-size:clamp(2.4rem,5vw,3.4rem);font-weight:700;margin:1.5rem 0 0;color:oklch(var(--foreground));}
.critical-hero__content p{margin-top:1.5rem;font-size:1.05rem;line-height:1.7;color:oklch(var(--muted-foreground));}
.critical-hero__badges{display:flex;flex-wrap:wrap;gap:0.75rem;justify-content:center;}
@media(min-width:1024px){.critical-hero__badges{justify-content:center;}}
.critical-hero__cta{margin-top:3rem;display:flex;flex-direction:column;gap:1rem;align-items:center;justify-content:center;}
@media(min-width:640px){.critical-hero__cta{flex-direction:row;}}
@media(min-width:1024px){.critical-hero__cta{align-items:center;justify-content:center;}}
.critical-button{display:inline-flex;align-items:center;justify-content:center;gap:0.5rem;border-radius:999px;padding:0.85rem 1.75rem;font-weight:600;font-size:1rem;background:oklch(var(--primary));color:oklch(var(--primary-foreground));box-shadow:0 12px 30px rgba(32,54,98,0.18);transition:transform 180ms ease,box-shadow 180ms ease;border:none;cursor:pointer;text-decoration:none;}
.critical-button:hover{transform:translateY(-1px);box-shadow:0 14px 36px rgba(32,54,98,0.22);}
.critical-badge{display:inline-flex;align-items:center;justify-content:center;padding:0.4rem 0.9rem;border-radius:999px;font-weight:600;font-size:0.8rem;letter-spacing:0.01em;}
.critical-badge--destructive{background:oklch(var(--destructive));color:#fff;}
.critical-badge--secondary{background:oklch(var(--secondary));color:oklch(var(--secondary-foreground));}
.critical-hero__media{position:relative;max-width:480px;width:100%;aspect-ratio:1/1;border-radius:28px;overflow:hidden;background:oklch(var(--accent));box-shadow:0 25px 60px rgba(15,23,42,0.15);display:flex;align-items:center;justify-content:center;}
.dark .critical-hero__media{background:rgba(255,255,255,0.08);box-shadow:0 25px 60px rgba(0,0,0,0.45);}
.critical-hero__media img{width:100%;height:100%;object-fit:cover;border-radius:inherit;}
.critical-hero__partner{position:absolute;left:50%;right:auto;bottom:1.75rem;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:0.5rem;pointer-events:none;transform:translateX(-50%);width:max-content;}
.critical-hero__partner img{height:40px;width:auto;opacity:0.9;}`;

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
    default: "Ark Fiduciaire - Swiss Fiduciary Services",
  },
  description:
    "Expert fiduciary, accounting, and tax services in Switzerland. Corporate services, payroll management, domiciliation, and comprehensive business solutions for SMEs and international companies in Geneva and Lausanne.",
  keywords:
    "fiduciary services, accounting, tax services, Switzerland, corporate services, payroll, domiciliation",
  authors: [{ name: "Ark Fiduciaire" }],
  creator: "Ark Fiduciaire",
  publisher: "Ark Fiduciaire",
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
    name: "Ark Fiduciaire",
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
        {/* Remove early preconnect to analytics to avoid competing with LCP; analytics loads only after consent */}
        {/** Defer Google Maps connections to pages that actually use Maps (e.g., contact). Removing global preconnect helps mobile Speed Index. */}
        {/* Next/Image with priority handles preloading of LCP image. Avoid duplicate preload to keep mobile SI low. */}
        {/* Ensure font swap to avoid layout shifts */}
        <meta httpEquiv="Accept-CH" content="Sec-CH-Prefers-Color-Scheme" />
        {/* Title, description and viewport are managed by Next metadata API */}
        <style
          nonce={nonce}
          data-critical
          dangerouslySetInnerHTML={{ __html: criticalCss }}
        />
      </head>
      <body className={inter.className}>
        {/* Accessibility: Skip link */}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 bg-primary text-primary-foreground px-3 py-2 rounded critical-skip-link"
        >
          Skip to content
        </a>
        <DeferredNonCriticalStyles />
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
            <Defer rootMargin="0px" idle={200} placeholder={null}>
              {/* Client-only widgets mounted after first paint */}
              <CookieConsent
                nonce={nonce}
                locale={currentLocale}
                labels={cookieLabels}
              />
              {/* Render Vercel Analytics only when user accepted cookies */}
              <ConsentAnalytics />
            </Defer>
          </div>
        </Providers>
      </body>
    </html>
  );
}
