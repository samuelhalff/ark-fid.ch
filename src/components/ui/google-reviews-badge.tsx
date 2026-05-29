import { getTranslations, type Locale } from "@/src/lib/i18n";
import { GoogleLogo, Star } from "@phosphor-icons/react/dist/ssr";

/**
 * Displays a Google Reviews badge with aggregate star rating.
 * Acts as social proof on service and landing pages.
 * Data is sourced from the "services" translation namespace.
 */

function StarIcon({ filled }: { filled: boolean }) {
  return (
    <Star
      size={20}
      weight={filled ? "fill" : "regular"}
      aria-hidden="true"
      className={filled ? "text-amber-400" : "text-muted-foreground/30"}
    />
  );
}

const GoogleReviewsBadge = async ({ locale }: { locale: string }) => {
  const activeLocale = (locale as Locale) || ("fr" as Locale);
  const t = await getTranslations(activeLocale, "services");

  const rating = (t("GoogleReviews.Rating") as string) || "5.0";
  const reviewCount = (t("GoogleReviews.Count") as string) || "30+";
  const label =
    (t("GoogleReviews.Label") as string) || "Google Reviews";
  const cta =
    (t("GoogleReviews.CTA") as string) || "See our reviews";

  const numericRating = parseFloat(rating) || 5;
  const fullStars = Math.floor(numericRating);

  return (
    <div className="inline-flex items-center gap-3 rounded-full bg-background/80 px-4 py-2 shadow-sm">
      <GoogleLogo size={20} weight="bold" aria-hidden="true" className="shrink-0" />
      <div className="flex items-center gap-1.5">
        <span className="font-semibold text-sm">{rating}</span>
        <div className="flex items-center gap-0.5" role="img" aria-label={`${rating} out of 5 stars`}>
          {[1, 2, 3, 4, 5].map((star) => (
            <StarIcon key={star} filled={star <= fullStars} />
          ))}
        </div>
      </div>
      <span className="text-xs text-muted-foreground">
        {reviewCount} {label}
      </span>
      <a
        href="https://maps.google.com/?cid=14946625157719331801"
        target="_blank"
        rel="noopener noreferrer"
        className="text-xs font-medium text-primary hover:underline"
      >
        {cta}
      </a>
    </div>
  );
};

export default GoogleReviewsBadge;
