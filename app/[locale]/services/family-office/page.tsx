import { Metadata } from "next";
import Hero from "./components/hero";
import { headers } from "next/headers";
import Presentation from "./components/presentation";
import { generateMetadataForPage } from "@/src/lib/metadata";
import { getTranslations, type Locale } from "@/src/lib/i18n";

export const runtime = "nodejs";

export async function generateMetadata({
  params: { locale },
}: {
  params: { locale: string };
}): Promise<Metadata> {
  return await generateMetadataForPage(
    locale as Locale,
    "/services/family-office"
  );
}

const FamilyOffice = async ({ params }: { params: { locale: string } }) => {
  const nonce = headers().get("x-nonce") || undefined;
  const baseUrl = "https://ark-fid.ch";
  const localePrefix = params.locale ? `/${params.locale}` : "";
  const locale = params.locale as Locale;
  const tNav = await getTranslations(locale, "navbar");
  const tFamily = await getTranslations(locale, "family-office");
  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: tNav("Services") as string,
        item: `${baseUrl}${localePrefix}/services/`,
      },
      {
        "@type": "ListItem",
        position: 2,
        name:
          (tFamily("Breadcrumb.Label") as string) ||
          (tFamily("Hero.Title") as string) ||
          "Family office",
        item: `${baseUrl}${localePrefix}/services/family-office/`,
      },
    ],
  } as const;
  return (
    <div>
      <script
        type="application/ld+json"
        nonce={nonce}
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <Hero params={params} />
      <nav
        aria-label="Breadcrumb"
        className="max-w-[var(--breakpoint-xl)] mx-auto px-4 md:px-6 mt-4 mb-6"
      >
        <ol className="flex items-center gap-1 text-sm text-muted-foreground">
          <li>
            <a href={`${localePrefix}/`} className="hover:underline">
              {tNav("Home") as string}
            </a>
          </li>
          <li className="flex items-center gap-1">
            <span className="text-muted-foreground/60">/</span>
            <a href={`${localePrefix}/services/`} className="hover:underline">
              {tNav("Services") as string}
            </a>
          </li>
          <li className="flex items-center gap-1">
            <span className="text-muted-foreground/60">/</span>
            <span aria-current="page" className="font-medium text-foreground">
              {(tFamily("Breadcrumb.Label") as string) ||
                (tFamily("Hero.Title") as string) ||
                "Family office"}
            </span>
          </li>
        </ol>
      </nav>
      <Presentation locale={locale} t={tFamily} />
    </div>
  );
};

export default FamilyOffice;
