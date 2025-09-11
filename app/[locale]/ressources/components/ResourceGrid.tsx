"use client";
import React from "react";
import ResourceCard from "./ResourceCard";

interface FileResource {
  filename: string;
  title: string;
  description: string;
  date?: string;
  source_url?: string;
}

interface ArticleResource {
  slug: string;
  title: string;
  description: string;
  author?: string;
  date?: string;
}

interface ResourceGridProps {
  files: FileResource[];
  articles: ArticleResource[];
  locale?: string;
  labels?: {
    ReadArticle?: string;
    Download?: string;
    By?: string;
    Published?: string;
  };
}

const ResourceGrid: React.FC<ResourceGridProps> = ({
  files,
  articles,
  locale,
  labels,
}) => {
  const prefix = locale ? `/${locale}` : "";
  const [visibleFiles, setVisibleFiles] = React.useState(6);
  const [visibleArticles, setVisibleArticles] = React.useState(6);
  const inc = 6;

  const showFiles = files.slice(0, visibleFiles);
  const showArticles = articles.slice(0, visibleArticles);

  return (
    <div>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 mt-8">
        {showFiles.map((file) => {
          const ext = file.filename.split(".").pop()?.toLowerCase();
          return (
            <ResourceCard
              key={file.filename}
              type="file"
              title={file.title}
              description={file.description}
              href={`/assets/downloads/${file.filename}`}
              extension={ext}
              date={file.date}
              labels={labels}
              source={file.source_url}
            />
          );
        })}
        {showArticles.map((article) => (
          <ResourceCard
            key={article.slug}
            type="article"
            title={article.title}
            description={article.description}
            href={`${prefix}/ressources/articles/${article.slug}`}
            author={article.author}
            date={article.date}
            labels={labels}
            locale={locale}
          />
        ))}
      </div>
      {visibleFiles < files.length && (
        <div className="flex justify-center mt-6">
          <button
            type="button"
            className="px-4 py-2 border rounded-md text-sm hover:bg-muted"
            onClick={() =>
              setVisibleFiles((v) => Math.min(v + inc, files.length))
            }
          >
            Load more files
          </button>
        </div>
      )}
      {visibleArticles < articles.length && (
        <div className="flex justify-center mt-4">
          <button
            type="button"
            className="px-4 py-2 border rounded-md text-sm hover:bg-muted"
            onClick={() =>
              setVisibleArticles((v) => Math.min(v + inc, articles.length))
            }
          >
            Load more articles
          </button>
        </div>
      )}
    </div>
  );
};

export default ResourceGrid;
