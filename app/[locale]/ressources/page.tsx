import React from "react";
import { type Metadata } from "next";
import { headers } from "next/headers";
import ResourceGrid from "./components/ResourceGrid";
import FAQSection from "./components/FAQSection";
import { notFound } from "next/navigation";
import { generateMetadataForPage } from "@/src/lib/metadata";
import { type Locale } from "@/src/lib/i18n";

type LocaleParams = { params: { locale: string } };

export default async function RessourcesPage({ params }: LocaleParams) {
  const nonce = headers().get("x-nonce") || undefined;
  const locale = params?.locale || "fr";

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

  const files = ressources.Files || [];
  const articles = ressources.Articles || [];
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
              { "@type": "ListItem", position: 1, name: "Resources" },
            ],
          }),
        }}
      />
      <div className="max-w-[1200px] mx-auto px-0 md:px-0 mb-6 -mt-4">
        <nav aria-label="Breadcrumb">
          <ol className="flex flex-wrap items-center gap-1 text-sm text-muted-foreground">
            <li>
              <a href={`/${locale}/`} className="hover:underline focus:outline-none focus:ring-2 focus:ring-primary rounded-sm">
                Home
              </a>
            </li>
            <li className="flex items-center gap-1">
              <span className="text-muted-foreground/60">/</span>
              <span aria-current="page" className="font-medium text-foreground">
                Resources
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
          {[{
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
          }].map((item, i) => (
            <span key={item.href}>
              {i > 0 && <span className="mx-1">·</span>}
              <a href={item.href} className="underline hover:no-underline">{item.label}</a>
            </span>
          ))}
        </p>
      </section>
      <section className="mb-16">
        <h2 className="text-2xl font-semibold mb-6">
          {ressources.FilesTitle || "Files"}
        </h2>
        <ResourceGrid
          files={files}
          articles={[]}
          locale={locale}
          labels={labels}
        />
      </section>
      <section>
        <h2 className="text-2xl font-semibold mb-6">
          {ressources.ArticlesTitle || "Articles"}
        </h2>
        <ResourceGrid
          files={[]}
          articles={articles}
          locale={locale}
          labels={labels}
        />
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
