import Link from "next/link";
import { Button } from "@/src/components/ui/button";
import { type Locale } from "@/src/lib/i18n";

/**
 * Contextual call-to-action banner injected within blog articles.
 * Encourages readers to take action (contact, download, quote)
 * based on the article topic — acting as a lead magnet touchpoint.
 */
const ArticleContextualCTA = ({
  locale,
  title,
  description,
  primaryText,
  primaryHref,
  secondaryText,
  secondaryHref,
}: {
  locale: string;
  title: string;
  description: string;
  primaryText: string;
  primaryHref?: string;
  secondaryText?: string;
  secondaryHref?: string;
}) => {
  const activeLocale = (locale as Locale) || ("fr" as Locale);
  const localePrefix = locale ? `/${locale}` : "/fr";

  const resolvedPrimaryHref = primaryHref || `${localePrefix}/contact/`;
  const resolvedSecondaryHref = secondaryHref || `${localePrefix}/agent/`;

  return (
    <aside
      className="my-10 rounded-xl border border-primary/20 bg-primary/5 px-6 py-8 not-prose"
      role="complementary"
      aria-label={title}
    >
      <div className="mx-auto max-w-xl text-center space-y-3">
        <p className="text-lg font-semibold text-foreground">{title}</p>
        <p className="text-sm text-muted-foreground leading-relaxed">
          {description}
        </p>
        <div className="flex flex-col items-center justify-center gap-2 pt-1 sm:flex-row">
          <Link
            href={resolvedPrimaryHref}
            locale={activeLocale}
            prefetch={false}
          >
            <Button size="default" className="rounded-full text-sm">
              {primaryText}
            </Button>
          </Link>
          {secondaryText && (
            <Link
              href={resolvedSecondaryHref}
              locale={activeLocale}
              prefetch={false}
            >
              <Button
                size="default"
                variant="ghost"
                className="rounded-full text-sm"
              >
                {secondaryText}
              </Button>
            </Link>
          )}
        </div>
      </div>
    </aside>
  );
};

export default ArticleContextualCTA;
