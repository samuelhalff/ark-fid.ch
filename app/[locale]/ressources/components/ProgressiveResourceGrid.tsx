"use client";

import { useState } from "react";
import LoadMoreControls from "@/src/components/ui/load-more-controls";
import ResourceGrid from "./ResourceGrid";

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
  const total = articles.length;
  const [visibleCount, setVisibleCount] = useState(Math.min(step, total));

  return (
    <>
      <ResourceGrid
        articles={articles}
        locale={locale}
        visibleCount={visibleCount}
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
