// Inline a tiny arrow icon to avoid loading lucide-react in shared chunk
import { Button } from "@/src/components/ui/button";
import { Badge } from "@/src/components/ui/badge";
import Image from "next/image";
import Link from "next/link";
import { getTranslations, type Locale } from "@/src/lib/i18n";
import heroBlurData from "@/src/lib/heroBlurData.json";

interface HeroProps {
  locale?: string;
}

const Hero = async ({ locale }: HeroProps) => {
  const currentLocale = (locale as Locale) || ("fr" as Locale);
  const t = await getTranslations(currentLocale, "home");
  const localePrefix = locale ? `/${locale}` : "/fr";

  // Randomly pick a service hero image per request for the home hero visual
  const serviceHeroes = [
    "/assets/hero/services/accounting-hero.webp",
    "/assets/hero/services/corporate-hero.webp",
    "/assets/hero/services/domiciliation-hero.webp",
    "/assets/hero/services/incorporation-hero.webp",
    "/assets/hero/services/odoo-hero.webp",
    "/assets/hero/services/outsourcing-hero.webp",
    "/assets/hero/services/payroll-hero.webp",
    "/assets/hero/services/taxes-hero.webp",
  ];
  const pick = Math.floor(Math.random() * serviceHeroes.length);
  // If service hero images are not present yet, fall back to an abstract bg that exists
  const fallbackHero = "/assets/abstract-background-light.webp";
  const homeHeroSrc = serviceHeroes[pick] || fallbackHero;
  const blur = (heroBlurData as Record<string, string>)[homeHeroSrc];

  const ArrowIcon = () => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      className="h-5 w-5"
    >
      <path d="M7 17a1 1 0 0 0 1.707.707l7.586-7.586V16a1 1 0 1 0 2 0V6a1 1 0 0 0-1-1H9a1 1 0 1 0 0 2h5.879L7.293 15.586A1 1 0 0 0 7 16v1z" />
    </svg>
  );

  return (
    <div className="relative min-h-[calc(100vh-4rem)] w-full flex items-center justify-center overflow-hidden border-b border-accent critical-hero">
      <div className="max-w-[var(--breakpoint-xl)] w-full grid grid-cols-1 lg:grid-cols-2 mx-auto items-center justify-between gap-20 px-6 py-12 lg:py-0 critical-hero__inner">
        <div className="max-w-2xl text-center motion-safe:animate-in motion-safe:fade-in md:duration-700 critical-hero__content">
          <div className="gap-2 flex items-center justify-center critical-hero__badges">
            <Badge
              className="rounded-full py-1 border-none critical-badge critical-badge--destructive"
              variant={"destructive"}
            >
              {t("Hero.Badge")}
            </Badge>
          </div>
          <h1 className="mt-6 max-w-full w-full text-3xl xs:text-4xl sm:text-5xl lg:text-[2.75rem] xl:text-5xl font-bold tracking-tight mx-auto">
            {t("Hero.Title")}
          </h1>
          <p className="mt-6 max-w-full w-full xs:text-lg mx-auto">
            {t("Hero.Description")}
          </p>
          <div className="w-full mt-12 flex flex-col sm:flex-row items-center gap-4 justify-center max-w-md mx-auto critical-hero__cta">
            <Link
              href={`${localePrefix}/contact`}
              className="w-full sm:w-auto"
              locale={locale}
            >
              <Button
                size="lg"
                className="w-full sm:w-auto rounded-full text-base transition-transform hover:scale-105 hover:shadow-lg focus-visible:scale-105 focus-visible:shadow-lg critical-button"
                style={{ cursor: "pointer" }}
              >
                {t("Hero.CTA")} <ArrowIcon />
              </Button>
            </Link>
          </div>
          {/* Removed external Odoo logo & duplicate badge per single-badge policy */}
        </div>
        <div className="relative lg:max-w-lg xl:max-w-xl w-full bg-accent rounded-xl aspect-square motion-safe:lg:animate-in motion-safe:lg:slide-in-from-right-10 lg:duration-500 critical-hero__media">
          <Image
            src={homeHeroSrc}
            alt={t("Hero.ImageAlt") || "Ark Fiduciaire fiduciary services"}
            className="object-cover rounded-xl"
            sizes="(min-width:1280px) 560px, (min-width:1024px) 480px, 92vw"
            quality={72}
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
      <div className="pointer-events-none absolute bottom-6 left-0 right-0 flex flex-col items-center gap-2 critical-hero__partner">
        <Image
          src="/assets/partners/odoo-logo.svg"
          alt="Logo du partenaire technologique Odoo, solution ERP utilisée par Ark Fiduciaire"
          width={120}
          height={40}
          className="opacity-90"
          loading="lazy"
          decoding="async"
        />
        <Badge
          className="rounded-full py-1 border-none critical-badge critical-badge--secondary"
          variant="secondary"
        >
          {t("Hero.OdooPartnerBadge") || t("Hero.OdooBadge")}
        </Badge>
      </div>
    </div>
  );
};

export default Hero;
