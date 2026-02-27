import React from "react";
import { Metadata } from "next";
import Hero from "./components/hero";
import Presentation from "./components/presentation";
import { generateMetadataForPage } from "@/src/lib/metadata";
import { getTranslations, type Locale } from "@/src/lib/i18n";
import { headers } from "next/headers";

export async function generateMetadata(
  props: {
    params: Promise<{ locale: string }>;
  }
): Promise<Metadata> {
  const params = await props.params;

  const {
    locale
  } = params;

  return await generateMetadataForPage(locale as Locale, "/partners");
}

const PartnersPage = async (props: { params: Promise<{ locale: string }> }) => {
  const params = await props.params;
  const baseUrl = "https://ark-fid.ch";
  const nonce = (await headers()).get("x-nonce") || undefined;
  const localePrefix = params.locale ? `/${params.locale}` : "/fr";
  const t = await getTranslations(params.locale as Locale, "partners");
  const tNav = await getTranslations(params.locale as Locale, "navbar");
  const partners = t("Partners") as any[];
  const serviceAreas = t("ServiceAreas.Areas") as any[];
  const benefits = t("Partnership.Benefits") as string[];
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
    <div>
      <script
        type="application/ld+json"
        nonce={nonce}
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <Hero locale={params.locale} />
      <header className="px-6 py-5 text-left">
        <nav
          aria-label="Breadcrumb"
          className="w-full max-w-[1200px] mx-auto mt-4 mb-6 px-6 md:px-0"
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
      </header>
      <Presentation
        locale={params.locale}
        partners={partners}
        serviceAreas={serviceAreas}
        benefits={benefits}
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
          contactSecondaryCta: t("Contact.SecondaryButtonText"),
        }}
      />
    </div>
  );
};

export default PartnersPage;
