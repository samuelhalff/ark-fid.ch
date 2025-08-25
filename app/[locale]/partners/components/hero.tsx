import React from "react";
import { Users, Handshake } from "lucide-react";
import { Button } from "@/src/components/ui/button";
import { Badge } from "@/src/components/ui/badge";
import TranslatedText from "@/src/components/ui/translated-text";
import Image from "next/image";
import Link from "next/link";

interface PartnersHeroProps {
  locale?: string;
}

const PartnersHero = ({ locale }: PartnersHeroProps) => {
  const localePrefix = locale ? `/${locale}` : "/fr";

  return (
    <div className="min-h-[calc(100vh-4rem)] w-full flex items-center justify-center overflow-hidden border-b border-accent">
      <div className="max-w-[var(--breakpoint-xl)] w-full flex flex-col lg:flex-row mx-auto items-center justify-between gap-20 px-6 py-12 lg:py-0">
        <div className="max-w-2xl text-center animate-in fade-in duration-800">
          <div className="gap-2 flex justify-center items-center mb-6">
            <Badge className="rounded-full py-1 border-none bg-blue-100 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400">
              <Handshake className="w-4 h-4 mr-1" />
              <TranslatedText
                ns="partners"
                translationKey="Hero.Badge"
                fallbackText="Strategic Partnerships"
              />
            </Badge>
          </div>
          <h1 className="text-3xl xs:text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight mb-6">
            <TranslatedText
              ns="partners"
              translationKey="IntroTitle"
              fallbackText="Our Partners"
            />
          </h1>
          <p className="text-lg xs:text-xl text-muted-foreground leading-relaxed mb-8">
            <TranslatedText
              ns="partners"
              translationKey="IntroText"
              fallbackText="We collaborate with trusted partners to provide comprehensive professional services to our clients."
            />
          </p>
          <div className="w-full flex flex-col sm:flex-row items-center gap-4 justify-center">
            <Link href={`${localePrefix}/contact`} className="w-full sm:w-auto">
              <Button
                size="lg"
                className="w-full sm:w-auto rounded-full text-base transition-transform hover:scale-105 hover:shadow-lg focus-visible:scale-105 focus-visible:shadow-lg"
                style={{ cursor: "pointer" }}
              >
                <TranslatedText
                  ns="partners"
                  translationKey="Hero.CTA"
                  fallbackText="Partner With Us"
                />
                <Handshake className="h-5 w-5 ml-2" />
              </Button>
            </Link>
            <Link href={`${localePrefix}/team`} className="w-full sm:w-auto">
              <Button
                variant="outline"
                size="lg"
                className="w-full sm:w-auto rounded-full text-base shadow-none transition-transform hover:scale-105 hover:shadow-lg focus-visible:scale-105 focus-visible:shadow-lg"
                style={{ cursor: "pointer" }}
              >
                <Users className="h-5 w-5 mr-2" />
                <TranslatedText
                  ns="partners"
                  translationKey="Hero.SecondaryCTA"
                  fallbackText="Meet our team"
                />
              </Button>
            </Link>
          </div>
        </div>
        <div className="relative lg:max-w-lg xl:max-w-xl w-full bg-accent rounded-xl aspect-square animate-in slide-in-from-right-10 duration-500">
          <Image
            src="/assets/main-bg.jpg"
            alt="Partnership collaboration"
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

export default PartnersHero;
