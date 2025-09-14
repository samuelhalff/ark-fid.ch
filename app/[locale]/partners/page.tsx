import React from "react";
import { Metadata } from "next";
import Hero from "./components/hero";
import Presentation from "./components/presentation";
import { generateMetadataForPage } from "@/src/lib/metadata";
import { getTranslations, type Locale } from "@/src/lib/i18n";
import { headers } from "next/headers";

export async function generateMetadata({
  params: { locale },
}: {
  params: { locale: string };
}): Promise<Metadata> {
  return await generateMetadataForPage(locale as Locale, "/partners");
}

const PartnersPage = async ({ params }: { params: { locale: string } }) => {
  const baseUrl = "https://ark-fid.ch";
  const nonce = headers().get("x-nonce") || undefined;
  const localePrefix = params.locale ? `/${params.locale}` : "/fr";
  const t = await getTranslations(params.locale as Locale, "partners");
  const tNav = await getTranslations(params.locale as Locale, "navbar");
  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: (t("IntroTitle") as string) || "Partners",
        item: `${baseUrl}${localePrefix}/partners/`,
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
      <Hero locale={params.locale} />
      <nav
        aria-label="Breadcrumb"
        className="max-w-[var(--breakpoint-xl)] mx-auto px-0 mt-4"
      >
        <ol className="flex items-center gap-1 text-sm text-muted-foreground">
          <li>
            <a href={`${localePrefix}/`} className="hover:underline">
              {(tNav("Home") as string) || "Home"}
            </a>
          </li>
          <li className="flex items-center gap-1">
            <span className="text-muted-foreground/60">/</span>
            <span aria-current="page" className="font-medium text-foreground">
              {t("IntroTitle")}
            </span>
          </li>
        </ol>
      </nav>
      <Presentation
        locale={params.locale}
        strings={{
          title: t("Presentation.Title"),
          subtitle: t("Presentation.Subtitle"),
          description: t("Presentation.Description"),
          partnersTitle: t("PartnersTitle"),
          partnersDescription: t("PartnersDescription"),
          serviceAreasTitle: t("ServiceAreas.Title"),
          serviceAreasDescription: t("ServiceAreas.Description"),
          partnershipTitle: t("Partnership.Title"),
          partnershipDescription: t("Partnership.Description"),
          contactTitle: t("Contact.Title"),
          contactDescription: t("Contact.Description"),
          contactCta: t("Contact.ButtonText"),
        }}
      />
    </main>
  );
};

export default PartnersPage;
