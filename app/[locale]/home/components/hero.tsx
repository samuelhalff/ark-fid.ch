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
import SectionHeading from "@/src/components/site/section-heading";
import Reveal from "@/src/components/motion/reveal";
import ParallaxReveal from "@/src/components/motion/parallax-reveal";

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
    <section className="relative mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-[var(--breakpoint-xl)] flex-col items-center justify-center px-6 pb-12 pt-6">
      {/** Do not add a manual preload here; next/image with priority handles the correct _next/image URL */}
      <div className="relative w-full overflow-hidden rounded-[36px] border border-border/70 bg-gradient-to-br from-muted/70 via-background to-muted/30 px-6 py-10 shadow-sm sm:px-8 sm:py-12 lg:px-12 lg:py-14">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(209,122,79,0.14),transparent_32%),radial-gradient(circle_at_bottom_left,rgba(209,122,79,0.08),transparent_28%)]"
        />
        <div className="relative mx-auto flex w-full max-w-[var(--breakpoint-xl)] flex-col items-center justify-between gap-10 lg:flex-row lg:items-stretch lg:gap-12">
          {/* Left column */}
          <Reveal className="flex flex-1 flex-col justify-center" from="bottom">
            <div className="w-full">
              <div className="w-full text-left">
                <Badge
                  className="rounded-full border border-[#D17A4F]/20 bg-[#FAEEE5] px-3 py-1 text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-[#B86340] dark:border-[#D17A4F]/20 dark:bg-[#D17A4F]/10 dark:text-[#F3C0A6]"
                  variant={"outline"}
                >
                  {t("Hero.Badge")}
                </Badge>
              </div>
              {(() => {
                const raw = t("Hero.Title") as string;
                const { title, subtitle } = splitTitle(raw);

                return (
                  <SectionHeading
                    eyebrow="Genève · Plainpalais"
                    title={tidyTitle(title)}
                    description={t("Hero.Description")}
                    titleAs="h1"
                    align="left"
                    className="mt-6 max-w-3xl"
                    titleClassName="text-4xl sm:text-5xl xl:text-[4.4rem] xl:leading-[0.98]"
                    descriptionClassName="max-w-2xl text-base sm:text-lg"
                  >
                    {subtitle ? (
                      <p className="mt-1 text-lg font-semibold text-muted-foreground sm:text-xl">
                        {tidyTitle(subtitle)}
                      </p>
                    ) : null}
                  </SectionHeading>
                );
              })()}
              <div className="mt-10 flex w-full flex-col items-stretch gap-4 sm:flex-row sm:items-center sm:justify-start">
                <Link
                  href={`${localePrefix}/contact/`}
                  className="w-full sm:w-auto"
                  locale={locale}
                >
                  <Button
                    size="lg"
                    className="w-full rounded-full px-6 text-base transition-transform hover:scale-[1.01] hover:shadow-lg focus-visible:scale-[1.01] focus-visible:shadow-lg sm:w-auto"
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
                    className="w-full rounded-full border border-border/70 bg-background/90 px-6 text-base transition-transform hover:scale-[1.01] hover:shadow-lg focus-visible:scale-[1.01] focus-visible:shadow-lg sm:w-auto"
                  >
                    {t("Hero.SecondaryCTA")}
                  </Button>
                </Link>
              </div>
            </div>
          </Reveal>

          {/* Right column (image) */}
          <ParallaxReveal className="relative flex w-full flex-1 overflow-hidden rounded-[28px] border border-border/60 bg-accent/40 shadow-lg lg:max-w-xl xl:max-w-[34rem]">
            <div className="absolute inset-0 z-[1] bg-gradient-to-t from-black/18 via-transparent to-transparent" />
            <ResponsiveImage
              mobileSrc={homeHeroMobileSrc}
              desktopSrc={homeHeroSrc}
              alt={t("Hero.ImageAlt") || "Ark Fiduciaire fiduciary services"}
              className="rounded-[28px] object-cover"
              sizes="(min-width:1280px) 560px, (min-width:1024px) 480px, 92vw"
              quality={60}
              priority
              fetchPriority="high"
              loading="eager"
              placeholder={blur ? "blur" : undefined}
              blurDataURL={blur}
              fill
            />
            <div className="pointer-events-none absolute inset-x-4 bottom-4 z-[2] rounded-2xl border border-white/20 bg-white/92 px-4 py-3 shadow-md backdrop-blur dark:border-white/10 dark:bg-black/70">
              <p className="text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-[#B86340]">
                {t("Hero.OdooBadge") || "Solutions digitales & ERP"}
              </p>
              <p className="mt-1 text-sm font-medium text-foreground">
                {t("Hero.OdooPartnerBadge") || "Partenaire Odoo officiel"}
              </p>
            </div>
          </ParallaxReveal>
        </div>
      </div>

      {/* Partner logo + badge (fixed to bottom, inside section, not overlapping) */}
      <Reveal
        className="mt-6 flex w-full flex-col items-center justify-center gap-2 text-center lg:mt-8"
        delay={0.12}
      >
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
              className="mt-2 rounded-full border border-border/70 px-3 py-1"
              variant="secondary"
            >
              {t("Hero.OdooPartnerBadge") || "Official Odoo Partner"}
            </Badge>
          </a>
        </div>
      </Reveal>
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
