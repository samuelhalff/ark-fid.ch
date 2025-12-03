import React from "react";
import ResourceCard from "./ResourceCard";

interface ArticleResource {
  slug: string;
  title: string;
  description: string;
  author?: string;
  date?: string;
}

interface ResourceGridProps {
  articles: ArticleResource[];
  locale?: string;
  labels?: {
    ReadArticle?: string;
    By?: string;
    Published?: string;
  };
}

const ResourceGrid: React.FC<ResourceGridProps> = ({
  articles,
  locale,
  labels,
}) => {
  const prefix = locale ? `/${locale}` : "";

  return (
    <div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8 mt-8">
        {articles.map((article, index) => (
          <ResourceCard
            key={article.slug}
            title={article.title}
            description={article.description}
            href={`${prefix}/ressources/articles/${article.slug}`}
            author={article.author}
            date={article.date}
            labels={labels}
            colorIndex={index}
          />
        ))}
      </div>
    </div>
  );
};

export default ResourceGrid;
