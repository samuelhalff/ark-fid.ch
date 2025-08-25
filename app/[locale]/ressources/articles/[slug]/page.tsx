import { notFound } from "next/navigation";
import ReactMarkdown from "react-markdown";
import ContactSection from "../components/ContactSection";
import { generateMetadataForArticle } from "@/src/lib/metadata";

type Params = { params: { slug: string; locale: string } };

export default async function ArticlePage({ params }: Params) {
  // Load the locale-specific translations on the server
  const ressourcesModule = await import(
    `@/src/translations/${params.locale}/ressources.json`
  );
  const ressources = ressourcesModule.default;

  const article = ressources.Articles.find((a: any) => a.slug === params.slug);
  if (!article) return notFound();

  return (
    <main className="max-w-3xl mx-auto px-4 py-12">
      <h1 className="text-3xl sm:text-4xl font-bold mb-4 text-center">
        {article.title}
      </h1>
      <p className="text-muted-foreground text-lg mb-8 text-center">
        {article.description}
      </p>

      <div className="text-center text-sm text-muted-foreground mb-8">
        <p>
          {ressources.By} {article.author}
        </p>
        <p>
          {ressources.Published} {formatDateDeterministic(article.date)}
        </p>
      </div>

      <article className="prose prose-lg dark:prose-invert max-w-none">
        <ReactMarkdown>{article.content}</ReactMarkdown>
      </article>

      {Array.isArray(article.references) && article.references.length > 0 && (
        <section className="mt-10">
          <h2 className="text-xl font-semibold mb-2">
            {ressources.References}
          </h2>
          <ul className="list-disc pl-6">
            {article.references.map(
              (ref: { labelKey: string; url: string }, i: number) => (
                <li key={i}>
                  <a
                    href={ref.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 underline"
                  >
                    {ressources[ref.labelKey] || ref.labelKey}
                  </a>
                </li>
              )
            )}
          </ul>
        </section>
      )}

      <ContactSection locale={params.locale} />
    </main>
  );
}

// Enumerate slugs from the canonical English source at build-time.
export async function generateStaticParams() {
  const module = await import("@/src/translations/en/ressources.json");
  const ressources = module.default;
  return ressources.Articles.map((article: any) => ({ slug: article.slug }));
}

export async function generateMetadata({ params }: Params) {
  const module = await import(
    `@/src/translations/${params.locale}/ressources.json`
  );
  const ressources = module.default;
  const article = ressources.Articles.find((a: any) => a.slug === params.slug);
  if (!article) return {};

  return await generateMetadataForArticle(
    params.locale || "fr",
    article.slug,
    article.title,
    article.description
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
