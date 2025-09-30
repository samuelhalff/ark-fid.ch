// Inline a tiny arrow icon to avoid loading lucide          // Inline a tiny arrow icon to avoid loading lucide-react in shared chunk
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
    "/assets/hero/services/family-office-hero.webp",
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
    <div className="relative min-h-[calc(100vh-4rem)] text-center max-w-[var(--breakpoint-xl)] w-full flex items-center justify-center overflow-hidden border-b border-accent mx-auto px-6">
      <div className="max-w-[var(--breakpoint-xl)] text-center w-full flex flex-col lg:flex-row mx-auto items-center justify-between gap-20 px-6 py-12 lg:py-0">
        <div className="flex-1 max-w-3xl text-center animate-in fade-in duration-800">
          <div className="w-fill gap-2 text-center">
            <Badge
              className="rounded-full py-1 border-none !text-center"
              variant={"destructive"}
            >
              {t("Hero.Badge")}
            </Badge>
          </div>
          <h1 className="mt-6 max-w-full w-full text-3xl xs:text-4xl sm:text-5xl lg:text-[3.1rem] xl:text-[3.3rem] font-bold tracking-tight leading-normal lg:leading-[3.75rem] mx-0">
            {t("Hero.Title")}
          </h1>
          <p className="mt-6 max-w-full w-full xs:text-lg mx-0">
            {t("Hero.Description")}
          </p>
          <div className="w-full mt-12 flex text-center flex-col sm:flex-row items-center gap-4 justify-center mx-0 lg:mx-0 text-center">
            <Link
              href={`${localePrefix}/contact`}
              className="w-full sm:w-auto"
              locale={locale}
            >
              <Button
                size="lg"
                className="w-full sm:w-auto rounded-full text-base transition-transform hover:scale-105 hover:shadow-lg focus-visible:scale-105 focus-visible:shadow-lg"
                style={{ cursor: "pointer" }}
              >
                {t("Hero.CTA")} <ArrowIcon />
              </Button>
            </Link>
          </div>
        </div>
        <div className="flex-1 relative lg:max-w-lg xl:max-w-xl w-full bg-accent rounded-xl aspect-square animate-in slide-in-from-right-10 duration-500">
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
      <div className="pointer-events-none absolute bottom-6 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 w-full min-w-full lg:bottom-4 lg:left-auto lg:right-6 lg:translate-x-0">
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
          className="rounded-full py-1 border-none !text-center"
          variant="secondary"
        >
          {t("Hero.OdooPartnerBadge") || t("Hero.OdooBadge")}
        </Badge>
      </div>
    </div>
  );
};
export default Hero;
