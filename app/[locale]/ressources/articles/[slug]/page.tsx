import { notFound } from "next/navigation";
import ReactMarkdown from "react-markdown";
import ContactSection from "../components/ContactSection";
import { generateMetadataForArticle } from "@/src/lib/metadata";
import { headers } from "next/headers";
import Image from "next/image";
import {
  getTranslations,
  isValidLocale,
  type Locale,
} from "@/src/lib/i18n";
import RelatedArticles from "@/src/components/ressources/RelatedArticles";
import Breadcrumbs from "@/src/components/navigation/Breadcrumbs";
import { estimateReadingTime } from "@/src/lib/readingTime";
import dynamicImport from "next/dynamic";
import Defer from "@/src/components/Defer";

// Force dynamic rendering to speed up build times
export const dynamic = 'force-dynamic';

const ShareButtons = dynamicImport(() => import("@/src/components/ui/ShareButtons"), {
  ssr: false,
  loading: () => null,
});
const ReadingProgress = dynamicImport(
  () => import("@/src/components/ui/reading-progress"),
  { ssr: false, loading: () => null }
);
const BackToTop = dynamicImport(() => import("@/src/components/ui/back-to-top"), {
  ssr: false,
  loading: () => null,
});

type Params = { params: { slug: string; locale: string } };

type ArticleReference = {
  labelKey: string;
  url: string;
};

type ResourceArticle = {
  slug: string;
  title: string;
  description?: string;
  content?: string;
  date?: string;
  updated?: string;
  author?: string;
  authorUrl?: string;
  image?: string;
  references?: ArticleReference[];
};

interface RessourcesDictionary {
  Articles: ResourceArticle[];
  IntroTitle?: string;
  IntroShort?: string;
  ArticlesTitle?: string;
  ArticlesShort?: string;
  ImageAltPrefix?: string;
  By?: string;
  Published?: string;
  LastUpdated?: string;
  ReadingTime?: string;
  Minutes?: string;
  References?: string;
  [key: string]: unknown;
}

async function loadRessources(locale: Locale): Promise<RessourcesDictionary> {
  const ressourcesModule = await import(
    `@/src/translations/${locale}/ressources.json`
  );
  const data = ressourcesModule.default as Partial<RessourcesDictionary>;
  const { Articles, ...rest } = data;
  return {
    Articles: Array.isArray(Articles) ? Articles : [],
    ...rest,
  };
}

