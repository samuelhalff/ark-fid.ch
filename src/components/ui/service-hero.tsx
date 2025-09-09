import { ArrowUpRight, BadgeCheckIcon, Users } from "lucide-react";
import { Button } from "@/src/components/ui/button";
import { Badge } from "@/src/components/ui/badge";
import TranslatedText from "@/src/components/ui/translated-text";
import Image from "next/image";
import Link from "next/link";

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
const ServiceHero = ({
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
  const localePrefix = locale ? `/${locale}` : "/fr";

  return (
    <div className="min-h-[calc(100vh-4rem)] w-full flex items-center justify-center overflow-hidden border-b border-accent">
      <div className="max-w-[var(--breakpoint-xl)] w-full flex flex-col lg:flex-row mx-auto items-center justify-between gap-20 px-6 py-12 lg:py-0">
        <div className="flex-1 max-w-3xl text-center animate-in fade-in duration-800">
          <div className="gap-2 flex justify-center items-center">
            <Badge className="rounded-full py-1 border-none">
              <TranslatedText
                ns={namespace}
                translationKey={badge1Key}
                fallbackText={badge1Fallback}
              />
            </Badge>
            <Badge
              variant="destructive"
              className="rounded-full py-1 border-none"
            >
              <TranslatedText
                ns={namespace}
                translationKey={badge2Key}
                fallbackText={badge2Fallback}
              />
            </Badge>
          </div>
          <h1 className="mt-6 max-w-full w-full text-3xl xs:text-4xl sm:text-5xl lg:text-[2.75rem] xl:text-5xl font-bold tracking-tight mx-auto break-anywhere hyphenate">
            <TranslatedText
              ns={namespace}
              translationKey={titleKey}
              fallbackText={titleFallback}
            />
          </h1>
          <p className="mt-6 max-w-full w-full xs:text-lg mx-auto break-anywhere hyphenate">
            <TranslatedText
              ns={namespace}
              translationKey={descriptionKey}
              fallbackText={descriptionFallback}
            />
          </p>
          <div className="w-full mt-12 flex flex-col sm:flex-row items-center gap-4 justify-center max-w-md mx-auto">
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
                <TranslatedText
                  ns={namespace}
                  translationKey={ctaKey}
                  fallbackText={ctaFallback}
                />
                <ArrowUpRight className="h-5! w-5!" />
              </Button>
            </Link>
            <Link
              href={`${localePrefix}/team`}
              className="w-full sm:w-auto"
              locale={locale}
            >
              <Button
                variant="outline"
                size="lg"
                className="w-full sm:w-auto rounded-full text-base shadow-none transition-transform hover:scale-105 hover:shadow-lg focus-visible:scale-105 focus-visible:shadow-lg"
                style={{ cursor: "pointer" }}
              >
                <Users className="h-5! w-5!" />{" "}
                <TranslatedText
                  ns={namespace}
                  translationKey={secondaryCtaKey}
                  fallbackText={secondaryCtaFallback}
                />
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
                  priority
                />
                <Badge
                  variant="outline"
                  className="rounded-full h-5 py-3 px-4 border-black bg-transparent mt-0 flex items-center justify-center"
                >
                  <BadgeCheckIcon className="inline h-4 w-4 mr-1" />
                  <TranslatedText
                    ns="home"
                    translationKey="Hero.OdooBadge"
                    fallbackText="Odoo Partner"
                  />
                </Badge>
              </div>
            </a>
          )}
        </div>
        <div className="flex-1 relative lg:max-w-lg xl:max-w-xl w-full bg-accent rounded-xl aspect-square animate-in slide-in-from-right-10 duration-500">
          <Image
            src={imageSrc}
            alt={imageAlt}
            className="object-cover rounded-xl"
            sizes="100vw"
            style={{ height: "100%", width: "auto" }}
            priority
            width={0}
            height={0}
          />
        </div>
      </div>
    </div>
  );
};

export default ServiceHero;
