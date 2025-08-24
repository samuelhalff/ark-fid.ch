import React from "react";
import ResourceCard from "./ResourceCard";

interface FileResource {
  filename: string;
  title: string;
  description: string;
}

interface ArticleResource {
  slug: string;
  title: string;
  description: string;
}

interface ResourceGridProps {
  files: FileResource[];
  articles: ArticleResource[];
}

const ResourceGrid: React.FC<ResourceGridProps> = ({ files, articles }) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 mt-8">
      {files.map((file) => {
        const ext = file.filename.split(".").pop()?.toLowerCase();
        return (
          <ResourceCard
            key={file.filename}
            type="file"
            title={file.title}
            description={file.description}
            href={`/assets/downloads/${file.filename}`}
            extension={ext}
          />
        );
      })}
      {articles.map((article) => (
        <ResourceCard
          key={article.slug}
          type="article"
          title={article.title}
          description={article.description}
          href={`/ressources/${article.slug}`}
        />
      ))}
    </div>
  );
};

export default ResourceGrid;
