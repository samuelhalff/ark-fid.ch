import React from "react";
import { type Metadata } from "next";
import { headers } from "next/headers";
import { Suspense } from "react";
import Link from "next/link";
import nextDynamic from "next/dynamic";
const ResourceGrid = nextDynamic(() => import("./components/ResourceGrid"), {
  suspense: true,
});
import FAQSection from "./components/FAQSection";
import ContactSection from "./articles/components/ContactSection";
import { notFound } from "next/navigation";
import { generateMetadataForPage } from "@/src/lib/metadata";
import { getTranslations, isValidLocale, type Locale } from "@/src/lib/i18n";
import { buildInternalUrl } from "@/src/lib/paths";

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

function parseLimit(
  value: string | string[] | undefined,
  total: number,
  step: number
) {
  if (!value) return step;
  const resolved = Array.isArray(value) ? value[0] : value;
  if (resolved === "all") return total;
  const numeric = Number.parseInt(resolved, 10);
  if (Number.isNaN(numeric) || numeric <= 0) return step;
  return Math.min(numeric, total);
}

// Force dynamic rendering to ensure JSON imports are always fresh
export const dynamic = "force-dynamic";

export default async function RessourcesPage({
  params,
  searchParams,
}: {
  params: { locale: string };
  searchParams?: ArticlesSearchParams;
}) {
  const nonce = headers().get("x-nonce") || undefined;
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

  const step = 12;
  const articlesLimit = parseLimit(
    searchParams?.articles,
    articlesCanonical.length,
    step
  );
  const visibleArticles = articlesCanonical.slice(0, articlesLimit);
  const showMoreArticles = articlesLimit < articlesCanonical.length;
  const nextArticles = Math.min(articlesLimit + step, articlesCanonical.length);

  const buildHref = (next: { articles?: number | "all" }, hash?: string) => {
    const params = new URLSearchParams();
    const current = searchParams ?? {};
    const resolveValue = (
      key: keyof ArticlesSearchParams,
      fallback?: number | "all"
    ) => {
      const candidate = fallback ?? current[key];
      if (!candidate) return undefined;
      const value = Array.isArray(candidate) ? candidate[0] : candidate;
      return value;
    };
    const articlesParam = resolveValue("articles", next.articles);
    if (articlesParam) params.set("articles", String(articlesParam));
    const query = params.toString();
    return `/${locale}/ressources/${query ? `?${query}` : ""}${
      hash ? `#${hash}` : ""
    }`;
  };

  const labels = {
    ReadArticle: ressources.ReadArticle || "Read Article",
    By: ressources.By || "By",
    Published: ressources.Published || "Published on",
  };

  const links = ressources.Links || {};

  return (
    <main className="max-w-[1200px] mx-auto px-4 md:px-6 py-10">
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
                name: "Ressources",
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
              Ressources
            </span>
          </li>
        </ol>
      </nav>
      <section className="mb-16 relative py-8 px-6 md:px-8">
        {/* Decorative gradient background */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-primary/5 dark:from-primary/10 dark:to-primary/10 rounded-3xl -z-10" />

        <h1 className="text-3xl xs:text-4xl md:text-5xl font-bold mb-5 bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text">
          {ressources.IntroTitle || "Resources"}
        </h1>
        <p className="text-lg text-muted-foreground">
          {ressources.IntroText || "Helpful resources and documents"}
        </p>
        <p className="text-sm mt-5 text-muted-foreground/80 leading-relaxed">
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
          ].map((item, index) => (
            <span key={item.href}>
              {index > 0 && <span className="mx-1">·</span>}
              <a href={item.href} className="underline hover:no-underline">
                {item.label}
              </a>
            </span>
          ))}
        </p>
      </section>

      <section id="articles" className="mb-20">
        <div className="flex items-center gap-4 mb-8">
          <h2 className="text-2xl font-semibold">
            {ressources.ArticlesTitle || "Articles"}
          </h2>
          <div className="flex-1 h-px bg-gradient-to-r from-border to-transparent" />
        </div>
        <Suspense
          fallback={
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 mt-8">
              <div className="h-40 rounded-lg bg-muted/40" />
              <div className="h-40 rounded-lg bg-muted/40" />
              <div className="h-40 rounded-lg bg-muted/40" />
            </div>
          }
        >
          <ResourceGrid
            articles={visibleArticles}
            locale={locale}
            labels={labels}
          />
        </Suspense>
        {showMoreArticles && (
          <div className="flex items-center gap-3 justify-center mt-6">
            <Link
              className="px-4 py-2 border rounded-md text-sm hover:bg-muted"
              href={buildHref({ articles: nextArticles }, "articles")}
              scroll={false}
            >
              {ressources.LoadMoreArticles || "Load more articles"}
            </Link>
            <Link
              className="px-3 py-2 text-xs text-muted-foreground hover:underline"
              href={buildHref({ articles: "all" }, "articles")}
              scroll={false}
            >
              {ressources.ShowAllArticles || "Show all"}
            </Link>
          </div>
        )}
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
      />
    </main>
  );
}

export async function generateMetadata({
  params: { locale },
  searchParams,
}: {
  params: { locale: string };
  searchParams?: ArticlesSearchParams;
}): Promise<Metadata> {
  const targetLocale = isValidLocale(locale) ? locale : "fr";
  const baseMetadata = await generateMetadataForPage(targetLocale, "/ressources");
  
  // If there are query parameters, add robots noindex to prevent duplicate content
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
