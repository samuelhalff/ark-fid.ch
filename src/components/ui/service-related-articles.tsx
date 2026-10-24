import Link from "next/link";
import { getArticles } from "@/src/lib/articles";
import { getTranslations, type Locale } from "@/src/lib/i18n";
import { serviceArticles } from "@/src/lib/serviceArticles";
import { tidyTitle } from "@/src/lib/typography";

/**
 * Plain list of related articles at the end of a service page.
 * Slugs that do not exist in the active locale are skipped.
 */
const ServiceRelatedArticles = async ({
  locale,
  servicePath,
}: {
  locale: string;
  servicePath: string;
}) => {
  const activeLocale = (locale as Locale) || ("fr" as Locale);
  const slugs = serviceArticles[servicePath] ?? [];
  const bySlug = new Map(getArticles(activeLocale).map((a) => [a.slug, a]));
  const items = slugs
    .map((slug) => bySlug.get(slug))
    .filter((a): a is NonNullable<typeof a> => Boolean(a));
  if (items.length === 0) return null;

  const t = await getTranslations(activeLocale, "services");
  const title = t("ServiceRelated.Title") as string;

  return (
    <section className="max-w-3xl space-y-4">
      <h3 className="text-xl xs:text-2xl md:text-2xl font-bold tracking-tight">
        {tidyTitle(title)}
      </h3>
      <ul className="space-y-3">
        {items.map((article) => (
          <li key={article.slug}>
            <Link
              href={`/${activeLocale}/ressources/articles/${article.slug}/`}
              className="font-medium text-brand-hover underline-offset-4 hover:underline"
              prefetch={false}
            >
              {article.title}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
};

export default ServiceRelatedArticles;
