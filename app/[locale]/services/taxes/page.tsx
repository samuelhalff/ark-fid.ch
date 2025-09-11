import { Metadata } from "next";
import Hero from "./components/hero";
import { headers } from "next/headers";
import Presentation from "./components/presentation";
import { generateMetadataForPage } from "@/src/lib/metadata";
import { type Locale } from "@/src/lib/i18n";
import Breadcrumbs from "@/src/components/navigation/Breadcrumbs";

export const runtime = "nodejs";

export async function generateMetadata({
  params: { locale },
}: {
  params: { locale: string };
}): Promise<Metadata> {
  return await generateMetadataForPage(locale as Locale, "/services/taxes");
}

const Taxes = ({ params }: { params: { locale: string } }) => {
  const nonce = headers().get("x-nonce") || undefined;
  const baseUrl = "https://ark-fid.ch";
  const localePrefix = params.locale ? `/${params.locale}` : "";
  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Services",
        item: `${baseUrl}${localePrefix}/services/`,
      },
      {
        "@type": "ListItem",
        position: 2,
        name: "Taxes",
        item: `${baseUrl}${localePrefix}/services/taxes/`,
      },
    ],
  } as const;
  return (
    <main>
      <script
        type="application/ld+json"
        nonce={nonce}
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <Hero params={params} />
      <div className="max-w-[1200px] mx-auto px-4 md:px-6 mt-4">
        <Breadcrumbs
          rootLabel="Home"
          baseLabel="Services"
          segments={[{ segment: "taxes", label: "Taxes" }]}
        />
      </div>
      <Presentation />
    </main>
  );
};

export default Taxes;
