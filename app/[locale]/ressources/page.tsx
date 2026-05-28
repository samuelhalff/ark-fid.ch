import React from "react";
import { type Metadata } from "next";
import { headers } from "next/headers";
import { Suspense } from "react";
import FAQSection from "./components/FAQSection";
import ContactSection from "./articles/components/ContactSection";
import ProgressiveResourceGrid from "./components/ProgressiveResourceGrid";
import { notFound } from "next/navigation";
import { generateMetadataForPage } from "@/src/lib/metadata";
import { getTranslations, isValidLocale, type Locale } from "@/src/lib/i18n";
import { buildInternalUrl } from "@/src/lib/paths";
import PageHero from "@/src/components/site/page-hero";
import SectionHeading from "@/src/components/site/section-heading";
import Reveal from "@/src/components/motion/reveal";

type ArticlesSearchParams = Record<string, string | string[] | undefined>;

interface RessourceArticle {
  slug: string;
  title: string;
  description: string;
  author?: string;
  date?: string;
}

interface FAQEntry {
  q: string;
  a: string;
}

interface FAQContent {
  Title?: string;
  Items?: FAQEntry[];
}

interface RessourcesLinks {
  Accounting?: string;
  Tax?: string;
  Payroll?: string;
}

interface RessourcesData {
  IntroTitle?: string;
  IntroText?: string;
  IntroShort?: string;
  ArticlesShort?: string;
  ArticlesTitle?: string;
  LoadMoreArticles?: string;
  ShowAllArticles?: string;
  ReadArticle?: string;
  By?: string;
  Published?: string;
  Articles: RessourceArticle[];
  FAQ?: FAQContent;
  Links?: RessourcesLinks;
  Contact?: {
    Title?: string;
    Description?: string;
    ButtonText?: string;
  };
}

async function loadRessources(locale: Locale): Promise<RessourcesData> {
  try {
    const ressourcesModule: {
      default: Partial<RessourcesData> & {
        Files?: unknown;
        Articles?: unknown;
      };
    } = await import(`@/src/translations/${locale}/ressources.json`);
    const data = ressourcesModule.default;
    const normalizeArticles = (input: unknown): RessourceArticle[] => {
      if (!Array.isArray(input)) return [];
      return input.filter((article): article is RessourceArticle => {
        if (!article || typeof article !== "object") return false;
        const candidate = article as Partial<RessourceArticle>;
        return Boolean(
          candidate.slug && candidate.title && candidate.description
        );
      });
    };
    const normalizeFaq = (input: unknown): FAQContent | undefined => {
      if (!input || typeof input !== "object") return undefined;
      const faq = input as { Title?: unknown; Items?: unknown };
      const items = Array.isArray(faq.Items)
        ? faq.Items.filter((entry): entry is FAQEntry => {
            if (!entry || typeof entry !== "object") return false;
            const candidate = entry as Partial<FAQEntry>;
            return Boolean(candidate.q && candidate.a);
          })
        : undefined;
      return {
        Title: typeof faq.Title === "string" ? faq.Title : undefined,
        Items: items,
      };
    };

    return {
      IntroTitle: data.IntroTitle,
      IntroText: data.IntroText,
      IntroShort: data.IntroShort,
      ArticlesShort: data.ArticlesShort,
      ArticlesTitle: data.ArticlesTitle,
      LoadMoreArticles: data.LoadMoreArticles,
      ShowAllArticles: data.ShowAllArticles,
      ReadArticle: data.ReadArticle,
      By: data.By,
      Published: data.Published,
      Articles: normalizeArticles(data.Articles),
      FAQ: normalizeFaq(data.FAQ),
      Links: data.Links,
      Contact: data.Contact,
    };
  } catch (error) {
    if (locale !== "fr") {
      return loadRessources("fr");
    }
    notFound();
  }
}

export const dynamic = "force-dynamic";

