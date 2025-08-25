import React from "react";
import TranslatedText from "@/src/components/ui/translated-text";
import ResourceGrid from "./components/ResourceGrid";
import { notFound } from "next/navigation";

type LocaleParams = { params: { locale: string } };

export default async function RessourcesPage({ params }: LocaleParams) {
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
      <section className="mb-12">
        <h1 className="text-3xl xs:text-4xl md:text-5xl font-bold mb-4">
          <TranslatedText
            ns="ressources"
            translationKey="IntroTitle"
            fallbackText="Resources"
          />
        </h1>
        <p className="text-lg text-muted-foreground max-w-[700px]">
          <TranslatedText
            ns="ressources"
            translationKey="IntroText"
            fallbackText="Helpful resources and documents"
          />
        </p>
      </section>
      <section className="mb-16">
        <h2 className="text-2xl font-semibold mb-6">
          <TranslatedText
            ns="ressources"
            translationKey="FilesTitle"
            fallbackText="Files"
          />
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
          <TranslatedText
            ns="ressources"
            translationKey="ArticlesTitle"
            fallbackText="Articles"
          />
        </h2>
        <ResourceGrid
          files={[]}
          articles={articles}
          locale={locale}
          labels={labels}
        />
      </section>
    </main>
  );
}
