import { notFound } from "next/navigation";
import "../globals.css";

const locales = ["en", "fr", "de", "es", "pt"] as const;
type Locale = (typeof locales)[number];

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: { locale: string };
}) {
  const locale = params.locale as Locale;
  if (!locales.includes(locale)) return {};

  const base = new URL("https://ark-fid.ch");
  const languages = locales.reduce((acc, loc) => {
    acc[loc] = `${base.origin}/${loc}`;
    return acc;
  }, {} as Record<string, string>);

  return {
    alternates: {
      canonical: `${base.origin}/${locale}`,
      languages: Object.assign({ "x-default": `${base.origin}` }, languages),
    },
  };
}

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
  const Navbar = (await import("@/src/components/navigation/Navbar")).default;
  return (
    <div data-locale={locale} lang={locale}>
      {/* Render client NavBar with server-provided locale */}
      {/* @ts-ignore-next-line */}
      <Navbar locale={locale} />
      {children}
    </div>
  );
}
