import { headers } from "next/headers";
import { generateMetadataForPage } from "@/src/lib/metadata";
import type { Metadata } from "next";
import { buildBreadcrumbList } from "@/src/lib/structuredData";
import {
  getTranslations,
  isValidLocale,
  type Locale,
} from "@/src/lib/i18n";

type ArticlesSearchParams = Record<string, string | string[] | undefined>;

type ArticleSummary = {
  slug: string;
  title: string;
  description?: string;
  date?: string;
};

type RessourcesContent = {
  Articles: ArticleSummary[];
  IntroTitle?: string;
  ArticlesTitle?: string;
  IntroShort?: string;
  ArticlesShort?: string;
  LoadMoreArticles?: string;
  ShowAllArticles?: string;
};

async function loadRessources(locale: Locale): Promise<RessourcesContent> {
  try {
    const ressourcesModule: { default: Partial<RessourcesContent> } = await import(
      `@/src/translations/${locale}/ressources.json`
    );
    const data = ressourcesModule.default;
    const {
      Articles = [],
      IntroTitle,
      ArticlesTitle,
      IntroShort,
      ArticlesShort,
      LoadMoreArticles,
      ShowAllArticles,
    } = data;
    const normalizedArticles = Array.isArray(Articles)
      ? Articles.filter((article): article is ArticleSummary =>
          Boolean(article && article.slug && article.title)
        )
      : [];
    return {
      Articles: normalizedArticles,
      IntroTitle,
      ArticlesTitle,
      IntroShort,
      ArticlesShort,
      LoadMoreArticles,
      ShowAllArticles,
    };
  } catch (error) {
    if (locale !== "fr") {
      return loadRessources("fr");
    }
    throw error;
  }
}

function parseLimit(
  value: string | string[] | undefined,
  total: number,
  pageSize: number
) {
  if (!value) return pageSize;
  const resolved = Array.isArray(value) ? value[0] : value;
  if (resolved === "all") return total;
  const numeric = Number.parseInt(resolved, 10);
  if (Number.isNaN(numeric) || numeric <= 0) return pageSize;
  return Math.min(numeric, total);
}

export default async function ArticlesIndex(
  props: {
    params: Promise<{ locale: string }>;
    searchParams?: Promise<ArticlesSearchParams>;
  }
) {
  const searchParams = await props.searchParams;
  const params = await props.params;
  const nonce = (await headers()).get("x-nonce") || undefined;
  const requestedLocale = params.locale;
  const locale: Locale = isValidLocale(requestedLocale) ? requestedLocale : "fr";
  const baseUrl = "https://ark-fid.ch";
  const localePrefix = `/${locale}`;

  const ressources = await loadRessources(locale);
  const frRessources = locale === "fr" ? ressources : await loadRessources("fr");
  const tNav = await getTranslations(locale, "navbar");

  const localArticles = ressources.Articles;
  const frArticles = frRessources.Articles;
  const prioritySlug = "annulation-article-gallie";
  const localizedMap = new Map(
    localArticles.map((article) => [article.slug, article])
  );
  const articlesAll = [...frArticles]
    .sort((a, b) => {
      const aPriority = a.slug === prioritySlug ? 1 : 0;
      const bPriority = b.slug === prioritySlug ? 1 : 0;
      if (aPriority !== bPriority) return bPriority - aPriority;
      return (b.date || "").localeCompare(a.date || "");
    })
    .map((article) => localizedMap.get(article.slug) ?? article);

  const pageSize = 10;
  const limit = parseLimit(searchParams?.limit, articlesAll.length, pageSize);
  const visibleArticles = articlesAll.slice(0, limit);
  const hasMore = limit < articlesAll.length;
  const nextLimit = Math.min(limit + pageSize, articlesAll.length);

  const buildHref = (next: number | "all") => {
    const params = new URLSearchParams();
    params.set("limit", String(next));
    const query = params.toString();
    return `${localePrefix}/ressources/articles${query ? `?${query}` : ""}`;
  };

  const breadcrumb = buildBreadcrumbList([
    {
      name: (tNav("Home") as string) || "Home",
      item: `${baseUrl}${localePrefix}/`,
    },
    {
      name: ressources.IntroTitle || "Resources",
      item: `${baseUrl}${localePrefix}/ressources/`,
    },
    {
      name: ressources.ArticlesTitle || "Articles",
      item: `${baseUrl}${localePrefix}/ressources/articles/`,
    },
  ]);

  return (
    <main className="max-w-[var(--breakpoint-xl)] mx-auto px-6 py-10">
      <script
        type="application/ld+json"
        nonce={nonce}
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumb) }}
      />
      <div className="mb-6">
        <nav aria-label="Breadcrumb">
          <ol className="flex flex-wrap items-center gap-1 text-sm text-muted-foreground">
            <li>
              <a
                href={`${localePrefix}/`}
                className="hover:underline focus:outline-none focus:ring-2 focus:ring-primary rounded-sm"
              >
                {(tNav("Home") as string) || "Home"}
              </a>
            </li>
            <li className="flex items-center gap-1">
              <span className="text-muted-foreground/60">/</span>
              <a
                href={`${localePrefix}/ressources/`}
                className="hover:underline focus:outline-none focus:ring-2 focus:ring-primary rounded-sm"
              >
                {ressources.IntroTitle || "Resources"}
              </a>
            </li>
            <li className="flex items-center gap-1">
              <span className="text-muted-foreground/60">/</span>
              <span aria-current="page" className="font-medium text-foreground">
                {ressources.ArticlesTitle || "Articles"}
              </span>
            </li>
          </ol>
        </nav>
      </div>

      <h1 className="text-3xl font-bold mb-6">
        {ressources.ArticlesTitle || "Articles"}
      </h1>
      <ul className="space-y-4">
        {visibleArticles.map((article) => (
          <li key={article.slug} className="border-b pb-4">
            <h2 className="text-xl font-semibold">
              <a href={`${localePrefix}/ressources/articles/${article.slug}/`}>
                {article.title}
              </a>
            </h2>
            {article.description && (
              <p className="text-muted-foreground">{article.description}</p>
            )}
          </li>
        ))}
      </ul>
      {hasMore && (
        <div className="flex items-center gap-3 justify-center mt-6">
          <a
            className="px-4 py-2 border rounded-md text-sm hover:bg-muted"
            href={buildHref(nextLimit)}
          >
            {ressources.LoadMoreArticles || "Load more articles"}
          </a>
          <a
            className="px-3 py-2 text-xs text-muted-foreground hover:underline"
            href={buildHref("all")}
          >
            {ressources.ShowAllArticles || "Show all"}
          </a>
        </div>
      )}
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

  const {
    locale
  } = params;

  const targetLocale = isValidLocale(locale) ? locale : "fr";
  const baseMetadata = await generateMetadataForPage(
    targetLocale,
    "/ressources/articles"
  );
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
