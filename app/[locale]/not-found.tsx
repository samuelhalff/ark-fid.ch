import Link from "next/link";
import Image from "next/image";
import { headers } from "next/headers";

// We import ressources per-locale dynamically using a small map because Next.js cannot import using a runtime variable path at build time.
import frJSON from "@/src/translations/fr/ressources.json";
import enJSON from "@/src/translations/en/ressources.json";
import deJSON from "@/src/translations/de/ressources.json";
import esJSON from "@/src/translations/es/ressources.json";
import ptJSON from "@/src/translations/pt/ressources.json";

type Article = {
  slug: string;
  title: string;
  description?: string;
  date?: string;
};
type LocaleRes = { Articles?: Article[] };

const byLocale: Record<string, LocaleRes> = {
  fr: frJSON as unknown as LocaleRes,
  en: enJSON as unknown as LocaleRes,
  de: deJSON as unknown as LocaleRes,
  es: esJSON as unknown as LocaleRes,
  pt: ptJSON as unknown as LocaleRes,
};

function pickInteresting(articles: Article[], limit = 3): Article[] {
  // Heuristic: prefer newer by date if available, else first N
  return [...articles]
    .sort((a, b) => (b.date || "").localeCompare(a.date || ""))
    .slice(0, limit);
}

export default function NotFoundPage() {
  const locale = headers().get("x-locale") || "fr";
  const res = byLocale[locale] || (frJSON as unknown as LocaleRes);
  const suggestions = pickInteresting(res.Articles || [], 3);

  return (
    <main
      id="main-content"
      className="max-w-[var(--breakpoint-xl)] mx-auto px-6 py-16"
    >
      <div className="text-center mb-10">
        <p className="text-8xl font-black tracking-tight text-muted-foreground">
          404
        </p>
        <h1 className="mt-4 text-2xl sm:text-3xl font-semibold">
          Page introuvable
        </h1>
        <p className="mt-2 text-muted-foreground">
          {locale === "fr"
            ? "La page demandée n'existe pas ou a été déplacée. Voici des articles susceptibles de vous intéresser :"
            : locale === "en"
            ? "The page you were looking for doesn't exist. You may find these articles helpful:"
            : locale === "de"
            ? "Die gesuchte Seite existiert nicht. Diese Artikel könnten für Sie interessant sein:"
            : locale === "es"
            ? "La página que buscabas no existe. Estos artículos pueden interesarte:"
            : "A página que você procura não existe. Estes artigos podem ser úteis:"}
        </p>
      </div>

      {suggestions.length > 0 && (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {suggestions.map((a) => (
            <Link
              key={a.slug}
              href={`/${locale}/ressources/articles/${a.slug}`}
              className="group rounded-lg border p-4 hover:shadow-md transition-shadow bg-card"
            >
              <h3 className="font-semibold group-hover:underline">{a.title}</h3>
              <p className="text-sm text-muted-foreground mt-2 line-clamp-3">
                {a.description}
              </p>
              <span className="inline-flex items-center gap-1 text-sm text-blue-600 dark:text-blue-400 mt-3">
                {locale === "fr"
                  ? "Lire l'article"
                  : locale === "de"
                  ? "Artikel lesen"
                  : locale === "es"
                  ? "Leer el artículo"
                  : locale === "pt"
                  ? "Ler o artigo"
                  : "Read article"}
                →
              </span>
            </Link>
          ))}
        </div>
      )}

      <div className="mt-10 text-center">
        <Link
          className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:opacity-90"
          href={`/${locale}`}
        >
          {locale === "fr"
            ? "Retour à l'accueil"
            : locale === "de"
            ? "Zurück zur Startseite"
            : locale === "es"
            ? "Volver al inicio"
            : locale === "pt"
            ? "Voltar ao início"
            : "Back to home"}
        </Link>

        <div className="mt-4">
          <Link
            className="text-sm text-muted-foreground hover:underline"
            href={`/${locale}/ressources/articles`}
          >
            {locale === "fr"
              ? "Voir tous les articles"
              : locale === "de"
              ? "Alle Artikel ansehen"
              : locale === "es"
              ? "Ver todos los artículos"
              : locale === "pt"
              ? "Ver todos os artigos"
              : "Browse all articles"}
          </Link>
        </div>
      </div>
    </main>
  );
}
