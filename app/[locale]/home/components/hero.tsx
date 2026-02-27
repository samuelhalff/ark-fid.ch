// Server component: no client hooks, translations provided by server
// Inline a tiny arrow icon to avoid loading lucide-react in shared chunk
import { Button } from "@/src/components/ui/button";
import { Badge } from "@/src/components/ui/badge";
import Image from "next/image";
import ResponsiveImage from "@/src/components/media/ResponsiveImage";
import Link from "next/link";
// import { useTranslation } from "react-i18next";
// import "@/src/i18n";
import heroBlurData from "@/src/lib/heroBlurData.json";
import { tidyTitle, splitTitle } from "@/src/lib/typography";
import ServiceScrollHint from "@/src/components/ui/service-scroll-hint";

interface HeroProps {
  locale?: string;
  heroIndex?: number; // stable index provided by server to avoid hydration mismatch
  translations?: Record<string, string>; // server-provided translations to avoid hydration mismatch
}

const Hero = ({ locale, heroIndex, translations }: HeroProps) => {
  const currentLocale = (locale || "fr") as string;
  // const { t } = useTranslation("home");
  const t = (key: string) => translations?.[key] || key; // fallback to key if translation missing
  const localePrefix = currentLocale ? `/${currentLocale}` : "/fr";

  // Use original JPG sources and let next/image transform to AVIF/WebP.
  // This avoids cases where pre-generated WebP is larger than the JPG source.
  // Use JPEG masters for next/image so it can transcode once to AVIF/WebP
  // with minimal quality loss. WebP alias blur placeholders are generated too.
  const serviceHeroes = [
    "/assets/hero/services/home-hero.avif",
    "/assets/hero/services/corporate-hero.avif",
    "/assets/hero/services/domiciliation-hero.avif",
    "/assets/hero/services/odoo-hero.avif",
    "/assets/hero/services/outsourcing-hero.avif",
    "/assets/hero/services/payroll-hero.avif",
    "/assets/hero/services/taxes-hero.avif",
    "/assets/hero/services/family-office-hero.avif",
  ];
  const pick = Number.isFinite(heroIndex!)
    ? Math.max(0, Math.min(serviceHeroes.length - 1, Number(heroIndex)))
    : 0;
  const fallbackHero = "/assets/hero/services/home-hero.avif";
  const homeHeroSrc = serviceHeroes[pick] || fallbackHero;
  // For now, use the same source for mobile/desktop. If mobile-specific
  // variants are provided later, pass them here.
  const homeHeroMobileSrc = homeHeroSrc; // e.g. "/assets/hero/services/home-hero-mobile.avif"
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
      {/** Do not add a manual preload here; next/image with priority handles the correct _next/image URL */}
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
          {(() => {
            const raw = t("Hero.Title") as string;
            const { title, subtitle } = splitTitle(raw);
            return (
              <>
                <h1 className="mt-6 w-full text-3xl xs:text-4xl sm:text-5xl lg:text-[3.1rem] xl:text-[3.3rem] font-bold tracking-tight leading-normal lg:leading-[3.75rem]">
                  {tidyTitle(title)}
                </h1>
                {subtitle ? (
                  <p className="mt-2 text-xl sm:text-2xl font-semibold text-muted-foreground">
                    {tidyTitle(subtitle)}
                  </p>
                ) : null}
              </>
            );
          })()}
          <p className="mt-6 w-full xs:text-lg">{t("Hero.Description")}</p>
          <div className="w-full mt-12 flex flex-col sm:flex-row items-center gap-4 justify-center">
            <Link
              href={`${localePrefix}/contact/`}
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
            <Link
              href={`${localePrefix}/agent/`}
              className="w-full sm:w-auto"
              locale={locale}
              prefetch={false}
            >
              <Button
                size="lg"
                variant="secondary"
                className="w-full sm:w-auto rounded-full text-base transition-transform hover:scale-105 hover:shadow-lg focus-visible:scale-105 focus-visible:shadow-lg"
              >
                {t("Hero.SecondaryCTA")}
              </Button>
            </Link>
          </div>
        </div>

        {/* Right column (image) */}
        <div className="flex-1 relative lg:max-w-lg xl:max-w-xl w-full bg-accent rounded-xl aspect-square animate-in slide-in-from-right-10 duration-500">
          <ResponsiveImage
            mobileSrc={homeHeroMobileSrc}
            desktopSrc={homeHeroSrc}
            alt={t("Hero.ImageAlt") || "Ark Fiduciaire fiduciary services"}
            className="object-cover rounded-xl"
            sizes="(min-width:1280px) 560px, (min-width:1024px) 480px, 92vw"
            quality={60}
            priority
            fetchPriority="high"
            loading="eager"
            placeholder={blur ? "blur" : undefined}
            blurDataURL={blur}
            fill
          />
        </div>
      </div>

      {/* Partner logo + badge (fixed to bottom, inside section, not overlapping) */}
      <div className="w-full text-center justify-center mt-2 flex flex-col items-center gap-2 lg:bottom-6 lg:right-6 lg:mt-10">
        <div className="mt-10 flex flex-col items-center justify-center">
          <a
            href="https://www.odoo.com"
            target="_blank"
            rel="noopener noreferrer"
            className="flex flex-col items-center"
          >
            <Image
              src="/assets/partners/odoo-logo.svg"
              className="mt-0 w-24 h-16"
              alt="Odoo Logo"
              width={96}
              height={64}
              sizes="96px"
              loading="lazy"
              decoding="async"
            />
            <Badge
              className="mt-2 rounded-full py-1 border-none"
              variant="secondary"
            >
              {t("Hero.OdooPartnerBadge") || "Official Odoo Partner"}
            </Badge>
          </a>
        </div>
      </div>
      {/* Reusable floating scroll hint – same component used on service pages.
          targetSelector points to #services, the first content section below the hero. */}
      <ServiceScrollHint
        label={t("Hero.ScrollHint") || "Discover more"}
        targetSelector="#services"
      />
    </section>
  );
};
export default Hero;
