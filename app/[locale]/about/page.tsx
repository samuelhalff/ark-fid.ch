import React from "react";
import { Building2 } from "lucide-react";
import { headers } from "next/headers";
import { Metadata } from "next";
import { generateMetadataForPage } from "@/src/lib/metadata";
import { getTranslations, type Locale } from "@/src/lib/i18n";
import DNAValuesSection, {
  type DNAValueItem,
} from "@/src/components/ui/dna-values-section";
import ContextualLinks from "@/src/components/ui/contextual-links";

export async function generateMetadata({
  params: { locale },
}: {
  params: { locale: string };
}): Promise<Metadata> {
  return await generateMetadataForPage(locale as Locale, "/about");
}

export default async function AboutUsPage({
  params,
}: {
  params: { locale: string };
}) {
  const locale = (params?.locale as Locale) || ("fr" as Locale);
  const t = await getTranslations(locale, "about-us");
  const tNav = await getTranslations(locale, "navbar");
  const baseUrl = "https://ark-fid.ch";
  const nonce = headers().get("x-nonce") || undefined;
  const localePrefix = params?.locale ? `/${params.locale}` : "/fr";

  // Fallback helpers: get arrays or use defaults when missing
  const getArray = <T,>(key: string, fallback: T[]): T[] => {
    const v = t(key) as unknown;
    if (!v || typeof v === "string") return fallback;
    if (Array.isArray(v)) return v as T[];
    return fallback;
  };

  const defaultDNA: DNAValueItem[] = [
    {
      Title: "Swiss Precision",
      Desc: "We embody traditional Swiss values of accuracy and reliability.",
    },
    {
      Title: "Innovation Forward",
      Desc: "We embrace cutting-edge technology and modern methodologies.",
    },
    {
      Title: "Client-Centric Approach",
      Desc: "Our diverse team provides tailored solutions for each client.",
    },
    {
      Title: "Collaborative Excellence",
      Desc: "Our culture of collaboration drives superior results.",
    },
  ];

  const dnaValues = getArray<DNAValueItem>("DNA.Values", defaultDNA);
  const foundation = getArray<string>("Foundation.Content", [
    "Our company was founded through the strategic union of established firms.",
    "This represents years of growth and expertise coming together.",
  ]);
  const expertise = getArray<string>("Expertise.Content", [
    "Our team combines decades of experience across multiple disciplines.",
    "This diversity enables us to serve various types of clients with expertise.",
  ]);
  const vision = getArray<string>("Vision.Content", [
    "We envision ourselves as the trusted partner for businesses.",
    "Through innovation and technology, we transform traditional services.",
  ]);
  const partnership = getArray<string>("Partnership.Content", [
    "Our merger represents more than combining resources—it's about creating synergies.",
    "This partnership approach extends to our client relationships.",
  ]);
  const future = getArray<string>("Future.Content", [
    "We remain committed to the principles that made our founding firms successful.",
    "The future is built on our merged expertise and shared vision.",
  ]);

  const text = (key: string, fallback: string) => {
    const v = t(key);
    return typeof v === "string" && v !== key ? v : fallback;
  };

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: (tNav("Home") as string) || "Home",
        item: `${baseUrl}${localePrefix}/`,
      },
      {
        "@type": "ListItem",
        position: 2,
        name: text("Hero.Title", "About"),
        item: `${baseUrl}${localePrefix}/about/`,
      },
    ],
  } as const;

  return (
    <div className="min-h-screen">
      <script
        type="application/ld+json"
        nonce={nonce}
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      {/* Hero Section */}
      <section className="mx-auto w-full py-12 xs:py-20 px-6 flex flex-col items-center pt-25">
        <div className="w-full max-w-[1200px] text-center">
          <div className="inline-flex items-center rounded-lg bg-muted px-3 py-1 text-sm font-medium mb-6">
            <Building2 className="mr-2 h-4 w-4" />
            {text("Hero.Badge", "Established 2025")}
          </div>

          <h1 className="text-3xl xs:text-4xl md:text-5xl md:leading-[3.5rem] font-bold tracking-tight mb-6">
            {text("Hero.Title", "About Ark Fiduciaire")}
          </h1>

          <h2 className="text-xl xs:text-2xl md:text-2xl mb-8 md:leading-[2rem] tracking-tight">
            {text(
              "Hero.Subtitle",
              "Born from excellence, united for innovation"
            )}
          </h2>
        </div>
      </section>

      <div className="max-w-[1200px] mx-auto px-6 pb-20">
        <nav aria-label="Breadcrumb" className="px-0 mt-2 mb-6">
          <ol className="flex items-center gap-1 text-sm text-muted-foreground">
            <li>
              <a href={`${localePrefix}/`} className="hover:underline">
                {(tNav("Home") as string) || "Home"}
              </a>
            </li>
            <li className="flex items-center gap-1">
              <span className="text-muted-foreground/60">/</span>
              <span aria-current="page" className="font-medium text-foreground">
                {text("Hero.Title", "About Ark Fiduciaire")}
              </span>
            </li>
          </ol>
        </nav>
        <div className="space-y-20">
          {/* Foundation Section */}
          <section>
            <h3 className="text-xl xs:text-2xl md:text-2xl font-bold mb-8 md:leading-[2rem] tracking-tight">
              {text("Foundation.Title", "Our Foundation")}
            </h3>
            <div className="space-y-6">
              <ContextualLinks>{foundation}</ContextualLinks>
            </div>
          </section>

          {/* DNA Section */}
          <DNAValuesSection
            title={text("DNA.Title", "Our DNA")}
            subtitle={text("DNA.Subtitle", "The Values That Define Us")}
            values={dnaValues}
          />

          {/* Expertise Section */}
          <section>
            <h3 className="text-xl xs:text-2xl md:text-2xl font-bold mb-8 md:leading-[2rem] tracking-tight">
              {text("Expertise.Title", "Collective Expertise")}
            </h3>
            <div className="space-y-6">
              <ContextualLinks>{expertise}</ContextualLinks>
            </div>
          </section>

          {/* Vision Section */}
          <section>
            <h3 className="text-xl xs:text-2xl md:text-2xl font-bold mb-8 md:leading-[2rem] tracking-tight">
              {text("Vision.Title", "Our Vision")}
            </h3>
            <div className="space-y-6">
              <ContextualLinks>{vision}</ContextualLinks>
            </div>
          </section>

          {/* Partnership Section */}
          <section>
            <h3 className="text-xl xs:text-2xl md:text-2xl font-bold mb-8 md:leading-[2rem] tracking-tight">
              {text("Partnership.Title", "The Power of Partnership")}
            </h3>
            <div className="space-y-6">
              <ContextualLinks>{partnership}</ContextualLinks>
            </div>
          </section>

          {/* Future Section */}
          <section>
            <h3 className="text-xl xs:text-2xl md:text-2xl font-bold mb-8 md:leading-[2rem] tracking-tight">
              {text("Future.Title", "Looking Forward")}
            </h3>
            <div className="space-y-6">
              <ContextualLinks>{future}</ContextualLinks>
            </div>
          </section>

          {/* Call to Action */}
          <section className="text-center bg-primary/5 rounded-lg p-8">
            <h3 className="text-xl xs:text-2xl md:text-2xl font-bold mb-4">
              {text("CTA.Title", "Ready to Partner with Us?")}
            </h3>
            <p className="text-lg mb-6">
              {text(
                "CTA.Description",
                "Discover how our combined expertise can benefit your business."
              )}
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <a
                href={`${localePrefix}/contact`}
                className="inline-flex items-center justify-center rounded-md bg-primary px-6 py-3 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90 transition-colors"
              >
                {text("CTA.ContactButton", "Get in Touch")}
              </a>
              <a
                href={`${localePrefix}/team`}
                className="inline-flex items-center justify-center rounded-md border border-input bg-background px-6 py-3 text-sm font-medium shadow-sm hover:bg-accent hover:text-accent-foreground transition-colors"
              >
                {text("CTA.TeamButton", "Meet Our Team")}
              </a>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
