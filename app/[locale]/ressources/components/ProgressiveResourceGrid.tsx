"use client";

import { useState } from "react";
import LoadMoreControls from "@/src/components/ui/load-more-controls";
import ResourceGrid from "./ResourceGrid";
import { cn } from "@/src/lib/utils";

interface ArticleResource {
  slug: string;
  title: string;
  description: string;
  author?: string;
  date?: string;
}

interface ProgressiveResourceGridProps {
  articles: ArticleResource[];
  locale?: string;
  labels?: {
    ReadArticle?: string;
    By?: string;
    Published?: string;
  };
  step?: number;
  loadMoreLabel: string;
  showAllLabel: string;
}

export default function ProgressiveResourceGrid({
  articles,
  locale,
  labels,
  step = 12,
  loadMoreLabel,
  showAllLabel,
}: ProgressiveResourceGridProps) {
  const categories = buildCategories(articles);
  const [activeCategory, setActiveCategory] = useState("all");
  const filteredArticles =
    activeCategory === "all"
      ? articles
      : articles.filter(
          (article) => categories.bySlug[article.slug] === activeCategory
        );
  const total = filteredArticles.length;
  const [visibleCount, setVisibleCount] = useState(Math.min(step, total));

  const setFilter = (category: string) => {
    setActiveCategory(category);
    const nextTotal =
      category === "all"
        ? articles.length
        : articles.filter(
            (article) => categories.bySlug[article.slug] === category
          ).length;
    setVisibleCount(Math.min(step, nextTotal));
  };

  return (
    <>
      <div className="mb-6 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setFilter("all")}
          className={cn(
            "rounded-full px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] shadow-sm transition-colors",
            activeCategory === "all"
              ? "bg-brand text-foreground"
              : "bg-surface-warm text-muted-foreground hover:text-foreground"
          )}
        >
          {locale === "fr" ? "Tous" : "All"}
        </button>
        {categories.items.map((category) => (
          <button
            key={category}
            type="button"
            onClick={() => setFilter(category)}
            className={cn(
              "rounded-full px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] shadow-sm transition-colors",
              activeCategory === category
                ? "bg-brand text-foreground"
                : "bg-surface-warm text-muted-foreground hover:text-foreground"
            )}
          >
            {category}
          </button>
        ))}
      </div>
      <ResourceGrid
        articles={filteredArticles}
        locale={locale}
        visibleCount={visibleCount}
        categoryBySlug={categories.bySlug}
        labels={labels}
      />
      <LoadMoreControls
        hasMore={visibleCount < total}
        loadMoreLabel={loadMoreLabel}
        showAllLabel={showAllLabel}
        onLoadMore={() =>
          setVisibleCount((current) => Math.min(current + step, total))
        }
        onShowAll={() => setVisibleCount(total)}
      />
    </>
  );
}

function buildCategories(articles: ArticleResource[]) {
  const bySlug: Record<string, string> = {};
  const order = [
    "Comptabilité",
    "Fiscalité",
    "Paie",
    "Sociétés",
    "International",
    "Digital",
  ];

  for (const article of articles) {
    const haystack =
      `${article.slug} ${article.title} ${article.description}`.toLowerCase();
    let category = "Sociétés";
    if (/(tva|imp[oô]t|tax|fiscal)/i.test(haystack)) category = "Fiscalité";
    else if (/(paie|salaire|payroll|rh|avs|anobag|permis|immigration)/i.test(haystack))
      category = "Paie";
    else if (/(odoo|digital|ia|microsoft|automatisation)/i.test(haystack))
      category = "Digital";
    else if (/(compt|plan comptable|bilan|audit)/i.test(haystack))
      category = "Comptabilité";
    else if (
      /(succursale|entreprise|s[aà]rl|sa|domiciliation|liquidation|holding)/i.test(
        haystack
      )
    )
      category = "Sociétés";
    else if (/(suisse|international|[ée]tranger|frontali)/i.test(haystack))
      category = "International";
    bySlug[article.slug] = category;
  }

  const items = order.filter((category) =>
    articles.some((article) => bySlug[article.slug] === category)
  );
  return { bySlug, items };
}
