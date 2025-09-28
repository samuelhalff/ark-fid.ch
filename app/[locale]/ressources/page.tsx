import React from "react";
import { type Metadata } from "next";
import { headers } from "next/headers";
import ResourceGrid from "./components/ResourceGrid";
import FAQSection from "./components/FAQSection";
import { notFound } from "next/navigation";
import { generateMetadataForPage } from "@/src/lib/metadata";
import { getTranslations, isValidLocale, type Locale } from "@/src/lib/i18n";

type ArticlesSearchParams = Record<string, string | string[] | undefined>;

interface RessourceFile {
  filename: string;
  title: string;
  description: string;
  date?: string;
  source_url?: string;
}

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
  FilesTitle?: string;
  ArticlesTitle?: string;
  LoadMoreFiles?: string;
  LoadMoreArticles?: string;
  ShowAllFiles?: string;
  ShowAllArticles?: string;
  ReadArticle?: string;
  Download?: string;
  By?: string;
  Published?: string;
  Files: RessourceFile[];
  Articles: RessourceArticle[];
  FAQ?: FAQContent;
  Links?: RessourcesLinks;
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
    const normalizeFiles = (input: unknown): RessourceFile[] => {
      if (!Array.isArray(input)) return [];
      return input.filter((file): file is RessourceFile => {
        if (!file || typeof file !== "object") return false;
        const candidate = file as Partial<RessourceFile>;
        return Boolean(
          candidate.filename && candidate.title && candidate.description
        );
      });
    };
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
      FilesTitle: data.FilesTitle,
      ArticlesTitle: data.ArticlesTitle,
      LoadMoreFiles: data.LoadMoreFiles,
      LoadMoreArticles: data.LoadMoreArticles,
      ShowAllFiles: data.ShowAllFiles,
      ShowAllArticles: data.ShowAllArticles,
      ReadArticle: data.ReadArticle,
      Download: data.Download,
      By: data.By,
      Published: data.Published,
      Files: normalizeFiles(data.Files),
      Articles: normalizeArticles(data.Articles),
      FAQ: normalizeFaq(data.FAQ),
      Links: data.Links,
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

  const ressources = await loadRessources(locale);
  const ressourcesFr =
    locale === "fr" ? ressources : await loadRessources("fr");

  const files = ressources.Files;
  const articlesLocale = ressources.Articles;
  const articlesFr = ressourcesFr.Articles;
  const articlesMap = new Map(
    articlesLocale.map((article) => [article.slug, article])
  );
  const articlesCanonical = [...articlesFr]
    .sort((a, b) => (b.date || "").localeCompare(a.date || ""))
    .map((article) => articlesMap.get(article.slug) ?? article);

  const step = 6;
  const filesLimit = parseLimit(searchParams?.files, files.length, step);
  const articlesLimit = parseLimit(
    searchParams?.articles,
    articlesCanonical.length,
    step
  );
  const visibleFiles = files.slice(0, filesLimit);
  const visibleArticles = articlesCanonical.slice(0, articlesLimit);
  const showMoreFiles = filesLimit < files.length;
  const showMoreArticles = articlesLimit < articlesCanonical.length;
  const nextFiles = Math.min(filesLimit + step, files.length);
  const nextArticles = Math.min(articlesLimit + step, articlesCanonical.length);

  const buildHref = (
    next: { files?: number | "all"; articles?: number | "all" },
    hash?: string
  ) => {
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
    const filesParam = resolveValue("files", next.files);
    const articlesParam = resolveValue("articles", next.articles);
    if (filesParam) params.set("files", String(filesParam));
    if (articlesParam) params.set("articles", String(articlesParam));
    const query = params.toString();
    return `/${locale}/ressources${query ? `?${query}` : ""}${
      hash ? `#${hash}` : ""
    }`;
  };

  const labels = {
    ReadArticle: ressources.ReadArticle || "Read Article",
    Download: ressources.Download || "Download",
    By: ressources.By || "By",
    Published: ressources.Published || "Published on",
  };

  const links = ressources.Links || {};

  return (
    <main className="max-w-[1200px] mx-auto px-4 py-10 mt-10">
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
                name: ressources.IntroTitle || "Resources",
                item: `https://ark-fid.ch/${locale}/ressources/`,
              },
            ],
          }),
        }}
      />
      <div className="max-w-[1200px] mx-auto px-0 md:px-0 mb-6 -mt-4">
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
              <span aria-current="page" className="font-medium text-foreground">
                {ressources.IntroTitle || "Resources"}
              </span>
            </li>
          </ol>
        </nav>
      </div>
      <section className="mb-12">
        <h1 className="text-3xl xs:text-4xl md:text-5xl font-bold mb-4">
          {ressources.IntroTitle || "Resources"}
        </h1>
        <p className="text-lg max-w-[700px]">
          {ressources.IntroText || "Helpful resources and documents"}
        </p>
        <p className="text-sm mt-4 max-w-[720px] text-muted-foreground leading-relaxed">
          {[
            {
              label: links.Accounting || "accounting",
              href: `/${locale}/services/accounting`,
            },
            {
              label: links.Tax || "tax",
              href: `/${locale}/services/taxes`,
            },
            {
              label: links.Payroll || "payroll",
              href: `/${locale}/services/payroll`,
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
      <section id="files" className="mb-16">
        <h2 className="text-2xl font-semibold mb-6">
          {ressources.FilesTitle || "Files"}
        </h2>
        <ResourceGrid
          files={visibleFiles}
          articles={[]}
          locale={locale}
          labels={labels}
        />
        {showMoreFiles && (
          <div className="flex items-center gap-3 justify-center mt-6">
            <a
              className="px-4 py-2 border rounded-md text-sm hover:bg-muted"
              href={buildHref({ files: nextFiles }, "files")}
            >
              {ressources.LoadMoreFiles || "Load more files"}
            </a>
            <a
              className="px-3 py-2 text-xs text-muted-foreground hover:underline"
              href={buildHref({ files: "all" }, "files")}
            >
              {ressources.ShowAllFiles || "Show all"}
            </a>
          </div>
        )}
      </section>
      <section id="articles">
        <h2 className="text-2xl font-semibold mb-6">
          {ressources.ArticlesTitle || "Articles"}
        </h2>
        <ResourceGrid
          files={[]}
          articles={visibleArticles}
          locale={locale}
          labels={labels}
        />
        {showMoreArticles && (
          <div className="flex items-center gap-3 justify-center mt-6">
            <a
              className="px-4 py-2 border rounded-md text-sm hover:bg-muted"
              href={buildHref({ articles: nextArticles }, "articles")}
            >
              {ressources.LoadMoreArticles || "Load more articles"}
            </a>
            <a
              className="px-3 py-2 text-xs text-muted-foreground hover:underline"
              href={buildHref({ articles: "all" }, "articles")}
            >
              {ressources.ShowAllArticles || "Show all"}
            </a>
          </div>
        )}
      </section>
      <FAQSection faq={ressources.FAQ || {}} locale={locale} nonce={nonce} />
    </main>
  );
}

export async function generateMetadata({
  params: { locale },
}: {
  params: { locale: string };
}): Promise<Metadata> {
  const targetLocale = isValidLocale(locale) ? locale : "fr";
  return await generateMetadataForPage(targetLocale, "/ressources");
}
