import { notFound } from "next/navigation";
import "../globals.css";
import ServicesElements from "@/app/[locale]/navigation";
import { getTranslations } from "@/src/lib/i18n";

const locales = ["en", "fr", "de", "es", "pt"] as const;
type Locale = (typeof locales)[number];

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

// Remove generateMetadata here to avoid alternates duplication; use per-page metadata utilities instead.

export default async function LocaleLayout({
  children,
  params: { locale },
}: {
  children: React.ReactNode;
  params: { locale: string };
}) {
  // Validate that the incoming `locale` parameter is valid
  if (!locales.includes(locale as Locale)) {
    notFound();
  }

  // NOTE: Root layout (`app/layout.tsx`) is responsible for <html> and <body>.
  // Nested layouts must NOT render html/body. Keep this layout minimal so
  // providers (ThemeProvider) and NavBar remain singletons in the root.
  const Navbar = (await import("@/src/components/navigation/NavbarServer"))
    .default;
  const Footer = (await import("@/app/[locale]/shared/footer")).default;

  // Prepare server-side translated navigation labels and services list to avoid SSR key leakage
  const tNavbar = await getTranslations(locale as any, "navbar");
  const tServices = await getTranslations(locale as any, "servicesItems");
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
    services: ServicesElements.map((s) => ({
      href: s.href,
      title: tServices(s.titleKey),
      description: tServices(s.descriptionKey),
    })),
  };
  return (
    <div data-locale={locale} lang={locale}>
      {/* Render client NavBar with server-provided locale */}
      {/* @ts-ignore-next-line */}
      <Navbar locale={locale} navData={navData} />
      <main id="main-content" role="main">
        {children}
      </main>
      {/* @ts-ignore-next-line */}
      <Footer locale={locale} />
    </div>
  );
}