export default async function RessourcesPage(
  props: {
    params: Promise<{ locale: string }>;
  }
) {
  const params = await props.params;
  const nonce = (await headers()).get("x-nonce") || undefined;
  const requestedLocale = params?.locale;
  const locale: Locale = isValidLocale(requestedLocale)
    ? requestedLocale
    : "fr";
  const tNav = await getTranslations(locale, "navbar");
  const tRessources = await getTranslations(locale, "ressources");

  const ressources = await loadRessources(locale);
  const ressourcesFr =
    locale === "fr" ? ressources : await loadRessources("fr");

  const articlesLocale = ressources.Articles;
  const articlesFr = ressourcesFr.Articles;
  const articlesMap = new Map(
    articlesLocale.map((article) => [article.slug, article])
  );
  const articlesCanonical = [...articlesFr]
    .sort((a, b) => (b.date || "").localeCompare(a.date || ""))
    .map((article) => articlesMap.get(article.slug) ?? article);

  const labels = {
    ReadArticle: ressources.ReadArticle || "Read Article",
    By: ressources.By || "By",
    Published: ressources.Published || "Published on",
  };

  const links = ressources.Links || {};
  const resourcesLabel = (tNav("Ressources") as string) || "Resources";

  return (
    <main className="mx-auto max-w-[1240px] px-5 py-10 sm:px-8">
      <script
        type="application/ld+json"
        nonce={nonce}
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            itemListElement: [
              {
                "@type": "ListItem",
                position: 1,
                name: (tNav("Home") as string) || "Home",
                item: `https://ark-fid.ch/${locale}/`,
              },
              {
                "@type": "ListItem",
                position: 2,
                name: resourcesLabel,
                item: `https://ark-fid.ch/${locale}/ressources/`,
              },
            ],
          }),
        }}
      />
      <nav aria-label="Breadcrumb" className="mt-8 mb-8">
        <ol className="flex flex-wrap items-center gap-1 text-sm text-muted-foreground">
          <li>
            <a
              href={`/${locale}/`}
              className="hover:underline focus:outline-none focus:ring-2 focus:ring-primary rounded-sm"
            >
              {(tNav("Home") as string) || "Home"}
            </a>
          </li>
          <li className="flex items-center gap-1">
            <span className="text-muted-foreground/60">/</span>
            <span aria-current="page" className="font-medium text-foreground">
              {resourcesLabel}
            </span>
          </li>
        </ol>
      </nav>
      <Reveal className="mb-16">
        <PageHero
          eyebrow={ressources.IntroShort || "Ressources"}
          title={ressources.IntroTitle || "Resources"}
          description={ressources.IntroText || "Helpful resources and documents"}
        >
          <div className="flex flex-wrap gap-2">
            {[
              {
                label: links.Accounting || "accounting",
                href: buildInternalUrl("/services/accounting", locale),
              },
              {
                label: links.Tax || "tax",
                href: buildInternalUrl("/services/taxes", locale),
              },
              {
                label: links.Payroll || "payroll",
                href: buildInternalUrl("/services/payroll", locale),
              },
            ].map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="inline-flex items-center rounded-full bg-surface-warm px-3 py-1.5 text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground shadow-sm transition-colors hover:text-brand-hover"
              >
                {item.label}
              </a>
            ))}
          </div>
        </PageHero>
      </Reveal>

      <section id="articles" className="mb-20">
        <Reveal className="mb-8 max-w-3xl">
          <SectionHeading
            eyebrow={ressources.ArticlesShort || "Articles"}
            title={ressources.ArticlesTitle || "Articles"}
            align="left"
            titleClassName="text-3xl sm:text-4xl"
          />
        </Reveal>
        <Suspense
          fallback={
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 mt-8">
              <div className="h-40 rounded-lg bg-muted/40" />
              <div className="h-40 rounded-lg bg-muted/40" />
              <div className="h-40 rounded-lg bg-muted/40" />
            </div>
          }
        >
          <ProgressiveResourceGrid
            articles={articlesCanonical}
            locale={locale}
            labels={labels}
            step={12}
            loadMoreLabel={ressources.LoadMoreArticles || "Load more articles"}
            showAllLabel={ressources.ShowAllArticles || "Show all"}
          />
        </Suspense>
      </section>
      <FAQSection faq={ressources.FAQ || {}} locale={locale} nonce={nonce} />

      <ContactSection
        locale={locale}
        title={
          (tRessources("Contact.Title") as string) ||
          "Questions about our resources?"
        }
        description={
          (tRessources("Contact.Description") as string) ||
          "Our experts are here to help you understand the details and implications for your business. Get personalized advice tailored to your situation."
        }
        buttonText={
          (tRessources("Contact.ButtonText") as string) || "Contact Our Team"
        }
        secondaryButtonText={
          (tRessources("Contact.SecondaryButtonText") as string) ||
          "Get an instant quote"
        }
      />
    </main>
  );
}

export async function generateMetadata(
  props: {
    params: Promise<{ locale: string }>;
    searchParams?: Promise<ArticlesSearchParams>;
  }
): Promise<Metadata> {
  const searchParams = await props.searchParams;
  const params = await props.params;

  const { locale } = params;

  const targetLocale = isValidLocale(locale) ? locale : "fr";
  const baseMetadata = await generateMetadataForPage(targetLocale, "/ressources");

  const hasQueryParams = searchParams && Object.keys(searchParams).length > 0;

  if (hasQueryParams) {
    return {
      ...baseMetadata,
      robots: {
        index: false,
        follow: true,
        googleBot: {
          index: false,
          follow: true,
        },
      },
    };
  }

  return baseMetadata;
}
