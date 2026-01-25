import React from "react";
import { Button } from "@/src/components/ui/button";
import { Badge } from "@/src/components/ui/badge";
import Image from "next/image";
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

  // Randomly pick a service hero image per request (same pool as home hero)
  const serviceHeroes = [
    "/assets/hero/services/accounting-hero.optimized.avif",
    "/assets/hero/services/corporate-hero.optimized.avif",
    "/assets/hero/services/domiciliation-hero.optimized.avif",
    "/assets/hero/services/home-hero.avif",
    "/assets/hero/services/odoo-hero.optimized.avif",
    "/assets/hero/services/outsourcing-hero.optimized.avif",
    "/assets/hero/services/payroll-hero.optimized.avif",
    "/assets/hero/services/taxes-hero.optimized.avif",
  ];
  const pick = Math.floor(Math.random() * serviceHeroes.length);
  const heroSrc = serviceHeroes[pick];
  const heroMobileSrc = heroSrc; // If/when mobile variants exist, swap here
  const blur = (heroBlurData as Record<string, string>)[heroSrc];

  return (
    <div className="relative min-h-[calc(100vh-4rem)] max-w-[var(--breakpoint-xl)] w-full flex items-center justify-center overflow-hidden border-b border-accent mx-auto px-6 pb-24">
      <div className="max-w-[var(--breakpoint-xl)] w-full flex flex-col lg:flex-row mx-auto items-center justify-between gap-20 px-6 py-12 lg:py-0">
        <div className="max-w-2xl text-center animate-in fade-in duration-800">
          <div className="gap-2 flex justify-center items-center mb-6">
            <Badge className="rounded-full py-1 border-none bg-blue-100 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400">
              <IconHandshake className="w-4 h-4 mr-1" />
              {t("Hero.Badge")}
            </Badge>
          </div>
          <h1 className="text-3xl xs:text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight mb-6">
            {t("IntroTitle")}
          </h1>
          <p className="text-lg xs:text-xl leading-relaxed mb-8">
            {t("IntroText")}
          </p>
          <div className="w-full flex flex-col sm:flex-row items-center gap-4 justify-center">
            <a href={`${localePrefix}/contact/`} className="w-full sm:w-auto">
              <Button
                size="lg"
                className="w-full sm:w-auto rounded-full text-base transition-transform hover:scale-105 hover:shadow-lg focus-visible:scale-105 focus-visible:shadow-lg"
                style={{ cursor: "pointer" }}
              >
                {t("Hero.CTA")} <IconHandshake className="h-5 w-5 ml-2" />
              </Button>
            </a>
            <a href={`${localePrefix}/team/`} className="w-full sm:w-auto">
              <Button
                variant="outline"
                size="lg"
                className="w-full sm:w-auto rounded-full text-base shadow-none transition-transform hover:scale-105 hover:shadow-lg focus-visible:scale-105 focus-visible:shadow-lg"
                style={{ cursor: "pointer" }}
              >
                <IconUsers className="h-5 w-5 mr-2" /> {t("Hero.SecondaryCTA")}
              </Button>
            </a>
          </div>
        </div>
        <div className="relative lg:max-w-lg xl:max-w-xl w-full bg-accent rounded-xl aspect-square animate-in slide-in-from-right-10 duration-500">
          <ResponsiveImage
            mobileSrc={heroMobileSrc}
            desktopSrc={heroSrc}
            alt={t("Hero.ImageAlt")}
            className="object-cover rounded-xl"
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
    </div>
  );
};

export default PartnersHero;
