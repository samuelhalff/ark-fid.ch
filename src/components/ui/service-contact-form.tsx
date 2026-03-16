import Link from "next/link";
import { Button } from "@/src/components/ui/button";
import { getTranslations, type Locale } from "@/src/lib/i18n";
import { tidyTitle } from "@/src/lib/typography";

/**
 * Lightweight inline contact CTA for service pages.
 * Renders a prominent "Request a free quote" section with two action buttons,
 * reducing friction by surfacing the conversion path directly on the page.
 */
const ServiceContactForm = async ({
  locale,
  context,
}: {
  locale: string;
  /** Optional service context shown in the description (e.g. "comptabilité") */
  context?: string;
}) => {
  const activeLocale = (locale as Locale) || ("fr" as Locale);
  const t = await getTranslations(activeLocale, "services");
  const localePrefix = locale ? `/${locale}` : "/fr";

  const title =
    (t("InlineContact.Title") as string) || "Request a free quote";
  const rawDescription =
    (t("InlineContact.Description") as string) ||
    "Tell us about your needs and receive a personalised proposal within 24 hours. No commitment.";
  const description = context
    ? rawDescription.replace("{service}", context)
    : rawDescription;
  const primary =
    (t("InlineContact.PrimaryCTA") as string) || "Request a free quote";
  const secondary =
    (t("InlineContact.SecondaryCTA") as string) || "Book a call";
  const trustLine =
    (t("InlineContact.TrustLine") as string) ||
    "Trusted by 50+ businesses in Geneva and Lausanne";

  return (
    <section className="my-16 rounded-2xl border-2 border-primary/30 bg-gradient-to-br from-primary/5 to-primary/10 px-8 py-10 text-center">
      <div className="mx-auto max-w-2xl space-y-5">
        <h3 className="text-2xl font-bold tracking-tight">
          {tidyTitle(title)}
        </h3>
        <p className="text-base text-muted-foreground leading-relaxed">
          {description}
        </p>
        <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            href={`${localePrefix}/contact/`}
            locale={activeLocale}
            prefetch={false}
          >
            <Button size="lg" className="rounded-full font-semibold">
              {primary}
            </Button>
          </Link>
          <Link
            href={`${localePrefix}/agent/`}
            locale={activeLocale}
            prefetch={false}
          >
            <Button size="lg" variant="outline" className="rounded-full">
              {secondary}
            </Button>
          </Link>
        </div>
        <p className="text-sm text-muted-foreground/70 flex items-center justify-center gap-1.5">
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            className="text-green-500"
          >
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
            <polyline points="22 4 12 14.01 9 11.01" />
          </svg>
          {trustLine}
        </p>
      </div>
    </section>
  );
};

export default ServiceContactForm;
