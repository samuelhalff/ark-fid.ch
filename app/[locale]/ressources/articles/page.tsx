import { headers } from "next/headers";
import { generateMetadataForPage } from "@/src/lib/metadata";
import type { Metadata } from "next";
import { buildBreadcrumbList } from "@/src/lib/structuredData";
import { getTranslations, type Locale } from "@/src/lib/i18n";

export default async function ArticlesIndex({
  params,
  searchParams,
}: {
  params: { locale: string };
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const nonce = headers().get("x-nonce") || undefined;
  const locale = params.locale || "fr";
  const baseUrl = "https://ark-fid.ch";
  const localePrefix = locale ? `/${locale}` : "";

  const module = await import(`@/src/translations/${locale}/ressources.json`);
  const ressources = module.default;
  const tNav = await getTranslations(locale as Locale, "navbar");
  const fr = (await import(`@/src/translations/fr/ressources.json`)).default;
  const localArticles: any[] = (ressources.Articles || []).filter(
    (a: any) => a && a.slug && a.title
  );
  const frArticles: any[] = (fr.Articles || []).filter(
    (a: any) => a && a.slug && a.title
  );
  const mrSlug = "annulation-article-gallie";
  const mapLocale = new Map(localArticles.map((a) => [a.slug, a]));
  const articlesAll = [...frArticles]
    .sort((a, b) => {
      const aIsMr = a.slug === mrSlug ? 1 : 0;
      const bIsMr = b.slug === mrSlug ? 1 : 0;
      if (aIsMr !== bIsMr) return bIsMr - aIsMr;
      return (b.date || "").localeCompare(a.date || "");
    })
    .map((a) => mapLocale.get(a.slug) || a);
  const step = 10;
  const parseLimit = (value: string | string[] | undefined, total: number) => {
    if (!value) return step;
    const v = Array.isArray(value) ? value[0] : value;
    if (v === "all") return total;
    const n = parseInt(v, 10);
    if (Number.isNaN(n) || n <= 0) return step;
    return Math.min(n, total);
  };
  const limit = parseLimit(searchParams?.limit, articlesAll.length);
  const articles = articlesAll.slice(0, limit);
  const showMore = limit < articlesAll.length;
  const next = Math.min(limit + step, articlesAll.length);
  const buildHref = (n: number | "all") => {
    const sp = new URLSearchParams();
    sp.set("limit", String(n));
    return `/${locale}/ressources/articles${
      sp.toString() ? `?${sp.toString()}` : ""
    }`;
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
                href={`/${locale}/`}
                className="hover:underline focus:outline-none focus:ring-2 focus:ring-primary rounded-sm"
              >
                {(tNav("Home") as string) || "Home"}
              </a>
            </li>
            <li className="flex items-center gap-1">
              <span className="text-muted-foreground/60">/</span>
              <a
                href={`/${locale}/ressources/`}
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
        {articles.map((a: any) => (
          <li key={a.slug} className="border-b pb-4">
            <h2 className="text-xl font-semibold">
              <a href={`/${locale}/ressources/articles/${a.slug}`}>{a.title}</a>
            </h2>
            {a.description && (
              <p className="text-muted-foreground">{a.description}</p>
            )}
          </li>
        ))}
      </ul>
      {showMore && (
        <div className="flex items-center gap-3 justify-center mt-6">
          <a
            className="px-4 py-2 border rounded-md text-sm hover:bg-muted"
            href={buildHref(next)}
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

export async function generateMetadata({
  params: { locale },
}: {
  params: { locale: string };
}): Promise<Metadata> {
  return await generateMetadataForPage(
    locale as Locale,
    "/ressources/articles"
  );
}
