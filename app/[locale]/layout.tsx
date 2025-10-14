import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import ServicesElements from "@/app/[locale]/navigation";
import { getTranslations } from "@/src/lib/i18n";
import { headers } from "next/headers";
import { localizePath } from "@/src/lib/paths";

const locales = ["en", "fr", "de", "es", "pt"] as const;
type Locale = (typeof locales)[number];
const isLocale = (value: string): value is Locale =>
  locales.includes(value as Locale);

export const dynamic = "force-dynamic";

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

// Remove generateMetadata here to avoid alternates duplication; use per-page metadata utilities instead.

export default async function LocaleLayout({
  children,
  params: { locale },
}: {
  children: ReactNode;
  params: { locale: string };
}) {
  // Validate that the incoming `locale` parameter is valid
  if (!isLocale(locale)) {
    notFound();
  }

  const activeLocale: Locale = locale;

  // NOTE: Root layout (`app/layout.tsx`) is responsible for <html> and <body>.
  // Nested layouts must NOT render html/body. Keep this layout minimal so
  // providers (ThemeProvider) and NavBar remain singletons in the root.
  const Navbar = (await import("@/src/components/navigation/NavbarServer"))
    .default;
  const Footer = (await import("@/app/[locale]/shared/footer")).default;

  // Prepare server-side translated navigation labels and services list to avoid SSR key leakage
  const tNavbar = await getTranslations(activeLocale, "navbar");
  const tServices = await getTranslations(activeLocale, "servicesItems");
  const navData = {
    labels: {
      home: tNavbar("Home"),
      team: tNavbar("Team"),
      services: tNavbar("Services"),
      ressources: tNavbar("Ressources"),
      about: tNavbar("About"),
      contact: tNavbar("Contact"),
      mobileNavigation: tNavbar("MobileNavigation"),
    },
    services: ServicesElements.map((service) => ({
      ...service,
      title: tServices(service.titleKey),
      description: tServices(service.descriptionKey),
    })),
  };
  return (
    <div data-locale={activeLocale} lang={activeLocale}>
      {/* Render client NavBar with server-provided locale */}
      <Navbar locale={activeLocale} navData={navData} />
      <main id="main-content" role="main">
        {children}
      </main>
      <Footer locale={activeLocale} />
    </div>
  );
}
