"use client";
import React from "react";
import { useTranslation } from "react-i18next";
import TranslatedText from "@/src/components/ui/translated-text";
import ResourceGrid from "./components/ResourceGrid";

const RessourcesPage = () => {
  const { t } = useTranslation("ressources");
  const files = t("Files", { returnObjects: true }) as Array<{
    filename: string;
    title: string;
    description: string;
  }>;
  const articles = t("Articles", { returnObjects: true }) as Array<{
    slug: string;
    title: string;
    description: string;
  }>;

  return (
    <main className="max-w-[1200px] mx-auto px-4 py-10 mt-20">
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
        <ResourceGrid files={files} articles={[]} />
      </section>
      <section>
        <h2 className="text-2xl font-semibold mb-6">
          <TranslatedText
            ns="ressources"
            translationKey="ArticlesTitle"
            fallbackText="Articles"
          />
        </h2>
        <ResourceGrid files={[]} articles={articles} />
      </section>
    </main>
  );
};

export default RessourcesPage;
