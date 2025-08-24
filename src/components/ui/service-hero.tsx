"use client";
import { ArrowUpRight, Users } from "lucide-react";
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
}: ServiceHeroProps) => (
  <div className="min-h-[calc(100vh-4rem)] w-full flex items-center justify-center overflow-hidden border-b border-accent">
    <div className="max-w-[var(--breakpoint-xl)] w-full flex flex-col lg:flex-row mx-auto items-center justify-between gap-y-14 gap-x-10 px-6 py-12 lg:py-0">
      <div className="max-w-2xl text-center animate-in fade-in duration-800">
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
        <h1 className="mt-6 max-w-full w-full text-3xl xs:text-4xl sm:text-5xl lg:text-[2.75rem] xl:text-5xl font-bold tracking-tight mx-auto">
          <TranslatedText
            ns={namespace}
            translationKey={titleKey}
            fallbackText={titleFallback}
          />
        </h1>
        <p className="mt-6 max-w-full w-full xs:text-lg mx-auto">
          <TranslatedText
            ns={namespace}
            translationKey={descriptionKey}
            fallbackText={descriptionFallback}
          />
        </p>
        <div className="w-full mt-12 flex flex-col sm:flex-row items-center gap-4 justify-center max-w-md mx-auto">
          <Link href="/contact" className="w-full sm:w-auto">
            <Button
              size="lg"
              className="w-full sm:w-auto rounded-full text-base"
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
          <Link href="/team" className="w-full sm:w-auto">
            <Button
              variant="outline"
              size="lg"
              className="w-full sm:w-auto rounded-full text-base shadow-none"
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
      </div>
      <div className="relative lg:max-w-lg xl:max-w-xl w-full bg-accent rounded-xl aspect-square animate-in slide-in-from-right-10 duration-500">
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

export default ServiceHero;
