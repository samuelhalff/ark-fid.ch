import { notFound } from "next/navigation";
import ReactMarkdown from "react-markdown";
import type { Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import ContactSection from "../components/ContactSection";
import ArticleContextualCTA from "@/src/components/ui/article-contextual-cta";
import { generateMetadataForArticle } from "@/src/lib/metadata";
import { headers } from "next/headers";
import { getTranslations, isValidLocale, type Locale } from "@/src/lib/i18n";
import RelatedArticles from "@/src/components/ressources/RelatedArticles";
import Breadcrumbs from "@/src/components/navigation/Breadcrumbs";
import { estimateReadingTime } from "@/src/lib/readingTime";
import dynamicImport from "next/dynamic";
import Defer from "@/src/components/Defer";
import { normalizeInternalHref } from "@/src/lib/paths";

// Force dynamic rendering to speed up build times
export const dynamic = "force-dynamic";

const ShareButtons = dynamicImport(
  () => import("@/src/components/ui/ShareButtons"),
  { loading: () => null }
);
const ReadingProgress = dynamicImport(
  () => import("@/src/components/ui/reading-progress"),
  { loading: () => null }
);
const BackToTop = dynamicImport(
  () => import("@/src/components/ui/back-to-top"),
  { loading: () => null }
);

type Params = { params: Promise<{ slug: string; locale: string }> };

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

const buildMarkdownComponents = (locale: Locale): Components => ({
  table({ node: _node, className, ...props }) {
    return (
      <div className="my-6 overflow-x-auto">
        <table className={["w-full", className].filter(Boolean).join(" ")} {...props} />
      </div>
    );
  },
  a({ node: _node, href, children, ...props }) {
    const normalized = href ? normalizeInternalHref(href, locale) : href;
    return (
      <a href={normalized} {...props}>
        {children}
      </a>
    );
  },
});

const articleUiLabels: Record<
  Locale,
  {
    relatedServices: string;
    contactUs: string;
    services: Record<string, string>;
  }
> = {
  fr: {
    relatedServices: "Services liés",
    contactUs: "Nous contacter",
    services: {
      "Accounting Services": "Comptabilité",
      "Tax Services": "Fiscalité",
      "Payroll Services": "Paie et RH",
      "Domiciliation Services": "Domiciliation",
      "Company Incorporation": "Constitution d'entreprise",
      "Corporate Services": "Services corporatifs",
      "Outsourcing Services": "Externalisation",
      "Immigration & permits": "Immigration et permis",
      "Odoo Integration": "Intégration Odoo",
      "Our Team": "Notre équipe",
    },
  },
  en: {
    relatedServices: "Related services",
    contactUs: "Contact us",
    services: {},
  },
  de: {
    relatedServices: "Verwandte Dienstleistungen",
    contactUs: "Kontakt aufnehmen",
    services: {
      "Accounting Services": "Buchhaltung",
      "Tax Services": "Steuern",
      "Payroll Services": "Lohn & HR",
      "Domiciliation Services": "Domizilierung",
      "Company Incorporation": "Firmengründung",
      "Corporate Services": "Unternehmensdienstleistungen",
      "Outsourcing Services": "Outsourcing",
      "Immigration & permits": "Immigration und Bewilligungen",
      "Odoo Integration": "Odoo-Integration",
      "Our Team": "Unser Team",
    },
  },
  es: {
    relatedServices: "Servicios relacionados",
    contactUs: "Contactar",
    services: {
      "Accounting Services": "Contabilidad",
      "Tax Services": "Fiscalidad",
      "Payroll Services": "Nómina y RR. HH.",
      "Domiciliation Services": "Domiciliación",
      "Company Incorporation": "Constitución de empresa",
      "Corporate Services": "Servicios corporativos",
      "Outsourcing Services": "Externalización",
      "Immigration & permits": "Inmigración y permisos",
      "Odoo Integration": "Integración Odoo",
      "Our Team": "Nuestro equipo",
    },
  },
  pt: {
    relatedServices: "Serviços relacionados",
    contactUs: "Contactar",
    services: {
      "Accounting Services": "Contabilidade",
      "Tax Services": "Fiscalidade",
      "Payroll Services": "Salários e RH",
      "Domiciliation Services": "Domiciliação",
      "Company Incorporation": "Constituição de empresa",
      "Corporate Services": "Serviços corporativos",
      "Outsourcing Services": "Externalização",
      "Immigration & permits": "Imigração e autorizações",
      "Odoo Integration": "Integração Odoo",
      "Our Team": "A nossa equipa",
    },
  },
};

function normalizeArticleUiLabels(content: string, locale: Locale) {
  const labels = articleUiLabels[locale];
  let normalized = content
    .replace(/^### Related Services$/gim, `### ${labels.relatedServices}`)
    .replace(/^## Related Services$/gim, `## ${labels.relatedServices}`)
    .replace(/\[Contact Us\]\(\/contact\)/g, `[${labels.contactUs}](/contact)`);

  for (const [source, target] of Object.entries(labels.services)) {
    normalized = normalized.replace(
      new RegExp(`\\[${source.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\]`, "g"),
      `[${target}]`,
    );
  }

  return normalized;
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

export default async function ArticlePage(props: Params) {
  const params = await props.params;
  const nonce = (await headers()).get("x-nonce") || undefined;
  const locale: Locale = isValidLocale(params.locale) ? params.locale : "fr";
  // Load the locale-specific translations on the server
  const ressources = await loadRessources(locale);
  const tNav = await getTranslations(locale, "navbar");
  // Use getTranslations for dot-notation access (e.g. "Contact.Title")
  // so nested keys resolve correctly to the active locale.
  const tRessources = await getTranslations(locale, "ressources");

  // Load canonical FR to compare and/or fallback
  const fr = locale === "fr" ? ressources : await loadRessources("fr");

  const localArticle = ressources.Articles.find(
    (article) => article.slug === params.slug
  );
  const frArticle = fr.Articles.find((article) => article.slug === params.slug);

  // If slug doesn't exist at all in this locale, return 404
  if (locale !== "fr" && !localArticle && !frArticle) return notFound();

  const article = localArticle ?? frArticle;
  if (!article) return notFound();

  // If the locale article is just a copy of the FR version (not genuinely translated),
  // return 404 to avoid "Crawled - currently not indexed" and "Soft 404" in GSC
  if (locale !== "fr" && localArticle && frArticle) {
    const sameTitle = (localArticle.title || "") === (frArticle.title || "");
    const sameDesc = (localArticle.description || "") === (frArticle.description || "");
    const sameContent = (localArticle.content || "") === (frArticle.content || "");
    if (sameTitle && sameDesc && sameContent) {
      return notFound();
    }
  }

  const baseUrl = "https://ark-fid.ch";
  const articleUrl = `${baseUrl}/${locale}/ressources/articles/${params.slug}/`;
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
  // Use relative path for local public assets to avoid Next/Image remote domain restrictions
  const imageUrl = article.image ? `/assets/${article.image}` : undefined; // used for JSON-LD only; image hidden in UI
  const fullContent = normalizeArticleUiLabels(article.content ?? "", locale);
  const reading = estimateReadingTime(fullContent);

  // Split content roughly at the midpoint (at a heading boundary) so we can
  // inject a contextual CTA in the middle of the article.
  let articleFirstHalf = fullContent;
  let articleSecondHalf: string | null = null;
  {
    const lines = fullContent.split("\n");
    const targetIdx = Math.floor(lines.length / 2);
    // Walk backwards from the midpoint to find a heading (## or ###)
    let splitIdx = -1;
    for (let i = targetIdx; i >= Math.floor(lines.length * 0.3); i--) {
      if (/^#{2,3}\s/.test(lines[i])) {
        splitIdx = i;
        break;
      }
    }
    // Walk forwards if we didn't find one backwards
    if (splitIdx === -1) {
      for (let i = targetIdx; i < Math.floor(lines.length * 0.7); i++) {
        if (/^#{2,3}\s/.test(lines[i])) {
          splitIdx = i;
          break;
        }
      }
    }
    if (splitIdx > 0) {
      articleFirstHalf = lines.slice(0, splitIdx).join("\n");
      articleSecondHalf = lines.slice(splitIdx).join("\n");
    }
  }

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
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": articleUrl,
    },
    inLanguage: locale,
    publisher: {
      "@type": "Organization",
      name: "Ark Fiduciaire SA",
      logo: {
        "@type": "ImageObject",
        url: `${baseUrl}/assets/arkfid--color.svg`,
        width: 512,
        height: 512,
      },
      url: baseUrl,
      sameAs: [
        "https://www.linkedin.com/company/ark-fiduciaire/",
        "https://maps.google.com/?cid=14946625157719331801",
      ],
    },
    ...(article.updated ? { dateModified: article.updated } : {}),
    ...(reading ? { timeRequired: reading.timeRequiredISO } : {}),
    ...(imageUrl
      ? {
          image: {
            "@type": "ImageObject",
            url: imageUrl,
          },
        }
      : {}),
    about: [
      {
        "@type": "Thing",
        name:
          locale === "fr"
            ? "Fiscalité Suisse"
            : locale === "de"
            ? "Schweizer Steuerwesen"
            : locale === "es"
            ? "Fiscalidad Suiza"
            : locale === "pt"
            ? "Fiscalidade Suíça"
            : "Swiss Taxation",
      },
      {
        "@type": "Thing",
        name:
          locale === "fr"
            ? "Comptabilité"
            : locale === "de"
            ? "Buchhaltung"
            : locale === "es"
            ? "Contabilidad"
            : locale === "pt"
            ? "Contabilidade"
            : "Accounting",
      },
    ],
    articleSection:
      locale === "fr"
        ? "Ressources fiscales"
        : locale === "de"
        ? "Steuerliche Ressourcen"
        : locale === "es"
        ? "Recursos fiscales"
        : locale === "pt"
        ? "Recursos fiscais"
        : "Tax Resources",
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
      {/* Feature image intentionally not displayed to keep layout compact */}
      <p className="text-lg mb-8 text-center">{article.description}</p>

      <div className="text-center text-sm mb-6 space-y-1">
        <p>
          {ressources.By} {article.author}
        </p>
        <p>
          {ressources.Published} {formatDateDeterministic(article.date, locale)}
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
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={buildMarkdownComponents(locale)}
        >
          {articleFirstHalf}
        </ReactMarkdown>

        {/* Mid-article contextual CTA — lead magnet touchpoint */}
        {articleSecondHalf && (
          <ArticleContextualCTA
            locale={locale}
            title={
              (tRessources("ContextualCTA.Title") as string) ||
              "Need help with this topic?"
            }
            description={
              (tRessources("ContextualCTA.Description") as string) ||
              "Our experts are available for personalised guidance. First consultation free, no commitment."
            }
            primaryText={
              (tRessources("ContextualCTA.PrimaryCTA") as string) ||
              "Contact us"
            }
            secondaryText={
              (tRessources("ContextualCTA.SecondaryCTA") as string) ||
              "Instant quote"
            }
          />
        )}

        {articleSecondHalf && (
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={buildMarkdownComponents(locale)}
          >
            {articleSecondHalf}
          </ReactMarkdown>
        )}
      </article>

      <RelatedArticles currentSlug={params.slug} locale={locale} />

      {/* Use tRessources (getTranslations) for dot-notation key resolution
          so the Contact section is always rendered in the active locale.
          Raw object access like ressources["Contact.Title"] returns undefined
          (falling back to English) because the JSON uses nested objects,
          not flat dotted keys. */}
      <ContactSection
        locale={locale}
        title={
          (tRessources("Contact.Title") as string) ||
          "Questions about this article?"
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

// Enumerate slugs from the canonical French source at build-time (FR is canonical across tooling).
export async function generateStaticParams() {
  const ressources = await loadRessources("fr");
  return ressources.Articles.map((article) => ({ slug: article.slug }));
}

export async function generateMetadata(props: Params) {
  const params = await props.params;
  const locale: Locale = isValidLocale(params.locale) ? params.locale : "fr";
  const ressources = await loadRessources(locale);

  const article =
    ressources.Articles.find((article) => article.slug === params.slug) ??
    (locale === "fr"
      ? undefined
      : (await loadRessources("fr")).Articles.find(
          (frArticle) => frArticle.slug === params.slug
        ));
  // If article not found, the page component returns notFound() so no metadata needed
  if (!article) return {};

  // Determine which locales have this article (and it's not a duplicate)
  const { locales: allLocales } = await import("@/src/lib/i18n");
  const validLocales: Locale[] = [];

  // Load French resources once for comparison
  const frRessources = await loadRessources("fr");
  const isDuplicateOfFr = (
    candidate: ResourceArticle,
    candidateLocale: Locale
  ) => {
    if (candidateLocale === "fr") return false;
    const frArticle = frRessources.Articles.find(
      (a) => a.slug === candidate.slug
    );
    if (!frArticle) return false;
    const sameTitle = (candidate.title || "") === (frArticle.title || "");
    const sameDesc =
      (candidate.description || "") === (frArticle.description || "");
    const sameContent =
      (candidate.content || "") === (frArticle.content || "");
    return sameTitle && sameDesc && sameContent;
  };

  for (const loc of allLocales) {
    try {
      const locRessources = await loadRessources(loc);
      const locArticle = locRessources.Articles.find(
        (a) => a.slug === params.slug
      );

      if (!locArticle) {
        // Article doesn't exist in this locale
        continue;
      }

      if (isDuplicateOfFr(locArticle, loc)) {
        // This is a duplicate - skip this locale
        continue;
      }

      // Article exists and is not a duplicate
      validLocales.push(loc);
    } catch (error) {
      // Locale might not have ressources.json - skip it
      continue;
    }
  }

  const reading = article.content ? estimateReadingTime(article.content) : null;
  const meta = await generateMetadataForArticle(
    locale,
    article.slug,
    article.title,
    article.description,
    validLocales
  );
  const robotsConfig: Record<string, unknown> =
    meta && typeof meta.robots === "object" && meta.robots !== null
      ? (meta.robots as Record<string, unknown>)
      : {};
  const shouldIndex = locale === "fr" || !isDuplicateOfFr(article, locale);
  return {
    ...meta,
    robots: {
      ...(robotsConfig as Record<string, unknown>),
      index: shouldIndex,
      follow: shouldIndex,
    },
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
