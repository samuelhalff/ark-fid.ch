import { getTranslations, type Locale } from "@/src/lib/i18n";

/**
 * Displays a Google Reviews badge with aggregate star rating.
 * Acts as social proof on service and landing pages.
 * Data is sourced from the "services" translation namespace.
 */

function StarIcon({ filled }: { filled: boolean }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={filled ? "text-amber-400" : "text-muted-foreground/30"}
    >
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
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
    <div className="inline-flex items-center gap-3 rounded-full border border-border/40 bg-background/80 px-4 py-2 shadow-sm">
      {/* Google "G" logo */}
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        aria-hidden="true"
        className="shrink-0"
      >
        <path
          d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
          fill="#4285F4"
        />
        <path
          d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
          fill="#34A853"
        />
        <path
          d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
          fill="#FBBC05"
        />
        <path
          d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
          fill="#EA4335"
        />
      </svg>
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
