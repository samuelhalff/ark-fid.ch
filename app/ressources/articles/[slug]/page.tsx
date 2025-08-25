import { notFound } from "next/navigation";
import ArticleContent from "../components/ArticleContent";

type Params = { params: { slug: string } };
export default function ArticlePage({ params }: Params) {
  return <ArticleContent slug={params.slug} />;
}

// For static generation, we still need to import English version to get slugs
import ressources from "@/src/translations/en/ressources.json";
import { generateMetadataForArticle } from "@/src/lib/metadata";

export async function generateStaticParams() {
  return ressources.Articles.map((article) => ({
    slug: article.slug,
  }));
}

export async function generateMetadata({ params }: Params) {
  const article = ressources.Articles.find((a) => a.slug === params.slug);
  if (!article) return {};

  return generateMetadataForArticle(
    params.slug,
    article.title,
    article.description
  );
}
