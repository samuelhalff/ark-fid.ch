"use client";
import { notFound } from "next/navigation";
import { estimateReadingTime } from "@/src/lib/readingTime";
import { useTranslation } from "react-i18next";
import ReactMarkdown from "react-markdown";
import TranslatedText from "@/src/components/ui/translated-text";
import ContactSection from "./ContactSection";
import Link from "next/link";

interface ArticleContentProps {
  slug: string;
}

export default function ArticleContent({ slug }: ArticleContentProps) {
  const { t } = useTranslation("ressources");
  const articles = t("Articles", { returnObjects: true }) as Array<{
    slug: string;
    title: string;
    description: string;
    author: string;
    date: string;
    content: string;
    references?: Array<{ labelKey: string; url: string }>;
  }>;

  const article = articles.find((a) => a.slug === slug);
  if (!article) return notFound();

  const readingStats = estimateReadingTime(article.content || "");

  return (
    <main className="max-w-3xl mx-auto px-4 py-12">
      <h1 className="text-3xl sm:text-4xl font-bold mb-4 text-center">
        {article.title}
      </h1>
      <p className="text-lg mb-8 text-center">{article.description}</p>

      {/* Author and Date */}
      <div className="text-center text-sm mb-8 space-y-1">
        <p>
          <TranslatedText
            ns="ressources"
            translationKey="By"
            fallbackText="By"
          />{" "}
          {article.author}
        </p>
        <p>
          <TranslatedText
            ns="ressources"
            translationKey="Published"
            fallbackText="Published on"
          />{" "}
          {formatDateDeterministic(article.date)}
        </p>
        {readingStats && (
          <p>
            <TranslatedText
              ns="ressources"
              translationKey="ReadingTime"
              fallbackText="Reading time"
            />
            : {readingStats.minutes}
            <TranslatedText
              ns="ressources"
              translationKey="Minutes"
              fallbackText="min"
            />{" "}
            ({readingStats.words} words)
          </p>
        )}
      </div>

      <article className="prose prose-lg dark:prose-invert max-w-none">
        <ReactMarkdown>{article.content}</ReactMarkdown>
      </article>
      {Array.isArray(article.references) && article.references.length > 0 && (
        <section className="mt-10">
          <h2 className="text-xl font-semibold mb-2">
            <TranslatedText
              ns="ressources"
              translationKey="References"
              fallbackText="References"
            />
          </h2>
          <ul className="list-disc pl-6">
            {(article.references as { labelKey: string; url: string }[]).map(
              (ref, i) => (
                <li key={i}>
                  <a
                    href={ref.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 underline"
                  >
                    <TranslatedText
                      ns="ressources"
                      translationKey={ref.labelKey}
                      fallbackText={ref.labelKey}
                    />
                  </a>
                </li>
              )
            )}
          </ul>
        </section>
      )}

      <ContactSection />
    </main>
  );
}

function formatDateDeterministic(date?: string) {
  if (!date) return "";
  try {
    return new Intl.DateTimeFormat("en-GB", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).format(new Date(date));
  } catch (e) {
    return new Date(date).toISOString().split("T")[0];
  }
}

// Backward compatibility: named export if other modules previously imported it
export const computeReadingTime = estimateReadingTime;
