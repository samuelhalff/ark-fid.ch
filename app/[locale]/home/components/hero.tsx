"use client";
// Inline a tiny arrow icon to avoid loading lucide-react in shared chunk
import { Button } from "@/src/components/ui/button";
import { Badge } from "@/src/components/ui/badge";
import Image from "next/image";
import Link from "next/link";
import { useTranslation } from "react-i18next";
import "@/src/i18n";
import heroBlurData from "@/src/lib/heroBlurData.json";
import { useParams } from "next/navigation";

interface HeroProps {
  locale?: string;
}

const Hero = ({ locale }: HeroProps) => {
  const params = useParams();
  const currentLocale = (locale || params?.locale || "fr") as string;
  const { t } = useTranslation("home");
  const localePrefix = currentLocale ? `/${currentLocale}` : "/fr";

  const serviceHeroes = [
    "/assets/hero/services/accounting-hero.optimized.webp",
    "/assets/hero/services/corporate-hero.optimized.webp",
    "/assets/hero/services/domiciliation-hero.optimized.webp",
    "/assets/hero/services/incorporation-hero.optimized.webp",
    "/assets/hero/services/odoo-hero.optimized.webp",
    "/assets/hero/services/outsourcing-hero.optimized.webp",
    "/assets/hero/services/payroll-hero.optimized.webp",
    "/assets/hero/services/taxes-hero.optimized.webp",
    "/assets/hero/services/family-office-hero.optimized.webp",
  ];
  const pick = Math.floor(Math.random() * serviceHeroes.length);
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
    <section className="relative min-h-[calc(100vh-4rem)] text-center max-w-[var(--breakpoint-xl)] w-full flex flex-col items-center justify-center border-b border-accent mx-auto px-6 pb-10">
      <div className="max-w-[var(--breakpoint-xl)] w-full flex flex-col lg:flex-row mx-auto items-center justify-between gap-10 px-6 py-12 lg:py-0">
        {/* Left column */}
        <div className="flex-1 max-w-3xl text-center animate-in fade-in duration-800">
          <div className="w-full gap-2 text-center">
            <Badge
              className="rounded-full py-1 border-none !text-center"
              variant={"destructive"}
            >
              {t("Hero.Badge")}
            </Badge>
          </div>
          <h1 className="mt-6 w-full text-3xl xs:text-4xl sm:text-5xl lg:text-[3.1rem] xl:text-[3.3rem] font-bold tracking-tight leading-normal lg:leading-[3.75rem]">
            {t("Hero.Title")}
          </h1>
          <p className="mt-6 w-full xs:text-lg">{t("Hero.Description")}</p>
          <div className="w-full mt-12 flex flex-col sm:flex-row items-center gap-4 justify-center">
            <Link
              href={`${localePrefix}/contact`}
              className="w-full sm:w-auto"
              locale={locale}
            >
              <Button
                size="lg"
                className="w-full sm:w-auto rounded-full text-base transition-transform hover:scale-105 hover:shadow-lg focus-visible:scale-105 focus-visible:shadow-lg"
              >
                {t("Hero.CTA")} <ArrowIcon />
              </Button>
            </Link>
          </div>
        </div>

        {/* Right column (image) */}
        <div className="flex-1 relative lg:max-w-lg xl:max-w-xl w-full bg-accent rounded-xl aspect-square animate-in slide-in-from-right-10 duration-500">
          <Image
            src={homeHeroSrc}
            alt={t("Hero.ImageAlt") || "Ark Fiduciaire fiduciary services"}
            className="object-cover rounded-xl"
            sizes="(min-width:1280px) 560px, (min-width:1024px) 480px, 92vw"
            quality={50}
            priority
            fetchPriority="high"
            loading="eager"
            placeholder="blur"
            blurDataURL={
              blur ||
              "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mO0dOjYfwAIGQMCq9zJ3wAAAABJRU5ErkJggg=="
            }
            fill
          />
        </div>
      </div>

      {/* Partner logo + badge (fixed to bottom, inside section, not overlapping) */}
      <div className="w-full text-center justify-center mt-2 flex flex-col items-center gap-2 lg:bottom-6 lg:right-6 lg:mt-10">
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
    </section>
  );
};
export default Hero;
