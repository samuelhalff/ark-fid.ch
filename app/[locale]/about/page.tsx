import Link from "next/link";
import { headers } from "next/headers";
import { Metadata } from "next";
import { generateMetadataForPage } from "@/src/lib/metadata";
import { getTranslations, type Locale } from "@/src/lib/i18n";
import PageHero from "@/src/components/site/page-hero";
import SectionHeading from "@/src/components/site/section-heading";
import { CtaBanner } from "@/src/components/ui/surface";
import {
  Handshake,
  Lightbulb,
  Medal,
  Users,
} from "@phosphor-icons/react/dist/ssr";

export const revalidate = false;

export async function generateMetadata(props: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const params = await props.params;

  return await generateMetadataForPage(params.locale as Locale, "/about");
}

type DNAValueItem = {
  Title: string;
  Desc: string;
};

const dnaIconClasses =
  "flex size-11 items-center justify-center rounded-full bg-[#f5dfd5] text-[#b6542b] shadow-sm dark:bg-[#3b241c] dark:text-[#f2b294]";

const DNAIcons = [Medal, Users, Lightbulb, Handshake];

export default async function AboutUsPage(props: {
  params: Promise<{ locale: string }>;
}) {
  const params = await props.params;
  const locale = (params?.locale as Locale) || "fr";
  const t = await getTranslations(locale, "about-us");
  const tNav = await getTranslations(locale, "navbar");
  const baseUrl = "https://ark-fid.ch";
  const nonce = (await headers()).get("x-nonce") || undefined;
  const localePrefix = params?.locale ? `/${params.locale}` : "/fr";

  const getArray = <T,>(key: string, fallback: T[]): T[] => {
    const value = t(key) as unknown;
    if (!value || typeof value === "string") return fallback;
    if (Array.isArray(value)) return value as T[];
    return fallback;
  };

  const text = (key: string, fallback: string) => {
    const value = t(key);
    return typeof value === "string" && value !== key ? value : fallback;
  };

  const dnaValues = getArray<DNAValueItem>("DNA.Values", []);
  const foundation = getArray<string>("Foundation.Content", []);
  const expertise = getArray<string>("Expertise.Content", []);
  const vision = getArray<string>("Vision.Content", []);
  const partnership = getArray<string>("Partnership.Content", []);
  const future = getArray<string>("Future.Content", []);

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
      <link rel="preload" as="image" href="/assets/arkfid--color.svg" />
      <link rel="preload" as="image" href="/assets/arkfid--light.svg" />
      <script
        type="application/ld+json"
        nonce={nonce}
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />

      <div className="mx-auto max-w-[1200px] px-6 py-10 md:py-14">
        <nav aria-label="Breadcrumb" className="mb-6">
          <ol className="flex items-center gap-1 text-sm text-muted-foreground">
            <li>
              <Link href={`${localePrefix}/`} className="hover:underline">
                {(tNav("Home") as string) || "Home"}
              </Link>
            </li>
            <li className="flex items-center gap-1">
              <span className="text-muted-foreground/60">/</span>
              <span aria-current="page" className="font-medium text-foreground">
                {text("Hero.Title", "About Ark Fiduciaire")}
              </span>
            </li>
          </ol>
        </nav>

        <PageHero
          eyebrow={text("Hero.Badge", "Established 2025")}
          title={text("Hero.Title", "About Ark Fiduciaire")}
          description={text(
            "Hero.Subtitle",
            "Born from excellence, united for innovation",
          )}
        />

        <div className="mt-10 grid gap-6 lg:grid-cols-[1.12fr_0.88fr]">
          <section className="rounded-[30px] bg-surface-warm p-6 text-center shadow-sm dark:bg-card">
            <SectionHeading
              eyebrow={text("Hero.Badge", "Established 2025")}
              title={text("Foundation.Title", "Our foundation")}
              description={foundation[0] ?? ""}
              titleAs="h2"
            />
            <div className="mx-auto mt-6 max-w-3xl space-y-4 text-base leading-7 text-muted-foreground">
              {foundation.slice(1).map((paragraph, index) => (
                <p key={index}>{paragraph}</p>
              ))}
            </div>
          </section>

          <section className="rounded-[30px] bg-card p-6 text-center shadow-sm dark:bg-surface-warm">
            <SectionHeading
              eyebrow={text("DNA.Title", "Our DNA")}
              title={text("Expertise.Title", "Collective expertise")}
              description={expertise[0] ?? ""}
              titleAs="h2"
            />
            <div className="mx-auto mt-6 max-w-3xl space-y-4 text-base leading-7 text-muted-foreground">
              {expertise.slice(1).map((paragraph, index) => (
                <p key={index}>{paragraph}</p>
              ))}
            </div>
          </section>
        </div>

        <section className="mt-10">
          <SectionHeading
            eyebrow={text("DNA.Title", "Our DNA")}
            title={text("DNA.Subtitle", "The values that define us")}
            titleAs="h2"
          />
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {dnaValues.map((item, index) => {
              const Icon = DNAIcons[index % DNAIcons.length];

              return (
                <article
                  key={`${item.Title}-${index}`}
                  className="rounded-[28px] bg-surface-warm p-6 text-center shadow-sm dark:bg-card"
                >
                  <div className={`${dnaIconClasses} mx-auto`}>
                    <Icon />
                  </div>
                  <h3 className="mt-5 text-xl font-semibold tracking-tight">
                    {item.Title}
                  </h3>
                  <p className="mx-auto mt-3 max-w-[36rem] text-sm leading-7 text-muted-foreground">
                    {item.Desc}
                  </p>
                </article>
              );
            })}
          </div>
        </section>

        <div className="mt-10 grid gap-6 lg:grid-cols-2">
          <section className="rounded-[30px] bg-card p-6 text-center shadow-sm dark:bg-surface-warm">
            <SectionHeading
              eyebrow={text("Expertise.Title", "Collective expertise")}
              title={text("Vision.Title", "Our vision")}
              description={vision[0] ?? ""}
              titleAs="h2"
            />
            <div className="mx-auto mt-6 max-w-3xl space-y-4 text-base leading-7 text-muted-foreground">
              {vision.slice(1).map((paragraph, index) => (
                <p key={index}>{paragraph}</p>
              ))}
            </div>
          </section>

          <section className="rounded-[30px] bg-surface-warm p-6 text-center shadow-sm dark:bg-card">
            <SectionHeading
              eyebrow={text("Vision.Title", "Our vision")}
              title={text("Partnership.Title", "The power of partnership")}
              description={partnership[0] ?? ""}
              titleAs="h2"
            />
            <div className="mx-auto mt-6 max-w-3xl space-y-4 text-base leading-7 text-muted-foreground">
              {partnership.slice(1).map((paragraph, index) => (
                <p key={index}>{paragraph}</p>
              ))}
            </div>
          </section>
        </div>

        <CtaBanner
          className="mt-10 rounded-[32px]"
          variant="contrast"
          eyebrow={text("Future.Title", "Looking forward")}
          title={text("CTA.Title", "Ready to partner with us?")}
          description={
            <>
              {future[0] ?? ""}
              {future.length > 1 ? (
                <span className="mt-5 block space-y-4">
                  {future.slice(1).map((paragraph, index) => (
                    <span key={index} className="block">
                      {paragraph}
                    </span>
                  ))}
                </span>
              ) : null}
            </>
          }
          primary={{
            href: `${localePrefix}/contact/`,
            label: text("CTA.ContactButton", "Get in touch"),
          }}
          secondary={{
            href: `${localePrefix}/team/`,
            label: text("CTA.TeamButton", "Meet our team"),
          }}
        />
      </div>
    </div>
  );
}
