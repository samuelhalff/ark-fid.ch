import { notFound } from "next/navigation";
import ressources from "@/src/translations/en/ressources.json";
import ReactMarkdown from "react-markdown";
import TranslatedText from "@/src/components/ui/translated-text";
import ContactSection from "../components/ContactSection";

type Params = { params: { slug: string } };
export default function ArticlePage({ params }: Params) {
  const article = ressources.Articles.find((a) => a.slug === params.slug);
  if (!article) return notFound();
  return (
    <main className="max-w-3xl mx-auto px-4 py-12">
      <h1 className="text-3xl sm:text-4xl font-bold mb-4 text-center">
        {article.title}
      </h1>
      <p className="text-muted-foreground text-lg mb-8 text-center">
        {article.description}
      </p>

      {/* Author and Date */}
      <div className="text-center text-sm text-muted-foreground mb-8">
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
          {new Date(article.date).toLocaleDateString()}
        </p>
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

export async function generateStaticParams() {
  return ressources.Articles.map((article) => ({
    slug: article.slug,
  }));
}

export async function generateMetadata({ params }: Params) {
  const article = ressources.Articles.find((a) => a.slug === params.slug);
  if (!article) return {};

  return {
    title: `${article.title} | Ark Fiduciaire`,
    description: article.description,
    openGraph: {
      title: article.title,
      description: article.description,
      type: "article",
    },
  };
}
