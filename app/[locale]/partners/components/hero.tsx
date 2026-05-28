import React from "react";
import { Button } from "@/src/components/ui/button";
import ResponsiveImage from "@/src/components/media/ResponsiveImage";
import { getTranslations, type Locale } from "@/src/lib/i18n";
import heroBlurData from "@/src/lib/heroBlurData.json";

interface PartnersHeroProps {
  locale?: string;
}

// Lightweight inline icons to avoid pulling lucide-react into the shared chunk
const IconHandshake = ({
  className = "w-4 h-4",
  ...props
}: React.SVGProps<SVGSVGElement>) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={`ui-icon ${className}`}
    aria-hidden
    {...props}
  >
    <path d="M12 13.5l2.5 2.5a2 2 0 0 0 2.8 0l3.2-3.2a2 2 0 0 0 0-2.8L18.5 8.5" />
    <path d="M12 13.5l-2.5 2.5a2 2 0 0 1-2.8 0L3.5 12.8a2 2 0 0 1 0-2.8L7 6.5" />
    <path d="M7 6.5l5 5 6.5-6.5" />
    <path d="M9.5 14.5l2 2" />
  </svg>
);

const IconUsers = ({
  className = "w-5 h-5",
  ...props
}: React.SVGProps<SVGSVGElement>) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={`ui-icon ${className}`}
    aria-hidden
    {...props}
  >
    <path d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);

const PartnersHero = async ({ locale }: PartnersHeroProps) => {
  const currentLocale = (locale as Locale) || ("fr" as Locale);
  const t = await getTranslations(currentLocale, "partners");
  const localePrefix = locale ? `/${locale}` : "/fr";

  const heroSrc = "/assets/hero/services/corporate-hero.optimized.avif";
  const heroMobileSrc = heroSrc; // If/when mobile variants exist, swap here
  const blur = (heroBlurData as Record<string, string>)[heroSrc];

  return (
    <section className="relative w-full bg-background px-5 py-12 sm:px-8 sm:py-16 lg:py-20">
      <div className="mx-auto grid w-full max-w-[1240px] gap-10 lg:grid-cols-[minmax(0,1.05fr)_minmax(360px,0.8fr)] lg:items-center">
        <div className="min-w-0 max-w-3xl">
          <div className="mb-7 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center rounded-full bg-brand-soft px-3 py-1 text-[0.72rem] font-semibold uppercase tracking-[0.16em] text-brand-hover shadow-sm dark:bg-brand/10 dark:text-brand">
              <IconHandshake className="w-4 h-4 mr-1" />
              {t("Hero.Badge")}
            </span>
          </div>
          <h1 className="max-w-[14ch] text-balance text-5xl font-semibold leading-[0.98] tracking-tight text-foreground sm:text-6xl lg:text-7xl">
            {t("IntroTitle")}
          </h1>
          <p className="mt-7 max-w-[58ch] text-base leading-8 text-muted-foreground sm:text-lg">
            {t("IntroText")}
          </p>
          <div className="mt-10 flex w-full flex-col items-stretch gap-3 sm:w-auto sm:flex-row sm:items-center">
            <a href={`${localePrefix}/contact/`} className="w-full sm:w-auto">
              <Button
                size="lg"
                className="btn-main-cta w-full rounded-full bg-foreground px-6 text-base text-background transition-colors hover:text-white sm:w-auto"
                style={{ cursor: "pointer" }}
              >
                <span>{t("Hero.CTA")}</span>
                <IconHandshake className="h-5 w-5 ml-2" />
              </Button>
            </a>
            <a href={`${localePrefix}/team/`} className="w-full sm:w-auto">
              <Button
                variant="outline"
                size="lg"
                className="btn-secondary-cta w-full rounded-full px-6 text-base sm:w-auto"
                style={{ cursor: "pointer" }}
              >
                <IconUsers className="h-5 w-5 mr-2" />
                <span>{t("Hero.SecondaryCTA")}</span>
              </Button>
            </a>
          </div>
        </div>
        <div className="relative min-h-[320px] w-full overflow-hidden rounded-[28px] bg-muted/30 shadow-sm sm:min-h-[420px] lg:min-h-[520px]">
          <ResponsiveImage
            mobileSrc={heroMobileSrc}
            desktopSrc={heroSrc}
            alt={t("Hero.ImageAlt")}
            className="object-cover"
            sizes="(min-width:1280px) 560px, (min-width:1024px) 480px, 92vw"
            quality={60}
            priority
            fetchPriority="high"
            placeholder="blur"
            blurDataURL={
              blur ||
              "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mO0dOjYfwAIGQMCq9zJ3wAAAABJRU5ErkJggg=="
            }
            fill
          />
        </div>
      </div>
    </section>
  );
};

export default PartnersHero;
