import { notFound } from "next/navigation";
import ReactMarkdown from "react-markdown";
import ContactSection from "../components/ContactSection";
import { generateMetadataForArticle } from "@/src/lib/metadata";
import { headers } from "next/headers";
import Breadcrumbs from "@/src/components/navigation/Breadcrumbs";
import RelatedArticles from "@/src/components/ressources/RelatedArticles";
import { estimateReadingTime } from "@/src/lib/readingTime";
import ShareButtons from "@/src/components/ui/ShareButtons";
import ReadingProgress from "@/src/components/ui/reading-progress";
import BackToTop from "@/src/components/ui/back-to-top";

type Params = { params: { slug: string; locale: string } };

export default async function ArticlePage({ params }: Params) {
  const nonce = headers().get("x-nonce") || undefined;
  // Load the locale-specific translations on the server
  const ressourcesModule = await import(
    `@/src/translations/${params.locale}/ressources.json`
  );
  const ressources = ressourcesModule.default;

  const article = ressources.Articles.find((a: any) => a.slug === params.slug);
  if (!article) return notFound();

  const baseUrl = "https://ark-fid.ch";
  const articleUrl = `${baseUrl}/${params.locale}/ressources/articles/${params.slug}`;
  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Resources",
        item: `${baseUrl}/${params.locale}/ressources`,
      },
      {
        "@type": "ListItem",
        position: 2,
        name: "Articles",
        item: `${baseUrl}/${params.locale}/ressources/articles/`,
      },
      {
        "@type": "ListItem",
        position: 3,
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
    inLanguage: params.locale,
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
      <ReadingProgress targetSelector="#article-content" />
      <BackToTop />
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
      <div className="mb-6">
        <Breadcrumbs
          baseLabel="Resources"
          segments={[
            { segment: "ressources", label: "Resources" },
            { segment: "articles", label: "Articles" },
            { segment: params.slug, label: article.title },
          ]}
        />
      </div>
      <h1 className="text-3xl sm:text-4xl font-bold mb-4 text-center">
        {article.title}
      </h1>
      {imageUrl && (
        <div className="mb-6">
          <img
            src={imageUrl}
            alt={`${ressources.ImageAltPrefix || "Article illustration"}: ${
              article.title
            }`}
            loading="lazy"
            className="rounded-md mx-auto max-h-80 w-full object-cover"
          />
        </div>
      )}
      <p className="text-lg mb-8 text-center">{article.description}</p>

      <div className="text-center text-sm mb-6 space-y-1">
        <p>
          {ressources.By} {article.author}
        </p>
        <p>
          {ressources.Published}{" "}
          {formatDateDeterministic(article.date, params.locale)}
        </p>
        {article.updated && (
          <p>
            {ressources.LastUpdated}:{" "}
            {formatDateDeterministic(article.updated, params.locale)}
          </p>
        )}
        {reading && (
          <p>
            {ressources.ReadingTime}: {reading.minutes}
            {ressources.Minutes} ({reading.words} words)
          </p>
        )}
      </div>

      <div className="flex justify-center mb-10">
        <ShareButtons url={articleUrl} title={article.title} />
      </div>

      <article
        id="article-content"
        className="prose prose-lg dark:prose-invert max-w-none"
      >
        <ReactMarkdown>{article.content}</ReactMarkdown>
      </article>

      {Array.isArray(article.references) && article.references.length > 0 && (
        <section className="mt-10">
          <h2 className="text-xl font-semibold mb-2">
            {ressources.References}
          </h2>
          <ul className="list-disc pl-6">
            {article.references.map(
              (ref: { labelKey: string; url: string }, i: number) => (
                <li key={i}>
                  <a
                    href={ref.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 underline"
                  >
                    {ressources[ref.labelKey] || ref.labelKey}
                  </a>
                </li>
              )
            )}
          </ul>
        </section>
      )}

      <RelatedArticles currentSlug={params.slug} locale={params.locale} />

      <ContactSection locale={params.locale} />
    </main>
  );
}

// Enumerate slugs from the canonical English source at build-time.
export async function generateStaticParams() {
  const module = await import("@/src/translations/en/ressources.json");
  const ressources = module.default;
  return ressources.Articles.map((article: any) => ({ slug: article.slug }));
}

export async function generateMetadata({ params }: Params) {
  const module = await import(
    `@/src/translations/${params.locale}/ressources.json`
  );
  const ressources = module.default;
  const article = ressources.Articles.find((a: any) => a.slug === params.slug);
  if (!article) return {};
  const reading = article.content
    ? require("@/src/lib/readingTime").estimateReadingTime(article.content)
    : null;
  const meta = await generateMetadataForArticle(
    params.locale || "fr",
    article.slug,
    article.title,
    article.description
  );
  return {
    ...meta,
    other: {
      ...(meta.other || {}),
      estimatedReadingTime: reading ? reading.timeRequiredISO : undefined,
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
