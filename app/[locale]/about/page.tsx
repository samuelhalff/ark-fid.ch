import Link from "next/link";
import { headers } from "next/headers";
import { Metadata } from "next";
import { generateMetadataForPage } from "@/src/lib/metadata";
import { getTranslations, type Locale } from "@/src/lib/i18n";
import PageHero from "@/src/components/site/page-hero";
import SectionHeading from "@/src/components/site/section-heading";

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
  "flex size-11 items-center justify-center rounded-full border border-[#d66a3d]/20 bg-[#f5dfd5] text-[#b6542b] dark:border-[#d66a3d]/35 dark:bg-[#3b241c] dark:text-[#f2b294]";

const DNAIcons = [
  ({ className = "" }: { className?: string }) => (
    <svg
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <circle cx="12" cy="8" r="5" />
      <path d="M8 13l-2 7 6-3 6 3-2-7" />
    </svg>
  ),
  ({ className = "" }: { className?: string }) => (
    <svg
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  ),
  ({ className = "" }: { className?: string }) => (
    <svg
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M9 18h6" />
      <path d="M10 22h4" />
      <path d="M2 10a10 10 0 1 1 20 0c0 4-3 6-5 7H7c-2-1-5-3-5-7z" />
    </svg>
  ),
  ({ className = "" }: { className?: string }) => (
    <svg
      viewBox="0 0 24 24"
      width="20"
      height="20"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M12 13.5l2.5 2.5a2 2 0 0 0 2.8 0l3.2-3.2a2 2 0 0 0 0-2.8L18.5 8.5" />
      <path d="M12 13.5l-2.5 2.5a2 2 0 0 1-2.8 0L3.5 12.8a2 2 0 0 1 0-2.8L7 6.5" />
      <path d="M7 6.5l5 5 6.5-6.5" />
      <path d="M9.5 14.5l2 2" />
    </svg>
  ),
];

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
          <section className="rounded-[30px] border border-border/70 bg-gradient-to-br from-background via-background to-[#f7ebe5] p-6 shadow-sm dark:to-[#2d1f1a]">
            <SectionHeading
              eyebrow={text("Hero.Badge", "Established 2025")}
              title={text("Foundation.Title", "Our foundation")}
              description={foundation[0] ?? ""}
              titleAs="h2"
            />
            <div className="mt-6 space-y-4 text-base leading-7 text-muted-foreground">
              {foundation.slice(1).map((paragraph, index) => (
                <p key={index}>{paragraph}</p>
              ))}
            </div>
          </section>

          <section className="rounded-[30px] border border-border/70 bg-gradient-to-br from-background via-background to-[#f3ddd4] p-6 shadow-sm dark:to-[#34221c]">
            <SectionHeading
              eyebrow={text("DNA.Title", "Our DNA")}
              title={text("Expertise.Title", "Collective expertise")}
              description={expertise[0] ?? ""}
              titleAs="h2"
            />
            <div className="mt-6 space-y-4 text-base leading-7 text-muted-foreground">
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
                  className="rounded-[28px] border border-border/70 bg-gradient-to-br from-background via-background to-[#f8efe9] p-6 shadow-sm dark:to-[#2c1e19]"
                >
                  <div className={dnaIconClasses}>
                    <Icon />
                  </div>
                  <h3 className="mt-5 text-xl font-semibold tracking-tight">
                    {item.Title}
                  </h3>
                  <p className="mt-3 text-sm leading-7 text-muted-foreground">
                    {item.Desc}
                  </p>
                </article>
              );
            })}
          </div>
        </section>

        <div className="mt-10 grid gap-6 lg:grid-cols-2">
          <section className="rounded-[30px] border border-border/70 bg-gradient-to-br from-background via-background to-[#f7ebe5] p-6 shadow-sm dark:to-[#2d1f1a]">
            <SectionHeading
              eyebrow={text("Expertise.Title", "Collective expertise")}
              title={text("Vision.Title", "Our vision")}
              description={vision[0] ?? ""}
              titleAs="h2"
            />
            <div className="mt-6 space-y-4 text-base leading-7 text-muted-foreground">
              {vision.slice(1).map((paragraph, index) => (
                <p key={index}>{paragraph}</p>
              ))}
            </div>
          </section>

          <section className="rounded-[30px] border border-border/70 bg-gradient-to-br from-background via-background to-[#f3ddd4] p-6 shadow-sm dark:to-[#34221c]">
            <SectionHeading
              eyebrow={text("Vision.Title", "Our vision")}
              title={text("Partnership.Title", "The power of partnership")}
              description={partnership[0] ?? ""}
              titleAs="h2"
            />
            <div className="mt-6 space-y-4 text-base leading-7 text-muted-foreground">
              {partnership.slice(1).map((paragraph, index) => (
                <p key={index}>{paragraph}</p>
              ))}
            </div>
          </section>
        </div>

        <section className="mt-10 rounded-[32px] border border-border/70 bg-gradient-to-r from-[#1f1b19] via-[#26201d] to-[#312621] p-8 text-white shadow-sm dark:from-[#f1e3db] dark:via-[#f3e9e3] dark:to-[#f7f2ef] dark:text-foreground">
          <SectionHeading
            eyebrow={text("Future.Title", "Looking forward")}
            title={text("CTA.Title", "Ready to partner with us?")}
            description={future[0] ?? ""}
            titleAs="h2"
            eyebrowClassName="text-[#e1a488] dark:text-[#b6542b]"
            titleClassName="text-white dark:text-foreground"
            descriptionClassName="text-white/78 dark:text-muted-foreground"
          />
          <div className="mt-6 space-y-4 text-base leading-7 text-white/78 dark:text-muted-foreground">
            {future.slice(1).map((paragraph, index) => (
              <p key={index}>{paragraph}</p>
            ))}
          </div>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              href={`${localePrefix}/contact/`}
              className="inline-flex min-h-11 items-center justify-center rounded-full bg-white px-6 text-sm font-semibold text-[#1f1b19] transition-colors hover:bg-white/90 dark:bg-foreground dark:text-background dark:hover:bg-foreground/90"
            >
              {text("CTA.ContactButton", "Get in touch")}
            </Link>
            <Link
              href={`${localePrefix}/team/`}
              className="inline-flex min-h-11 items-center justify-center rounded-full border border-white/20 px-6 text-sm font-semibold text-white transition-colors hover:bg-white/10 dark:border-foreground/15 dark:text-foreground dark:hover:bg-foreground/5"
            >
              {text("CTA.TeamButton", "Meet our team")}
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
