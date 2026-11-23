import GoogleRating from "@/src/components/ui/google-rating";

/**
 * Lower-page reminder of the real Google rating (same source as the hero line).
 * Renders nothing when the stored figures are missing or stale.
 */
const GoogleReviewsBadge = ({ locale }: { locale: string }) => (
  <GoogleRating locale={locale} variant="pill" />
);

export default GoogleReviewsBadge;
