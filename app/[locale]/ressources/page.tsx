import React from "react";
import { type Metadata } from "next";
import { headers } from "next/headers";
import ResourceGrid from "./components/ResourceGrid";
import FAQSection from "./components/FAQSection";
import { notFound } from "next/navigation";
import { generateMetadataForPage } from "@/src/lib/metadata";
import { getTranslations, type Locale } from "@/src/lib/i18n";

type LocaleParams = {
  params: { locale: string };
  searchParams?: Record<string, string | string[] | undefined>;
};

export default async function RessourcesPage({
  params,
  searchParams,
}: LocaleParams) {
  const nonce = headers().get("x-nonce") || undefined;
  const locale = params?.locale || "fr";
  const tNav = await getTranslations(locale as Locale, "navbar");

  // Load translation JSON directly on the server to avoid importing client libraries
  let ressourcesModule;
  try {
    ressourcesModule = await import(
      `@/src/translations/${locale}/ressources.json`
    );
  } catch (e) {
    try {
      ressourcesModule = await import(`@/src/translations/fr/ressources.json`);
    } catch (err) {
      return notFound();
    }
  }
  const ressources = ressourcesModule.default;
  // Load canonical (French) for parity and fallback
  const ressourcesFr = (await import(`@/src/translations/fr/ressources.json`))
    .default;

  const files = ressources.Files || [];
  const articlesLocale: any[] = ressources.Articles || [];
  const articlesFr: any[] = ressourcesFr.Articles || [];
  const mapLocale = new Map(articlesLocale.map((a) => [a.slug, a]));

  const canonical = [...articlesFr]
    .sort((a, b) => {
      return (b.date || "").localeCompare(a.date || "");
    })
    .map((a) => mapLocale.get(a.slug) || a);

  // Server-only slicing based on query params for SEO-friendly "Show more" without client JS
  const step = 6;
  const parseLimit = (value: string | string[] | undefined, total: number) => {
    if (!value) return step;
    const v = Array.isArray(value) ? value[0] : value;
    if (v === "all") return total;
    const n = parseInt(v, 10);
    if (Number.isNaN(n) || n <= 0) return step;
    return Math.min(n, total);
  };
  const filesLimit = parseLimit(searchParams?.files, files.length);
  const articlesLimit = parseLimit(searchParams?.articles, canonical.length);
  const visibleFiles = files.slice(0, filesLimit);
  const visibleArticles = canonical.slice(0, articlesLimit);
  const showMoreFiles = filesLimit < files.length;
  const showMoreArticles = articlesLimit < canonical.length;
  const nextFiles = Math.min(filesLimit + step, files.length);
  const nextArticles = Math.min(articlesLimit + step, canonical.length);
  const buildHref = (
    next: { files?: number | "all"; articles?: number | "all" },
    hash?: string
  ) => {
    const sp = new URLSearchParams();
    const current = searchParams || {};
    const fv =
      next.files ??
      (Array.isArray(current.files) ? current.files[0] : current.files);
    const av =
      next.articles ??
      (Array.isArray(current.articles)
        ? current.articles[0]
        : current.articles);
    if (fv) sp.set("files", String(fv));
    if (av) sp.set("articles", String(av));
    const qs = sp.toString();
    return `/${locale}/ressources${qs ? `?${qs}` : ""}${
      hash ? `#${hash}` : ""
    }`;
  };
  const labels = {
    ReadArticle: ressources.ReadArticle || "Read Article",
    Download: ressources.Download || "Download",
    By: ressources.By || "By",
    Published: ressources.Published || "Published on",
  };

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
              label: ressources?.Links?.Accounting || "accounting",
              href: `/${locale}/services/accounting`,
            },
            {
              label: ressources?.Links?.Tax || "tax",
              href: `/${locale}/services/taxes`,
            },
            {
              label: ressources?.Links?.Payroll || "payroll",
              href: `/${locale}/services/payroll`,
            },
          ].map((item, i) => (
            <span key={item.href}>
              {i > 0 && <span className="mx-1">·</span>}
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
      <FAQSection faq={ressources.FAQ} locale={locale} nonce={nonce} />
    </main>
  );
}

export async function generateMetadata({
  params: { locale },
}: {
  params: { locale: string };
}): Promise<Metadata> {
  return await generateMetadataForPage(locale as Locale, "/ressources");
}
