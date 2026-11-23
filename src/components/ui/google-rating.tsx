import { ArrowUpRight, Star } from "@phosphor-icons/react/dist/ssr";
import { getTranslations, isValidLocale } from "@/src/lib/i18n";
import { formatRating, pluralCategory, resolveGoogleRating } from "@/src/lib/google-rating";
import { cn } from "@/src/lib/utils";
import ratingData from "@/src/data/google-rating.json";

const FALLBACK = {
  One: "{count} Google review",
  Other: "{count} Google reviews",
  AriaLabel: "Rated {rating} out of 5 on Google ({reviews}). Opens our Google profile in a new tab.",
};

/**
 * Real Google rating (stars, score, review count) linking to the firm's Google profile.
 * Figures come from src/data/google-rating.json, refreshed weekly from the Places API;
 * renders nothing when that value is missing or older than 60 days.
 * No AggregateRating markup on purpose: Google treats reviews of a business shown on
 * its own site as self-serving and ignores or penalises them.
 */
export default async function GoogleRating({
  locale,
  variant = "inline",
  className,
}: {
  locale: string;
  variant?: "inline" | "pill";
  className?: string;
}) {
  const data = resolveGoogleRating(ratingData);
  if (!data) return null;

  const activeLocale = isValidLocale(locale) ? locale : "fr";
  const t = await getTranslations(activeLocale, "services");
  const tr = (key: keyof typeof FALLBACK) => {
    const full = `GoogleReviews.${key}`;
    const value = t(full);
    return typeof value === "string" && value !== full ? value : FALLBACK[key];
  };

  const score = formatRating(data.rating, activeLocale);
  const reviews = tr(pluralCategory(data.count, activeLocale)).replace("{count}", String(data.count));
  const label = tr("AriaLabel").replace("{rating}", score).replace("{reviews}", reviews);
  const fill = `${Math.max(0, Math.min(100, (data.rating / 5) * 100))}%`;

  return (
    <a
      href={data.url}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={label}
      data-google-rating=""
      className={cn(
        "group inline-flex max-w-full items-center gap-2.5 text-sm leading-none text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-4 focus-visible:ring-offset-background",
        variant === "pill"
          ? "rounded-full bg-surface-warm px-4 py-2.5 shadow-sm"
          : "-mx-1 min-h-11 rounded-md px-1 py-2 sm:min-h-0 sm:py-1.5",
        className,
      )}
    >
      <span aria-hidden="true" className="relative inline-flex shrink-0">
        <span className="flex gap-0.5 text-brand-hover/25 dark:text-brand/30">
          {Array.from({ length: 5 }, (_, i) => (
            <Star key={i} size={15} weight="fill" />
          ))}
        </span>
        <span
          className="absolute inset-y-0 left-0 flex gap-0.5 overflow-hidden text-brand-hover dark:text-brand"
          style={{ width: fill }}
        >
          {Array.from({ length: 5 }, (_, i) => (
            <Star key={i} size={15} weight="fill" className="shrink-0" />
          ))}
        </span>
      </span>
      <span aria-hidden="true" className="font-semibold tabular-nums text-foreground">
        {score}
      </span>
      <span aria-hidden="true" className="h-3 w-px bg-border" />
      <span
        aria-hidden="true"
        className="truncate underline decoration-border underline-offset-4 transition-colors group-hover:decoration-current"
      >
        {reviews}
      </span>
      <ArrowUpRight
        aria-hidden="true"
        size={13}
        weight="bold"
        className="shrink-0 transition-transform duration-200 ease-out group-hover:-translate-y-px group-hover:translate-x-px motion-reduce:transition-none"
      />
    </a>
  );
}
