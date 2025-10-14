// Inline minimal arrow icon to avoid pulling lucide-react into shared chunk
import { Button } from "@/src/components/ui/button";
import { Badge } from "@/src/components/ui/badge";
import Image from "next/image";
import Link from "next/link";
import { getTranslations, type Locale } from "@/src/lib/i18n";
import heroBlurData from "@/src/lib/heroBlurData.json";
import { tidyTitle, splitTitle } from "@/src/lib/typography";

interface ServiceHeroProps {
  namespace: string;
  imageSrc: string;
  imageAlt: string;
  badge1Key: string;
  badge1Fallback: string;
  badge2Key: string;
  badge2Fallback: string;
  titleKey: string;
  titleFallback: string;
  descriptionKey: string;
  descriptionFallback: string;
  ctaKey: string;
  ctaFallback: string;
  locale?: string;
}

const ServiceHero = async ({
  namespace,
  imageSrc,
  imageAlt,
  badge1Key,
  badge1Fallback,
  badge2Key,
  badge2Fallback,
  titleKey,
  titleFallback,
  descriptionKey,
  descriptionFallback,
  ctaKey,
  ctaFallback,
  locale,
}: ServiceHeroProps) => {
  const currentLocale = (locale as Locale) || ("fr" as Locale);
  const t = await getTranslations(currentLocale, namespace);
  const localePrefix = locale ? `/${locale}` : "/fr";

  const ArrowIcon = () => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      className="h-5! w-5!"
    >
      <path d="M7 17a1 1 0 0 0 1.707.707l7.586-7.586V16a1 1 0 1 0 2 0V6a1 1 0 0 0-1-1H9a1 1 0 1 0 0 2h5.879L7.293 15.586A1 1 0 0 0 7 16v1z" />
    </svg>
  );

  return (
    <div className="relative min-h-[calc(100vh-4rem)] max-w-[var(--breakpoint-xl)] w-full flex items-center justify-center overflow-hidden border-b border-accent mx-auto px-6 pb-24">
      <link
        rel="preload"
        as="image"
        href={imageSrc || "/assets/hero/services/home-hero.avif"}
      />
      <div className="max-w-[var(--breakpoint-xl)] w-full flex flex-col lg:flex-row mx-auto items-center justify-between gap-20 px-6 py-12 lg:py-0">
        <div className="flex-1 max-w-3xl text-center animate-in fade-in duration-800">
          <div className="gap-2 flex justify-center items-center">
            <Badge className="rounded-full py-1 border-none">
              {t(badge1Key) || badge1Fallback}
            </Badge>
            <Badge
              variant="destructive"
              className="rounded-full py-1 border-none"
            >
              {t(badge2Key) || badge2Fallback}
            </Badge>
          </div>
          {(() => {
            const raw = (t(titleKey) as string) || titleFallback;
            const { title, subtitle } = splitTitle(raw);
            return (
              <>
                <h1 className="mt-6 max-w-full w-full text-3xl xs:text-4xl sm:text-5xl lg:text-[2.75rem] xl:text-5xl font-bold tracking-tight mx-auto break-anywhere hyphenate">
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
          <p className="mt-6 max-w-full w-full xs:text-lg mx-auto break-anywhere hyphenate">
            {t(descriptionKey) || descriptionFallback}
          </p>
          <div className="w-full mt-12 flex items-center justify-center max-w-md mx-auto">
            <Link
              href={`${localePrefix}/contact`}
              className="w-full sm:w-auto"
              locale={locale}
              prefetch={false}
            >
              <Button
                size="lg"
                className="w-full sm:w-auto rounded-full text-base transition-transform hover:scale-105 hover:shadow-lg focus-visible:scale-105 focus-visible:shadow-lg"
                style={{ cursor: "pointer" }}
              >
                {t(ctaKey) || ctaFallback}
                <ArrowIcon />
              </Button>
            </Link>
          </div>
          {/* Inline Odoo partner branding for accounting only (reverted position) */}
          {namespace === "accounting" && (
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
          )}
        </div>
        <div className="flex-1 relative lg:max-w-lg xl:max-w-xl w-full bg-accent rounded-xl aspect-square animate-in slide-in-from-right-10 duration-500">
          {(() => {
            const key = "ImageAlt";
            const translated = t(key) as string;
            const altText = translated === key ? imageAlt : translated;
            // If the target image is missing (assets being refreshed), fall back to a bundled abstract background
            const fallback = "/assets/hero/services/home-hero.avif";
            const src = imageSrc || fallback;
            return (
              <Image
                src={src}
                alt={altText}
                className="object-cover rounded-xl"
                sizes="(min-width:1024px) 520px, 90vw"
                priority
                fetchPriority="high"
                quality={60}
                fill
              />
            );
          })()}
        </div>
      </div>
      {namespace === "odoo" && (
        <div className="absolute bottom-6 left-0 right-0 flex flex-col items-center gap-2">
          <a
            href="https://www.odoo.com"
            target="_blank"
            rel="noopener noreferrer"
          >
            <Image
              src="/assets/partners/odoo-logo.svg"
              alt="Odoo Logo"
              width={120}
              height={40}
              className="opacity-90"
              loading="lazy"
              decoding="async"
            />
          </a>
          <Badge className="rounded-full py-1 border-none" variant="secondary">
            {t("Hero.OdooPartnerBadge") || "Official Odoo Partner"}
          </Badge>
        </div>
      )}
    </div>
  );
};

export default ServiceHero;
