"use client";
import { notFound } from "next/navigation";
import { estimateReadingTime } from "@/src/lib/readingTime";
import { useTranslation } from "react-i18next";
import "@/src/i18n";
import ReactMarkdown from "react-markdown";
import ContactSection from "./ContactSection";

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
          {(t("By") as string) || "By"} {article.author}
        </p>
        <p>
          {(t("Published") as string) || "Published on"} {formatDateDeterministic(article.date)}
        </p>
        {readingStats && (
          <p>
            {((t("ReadingTime") as string) || "Reading time") + ": "}
            {readingStats.minutes}
            {" " + ((t("Minutes") as string) || "min") + " "}
            ({readingStats.words} words)
          </p>
        )}
      </div>

      <article className="prose prose-lg dark:prose-invert max-w-none">
        <ReactMarkdown>{article.content ?? ""}</ReactMarkdown>
      </article>
      {Array.isArray(article.references) && article.references.length > 0 && (
        <section className="mt-10">
          <h2 className="text-xl font-semibold mb-2">{(t("References") as string) || "References"}</h2>
          <ul className="list-disc pl-6">
            {article.references.map((ref) => {
              const key = ref.labelKey;
              const translated = (t(key) as string) || key;
              const isMissing = !translated || translated === key;
              const looksClunky = (s?: string) => !s || s === key || /^[a-z0-9_]+$/.test(s);
              let text: string | undefined = isMissing ? undefined : translated;
              const explicit = (ref as any).label as string | undefined;
              if (!text && explicit && !looksClunky(explicit)) text = explicit;
              if (!text) {
                try {
                  const u = new URL(ref.url);
                  text = u.hostname.replace(/^www\./, "");
                } catch {
                  text = key.replace(/_/g, " ");
                }
              }
              return (
                <li key={ref.url}>
                  <a
                    href={ref.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 underline break-anywhere"
                  >
                    {text}
                  </a>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <ContactSection
        locale={undefined}
        title={(t("Contact.Title") as string) || "Questions about this article?"}
        description={
          (t("Contact.Description") as string) ||
          "Our experts are here to help you understand the details and implications for your business. Get personalized advice tailored to your situation."
        }
        buttonText={(t("Contact.ButtonText") as string) || "Contact Our Team"}
      />
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