export default async function ArticlePage({ params }: Params) {
  const nonce = headers().get("x-nonce") || undefined;
  const locale: Locale = isValidLocale(params.locale) ? params.locale : "fr";
  // Load the locale-specific translations on the server
  const ressources = await loadRessources(locale);
  const tNav = await getTranslations(locale, "navbar");

  // Load canonical FR to compare and/or fallback
  const fr = locale === "fr" ? ressources : await loadRessources("fr");

  const localArticle = ressources.Articles.find(
    (article) => article.slug === params.slug
  );
  const frArticle = fr.Articles.find((article) => article.slug === params.slug);
  const article = localArticle ?? frArticle;
  if (!article) return notFound();

  const references: ArticleReference[] = Array.isArray(article.references)
    ? article.references
    : [];

  // Determine if we're effectively showing a fallback (either missing local
  // or local content is identical to FR canonical). Used to show notice and noindex.
  let isFallback = false;
  if (locale !== "fr") {
    if (!localArticle) {
      isFallback = true;
    } else if (frArticle) {
      const sameTitle = (localArticle.title || "") === (frArticle.title || "");
      const sameDesc =
        (localArticle.description || "") === (frArticle.description || "");
      const sameContent =
        (localArticle.content || "") === (frArticle.content || "");
      if (sameTitle && sameDesc && sameContent) isFallback = true;
    }
  }

  const baseUrl = "https://ark-fid.ch";
  const articleUrl = `${baseUrl}/${locale}/ressources/articles/${params.slug}`;
  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: (tNav("Home") as string) || "Home",
        item: `${baseUrl}/${locale}/`,
      },
      {
        "@type": "ListItem",
        position: 2,
        name: ressources.IntroTitle || "Resources",
        item: `${baseUrl}/${locale}/ressources/`,
      },
      {
        "@type": "ListItem",
        position: 3,
        name: ressources.ArticlesTitle || "Articles",
        item: `${baseUrl}/${locale}/ressources/articles/`,
      },
      {
        "@type": "ListItem",
        position: 4,
        name: article.title,
        item: articleUrl,
      },
    ],
  } as const;
  const imageUrl = article.image
    ? `${baseUrl}/assets/${article.image}`
    : undefined;
  const reading = estimateReadingTime(article.content || "");

  const articleJsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: article.title,
    description: article.description,
    author: {
      "@type": "Person",
      name: article.author,
      ...(article.authorUrl ? { url: article.authorUrl } : {}),
    },
    datePublished: article.date,
    url: articleUrl,
    mainEntityOfPage: articleUrl,
    inLanguage: locale,
    publisher: {
      "@type": "Organization",
      name: "Ark Fiduciaire",
      logo: {
        "@type": "ImageObject",
        url: `${baseUrl}/assets/arkfid--color.svg`,
      },
      url: baseUrl,
      sameAs: [
        "https://www.linkedin.com/company/ark-fiduciaire/",
        "https://maps.google.com/?cid=11595836239142935457",
      ],
    },
    ...(article.updated ? { dateModified: article.updated } : {}),
    ...(reading ? { timeRequired: reading.timeRequiredISO } : {}),
    ...(imageUrl ? { image: imageUrl } : {}),
  } as const;

  return (
    <main className="max-w-3xl mx-auto px-4 py-12 mt-8">
      <Defer rootMargin="300px" idle={200}>
        <ReadingProgress targetSelector="#article-content" />
      </Defer>
      <Defer rootMargin="300px" idle={200}>
        <BackToTop />
      </Defer>
      <script
        type="application/ld+json"
        nonce={nonce}
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <script
        type="application/ld+json"
        nonce={nonce}
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }}
      />
      {isFallback && (
        <div className="mb-4 rounded-md border bg-muted/40 text-muted-foreground px-3 py-2 text-sm">
          {/* Localized fallback notice */}
          {locale === "fr"
            ? "Contenu affiché en anglais temporairement en attendant la traduction."
            : locale === "de"
            ? "Inhalt vorübergehend auf Englisch angezeigt, bis die Übersetzung verfügbar ist."
            : locale === "es"
            ? "Contenido mostrado temporalmente en inglés mientras se prepara la traducción."
            : locale === "pt"
            ? "Conteúdo exibido temporariamente em inglês enquanto a tradução é preparada."
            : "Content temporarily shown in English until the translation is ready."}
        </div>
      )}
      <Defer rootMargin="200px" idle={150}>
        <Breadcrumbs
          className="mb-6"
          baseLabel={ressources.IntroShort || "Resources"}
          rootLabel={(tNav("Home") as string) || "Home"}
          segments={[
            {
              segment: "ressources",
              label: ressources.IntroShort || "Resources",
            },
            {
              segment: "articles",
              label: ressources.ArticlesShort || "Articles",
            },
            { segment: params.slug, label: article.title },
          ]}
          maxLabelChars={56}
          hideRootWhenDuplicate={false}
        />
      </Defer>
      <h1 className="text-3xl sm:text-4xl font-bold mb-4 text-center">
        {article.title}
      </h1>
      {imageUrl && (
        <div className="mb-6">
          <div className="relative mx-auto aspect-[4/3] w-full max-w-3xl overflow-hidden rounded-md">
            <Image
              src={imageUrl}
              alt={`${ressources.ImageAltPrefix || "Article illustration"}: ${
                article.title
              }`}
              fill
              className="object-cover"
              sizes="(min-width: 1024px) 768px, 100vw"
            />
          </div>
        </div>
      )}
      <p className="text-lg mb-8 text-center">{article.description}</p>

      <div className="text-center text-sm mb-6 space-y-1">
        <p>
          {ressources.By} {article.author}
        </p>
        <p>
          {ressources.Published}{" "}
          {formatDateDeterministic(article.date, locale)}
        </p>
        {article.updated && (
          <p>
            {ressources.LastUpdated}:{" "}
            {formatDateDeterministic(article.updated, locale)}
          </p>
        )}
        {reading && (
          <p>
            {ressources.ReadingTime}: {reading.minutes}
            {ressources.Minutes} ({reading.words} words)
          </p>
        )}
      </div>

      <div className="flex justify-center mb-10 min-h-[40px]">
        <Defer
          rootMargin="200px"
          idle={250}
          placeholder={<div className="h-[36px] w-64 rounded-md bg-muted/40" />}
        >
          <ShareButtons url={articleUrl} title={article.title} />
        </Defer>
      </div>

      <article
        id="article-content"
        className="prose prose-lg dark:prose-invert max-w-none"
      >
        <ReactMarkdown>{article.content ?? ""}</ReactMarkdown>
      </article>

      {references.length > 0 && (
        <section className="mt-10">
          <h2 className="text-xl font-semibold mb-2">
            {ressources.References}
          </h2>
          <ul className="list-disc pl-6">
            {references.map((ref) => {
              const value = ressources[ref.labelKey];
              const resolvedLabel =
                typeof value === "string" ? value : ref.labelKey;
              return (
                <li key={ref.url}>
                  <a
                    href={ref.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 underline"
                  >
                    {resolvedLabel}
                  </a>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <RelatedArticles currentSlug={params.slug} locale={locale} />

      <ContactSection locale={locale} />
    </main>
  );
}

// Enumerate slugs from the canonical French source at build-time (FR is canonical across tooling).
export async function generateStaticParams() {
  const ressources = await loadRessources("fr");
  return ressources.Articles.map((article) => ({ slug: article.slug }));
}

export async function generateMetadata({ params }: Params) {
  const locale: Locale = isValidLocale(params.locale) ? params.locale : "fr";
  const ressources = await loadRessources(locale);
  const fr = locale === "fr" ? ressources : await loadRessources("fr");

  const localArticle = ressources.Articles.find(
    (article) => article.slug === params.slug
  );
  const frArticle = fr.Articles.find((article) => article.slug === params.slug);
  const article = localArticle ?? frArticle;
  if (!article) return {};

  let isFallback = false;
  if (locale !== "fr") {
    if (!localArticle) {
      isFallback = true;
    } else if (frArticle) {
      const sameTitle = (localArticle.title || "") === (frArticle.title || "");
      const sameDesc =
        (localArticle.description || "") === (frArticle.description || "");
      const sameContent =
        (localArticle.content || "") === (frArticle.content || "");
      if (sameTitle && sameDesc && sameContent) isFallback = true;
    }
  }
  const reading = article.content ? estimateReadingTime(article.content) : null;
  const meta = await generateMetadataForArticle(
    locale,
    article.slug,
    article.title,
    article.description
  );
  const robotsConfig: Record<string, unknown> =
    meta && typeof meta.robots === "object" && meta.robots !== null
      ? (meta.robots as Record<string, unknown>)
      : {};
  return {
    ...meta,
    robots: {
      ...(robotsConfig as Record<string, unknown>),
      index: isFallback ? false : true,
      follow: true,
    },
    other: {
      ...(meta.other || {}),
      estimatedReadingTime: reading ? reading.timeRequiredISO : undefined,
      contentFallbackFrom: isFallback ? "fr" : undefined,
    },
  };
}

function formatDateDeterministic(date?: string, locale: string = "en") {
  if (!date) return "";
  try {
    // Normalize locale (fallback chain)
    const loc = locale || "en";
    return new Intl.DateTimeFormat(loc, {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).format(new Date(date));
  } catch (e) {
    try {
      return new Intl.DateTimeFormat("en-GB", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      }).format(new Date(date));
    } catch {
      return new Date(date).toISOString().split("T")[0];
    }
  }
}
