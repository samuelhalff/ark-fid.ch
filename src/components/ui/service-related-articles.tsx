import Link from "next/link";
import { getArticles } from "@/src/lib/articles";
import { getTranslations, type Locale } from "@/src/lib/i18n";
import {
  serviceArticles,
  servicePillarArticle,
} from "@/src/lib/serviceArticles";
import { tidyTitle } from "@/src/lib/typography";

/**
 * Related articles at the end of a service page. When the service has a
 * pillar article available in the active locale, it is shown first as a
 * highlighted card. Slugs that do not exist in the locale are skipped.
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
  const pillarSlug = servicePillarArticle[servicePath];
  const pillar = pillarSlug ? bySlug.get(pillarSlug) : undefined;
  const items = slugs
    .filter((slug) => slug !== pillar?.slug)
    .map((slug) => bySlug.get(slug))
    .filter((a): a is NonNullable<typeof a> => Boolean(a));
  if (items.length === 0 && !pillar) return null;

  const t = await getTranslations(activeLocale, "services");
  const title = t("ServiceRelated.Title") as string;
  const pillarLabelRaw = t("ServiceRelated.PillarLabel") as string;
  const pillarLabel =
    pillarLabelRaw && pillarLabelRaw !== "ServiceRelated.PillarLabel"
      ? pillarLabelRaw
      : "";

  return (
    <section className="max-w-3xl space-y-4">
      <h3 className="text-xl xs:text-2xl md:text-2xl font-bold tracking-tight">
        {tidyTitle(title)}
      </h3>
      {pillar ? (
        <div className="rounded-lg bg-primary/5 px-6 py-4 space-y-2">
          {pillarLabel ? (
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {pillarLabel}
            </p>
          ) : null}
          <Link
            href={`/${activeLocale}/ressources/articles/${pillar.slug}/`}
            className="font-semibold text-brand-hover underline-offset-4 hover:underline"
            prefetch={false}
          >
            {pillar.title}
          </Link>
          {pillar.description ? (
            <p className="text-sm leading-6 text-muted-foreground">
              {pillar.description}
            </p>
          ) : null}
        </div>
      ) : null}
      {items.length > 0 ? (
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
      ) : null}
    </section>
  );
};

export default ServiceRelatedArticles;
