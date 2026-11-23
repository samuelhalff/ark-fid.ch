/** Real Google figures, refreshed weekly by .github/workflows/google-rating-weekly.yml. */
export interface GoogleRating {
  rating: number;
  count: number;
  fetchedAt: string;
  url: string;
}

export const GOOGLE_RATING_MAX_AGE_DAYS = 60;
export const GOOGLE_PROFILE_URL = "https://maps.google.com/?cid=14946625157719331801";

/**
 * Returns the stored rating, or null when it is missing, malformed or older than
 * 60 days: a figure we can no longer vouch for is not shown at all.
 */
export function resolveGoogleRating(
  raw: unknown,
  now: number = Date.now(),
): GoogleRating | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const rating = Number(r.rating);
  const count = Number(r.count);
  const fetched = Date.parse(String(r.fetchedAt ?? ""));
  if (!Number.isFinite(rating) || rating < 1 || rating > 5) return null;
  if (!Number.isInteger(count) || count < 1) return null;
  if (!Number.isFinite(fetched) || fetched > now + 86_400_000) return null;
  if (now - fetched > GOOGLE_RATING_MAX_AGE_DAYS * 86_400_000) return null;
  const url = typeof r.url === "string" && r.url.startsWith("https://") ? r.url : GOOGLE_PROFILE_URL;
  return { rating, count, fetchedAt: String(r.fetchedAt), url };
}

const NUMBER_LOCALES: Record<string, string> = {
  fr: "fr-CH",
  de: "de-CH",
  en: "en-CH",
  es: "es-ES",
  pt: "pt-PT",
};

export function formatRating(rating: number, locale: string): string {
  return new Intl.NumberFormat(NUMBER_LOCALES[locale] ?? "fr-CH", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(rating);
}

export function pluralCategory(count: number, locale: string): "One" | "Other" {
  return new Intl.PluralRules(NUMBER_LOCALES[locale] ?? "fr-CH").select(count) === "one" ? "One" : "Other";
}
