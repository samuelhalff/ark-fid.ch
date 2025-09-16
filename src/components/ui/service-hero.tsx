import { ArrowUpRight, BadgeCheckIcon, Users } from "lucide-react";
import { Button } from "@/src/components/ui/button";
import { Badge } from "@/src/components/ui/badge";
import Image from "next/image";
import Link from "next/link";
import { getTranslations, type Locale } from "@/src/lib/i18n";

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
  secondaryCtaKey: string;
  secondaryCtaFallback: string;
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
  secondaryCtaKey,
  secondaryCtaFallback,
  locale,
}: ServiceHeroProps) => {
  const currentLocale = (locale as Locale) || ("fr" as Locale);
  const t = await getTranslations(currentLocale, namespace);
  const localePrefix = locale ? `/${locale}` : "/fr";

  return (
    <div className="min-h-[calc(100vh-4rem)] max-w-[var(--breakpoint-xl)] w-full flex items-center justify-center overflow-hidden border-b border-accent mx-auto px-6">
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
          <h1 className="mt-6 max-w-full w-full text-3xl xs:text-4xl sm:text-5xl lg:text-[2.75rem] xl:text-5xl font-bold tracking-tight mx-auto break-anywhere hyphenate">
            {t(titleKey) || titleFallback}
          </h1>
          <p className="mt-6 max-w-full w-full xs:text-lg mx-auto break-anywhere hyphenate">
            {t(descriptionKey) || descriptionFallback}
          </p>
          <div className="w-full mt-12 flex flex-col sm:flex-row items-center gap-4 justify-center max-w-md mx-auto">
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
                <ArrowUpRight className="h-5! w-5!" />
              </Button>
            </Link>
            <Link
              href={`${localePrefix}/team`}
              className="w-full sm:w-auto"
              locale={locale}
              prefetch={false}
            >
              <Button
                variant="outline"
                size="lg"
                className="w-full sm:w-auto rounded-full text-base shadow-none transition-transform hover:scale-105 hover:shadow-lg focus-visible:scale-105 focus-visible:shadow-lg"
                style={{ cursor: "pointer" }}
              >
                <Users className="h-5! w-5!" />{" "}
                {t(secondaryCtaKey) || secondaryCtaFallback}
              </Button>
            </Link>
          </div>
          {namespace === "accounting" && (
            <a
              href="https://www.odoo.com"
              target="_blank"
              rel="noopener noreferrer"
            >
              <div className="mt-10 flex flex-col items-center justify-center">
                <Image
                  src="/assets/odoo-logo.svg"
                  className="mt-0 w-24 h-16"
                  alt="Odoo Logo"
                  width={96}
                  height={64}
                  sizes="96px"
                  loading="lazy"
                  decoding="async"
                />
              </div>
            </a>
          )}
        </div>
        <div className="flex-1 relative lg:max-w-lg xl:max-w-xl w-full bg-accent rounded-xl aspect-square animate-in slide-in-from-right-10 duration-500">
          {(() => {
            // Prefer translated alt if available; otherwise use provided fallback
            const key = "ImageAlt";
            const translated = t(key) as string;
            const altText = translated === key ? imageAlt : translated;
            return (
              <Image
                src={imageSrc}
                alt={altText}
                className="object-cover rounded-xl"
                sizes="(min-width:1024px) 520px, 90vw"
                priority
                fetchPriority="high"
                quality={58}
                fill
              />
            );
          })()}
        </div>
      </div>
    </div>
  );
};

export default ServiceHero;
