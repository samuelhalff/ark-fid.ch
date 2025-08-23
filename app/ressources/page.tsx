"use client";
import React from "react";
import { useTranslation } from "react-i18next";
import ResourceGrid from "./components/ResourceGrid";

const RessourcesPage = () => {
    const { t } = useTranslation();
    const files = t("Ressources.Files", { returnObjects: true }) as Array<{ filename: string; title: string; description: string }>;
    const articles = t("Ressources.Articles", { returnObjects: true }) as Array<{ slug: string; title: string; description: string }>;

    return (
        <main className="max-w-5xl mx-auto px-4 py-12">
            <section className="mb-12">
                <h1 className="text-3xl xs:text-4xl md:text-5xl font-bold mb-4">
                    {t("Ressources.IntroTitle")}
                </h1>
                <p className="text-lg text-muted-foreground">
                    {t("Ressources.IntroText")}
                </p>
            </section>
            <section className="mb-16">
                <h2 className="text-2xl font-semibold mb-6">
                    {t("Ressources.FilesTitle")}
                </h2>
                <ResourceGrid files={files} articles={[]} />
            </section>
            <section>
                <h2 className="text-2xl font-semibold mb-6">
                    {t("Ressources.ArticlesTitle")}
                </h2>
                <ResourceGrid files={[]} articles={articles} />
            </section>
        </main>
    );
};

export default RessourcesPage;
