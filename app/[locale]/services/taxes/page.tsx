import { Metadata } from "next";
import Hero from "./components/hero";
import { headers } from "next/headers";
import Presentation from "./components/presentation";
import { generateMetadataForPage } from "@/src/lib/metadata";
import { getTranslations, type Locale } from "@/src/lib/i18n";
import StructuredData from "@/src/components/seo/StructuredData";
import { buildServiceSchema } from "@/src/lib/structuredData";
import { localizePath } from "@/src/lib/paths";

export const runtime = "nodejs";
export const revalidate = false;

export async function generateMetadata(
  props: {
    params: Promise<{ locale: string }>;
  }
): Promise<Metadata> {
  const params = await props.params;

  const {
    locale
  } = params;

  return await generateMetadataForPage(locale as Locale, "/services/taxes");
}

const Taxes = async (props: { params: Promise<{ locale: string }> }) => {
  const params = await props.params;
  const nonce = (await headers()).get("x-nonce") || undefined;
  const baseUrl = "https://ark-fid.ch";
  const localePrefix = params.locale ? `/${params.locale}` : "";
  const tNav = await getTranslations(params.locale as Locale, "navbar");
  const tService = await getTranslations(params.locale as Locale, "taxes");
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
        name: (tNav("TaxesCompanyPersonal.Title") as string) || "Taxes",
        item: `${baseUrl}/${params.locale}${localizePath(
          "/services/taxes",
          params.locale as Locale
        )}/`,
      },
    ],
  } as const;
  const serviceJsonLd = buildServiceSchema({
    name:
      (tService("Hero.Title") as string) ||
      (tNav("TaxesCompanyPersonal.Title") as string) ||
      "Taxes",
    description:
      (tService("Hero.Description") as string) ||
      "Tax advisory and VAT compliance for companies and individuals.",
    serviceType: "Tax",
    url: `${baseUrl}/${params.locale}${localizePath(
      "/services/taxes",
      params.locale as Locale
    )}/`,
    areaServed: ["Geneva", "Lausanne", "Romandy", "Switzerland"],
    provider: {
      name: "Ark Fiduciaire",
      url: baseUrl,
      logo: `${baseUrl}/assets/arkfid--color.svg`,
    },
  });

  return (
    <div>
      <StructuredData nonce={nonce} data={[breadcrumbJsonLd, serviceJsonLd]} />
      <Hero params={params} />
      <nav
        aria-label="Breadcrumb"
        className="w-full max-w-[1200px] mx-auto mt-4 mb-6 px-6 md:px-0"
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
              {(tNav("TaxesCompanyPersonal.Title") as string) || "Taxes"}
            </span>
          </li>
        </ol>
      </nav>
      <Presentation />
    </div>
  );
};

export default Taxes;
