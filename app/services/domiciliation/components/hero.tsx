"use client";
import { ArrowUpRight, Users } from "lucide-react";
import { Button } from "@/src/components/ui/button";
import { Badge } from "@/src/components/ui/badge";
import TranslatedText from "@/src/components/ui/translated-text";
import Image from "next/image";
import Link from "next/link";

const DomiciliationHero = () => {
  return (
    <div className="min-h-[calc(100vh-4rem)] w-full flex items-center justify-center overflow-hidden border-b border-accent">
      <div className="max-w-(--breakpoint-xl) w-full flex flex-col lg:flex-row mx-auto items-center justify-between gap-y-14 gap-x-10 px-6 py-12 lg:py-0">
        <div className="max-w-xl text-center lg:text-left animate-in fade-in duration-800">
          <div className="gap-2 flex items-center justify-center lg:justify-start">
            <Badge className="rounded-full py-1 border-none">
              <TranslatedText
                translationKey="Domiciliation.Hero.Badge"
                fallbackText="Swiss Domiciliation"
              />
            </Badge>
            <Badge
              variant="destructive"
              className="rounded-full py-1 border-none"
            >
              <TranslatedText
                translationKey="Domiciliation.Hero.AI"
                fallbackText="Business Address Experts"
              />
            </Badge>
          </div>

          <h1 className="mt-6 max-w-[20ch] text-3xl xs:text-4xl sm:text-5xl lg:text-[2.75rem] xl:text-5xl font-bold tracking-tight">
            <TranslatedText
              translationKey="Domiciliation.Hero.Title"
              fallbackText="Professional Domiciliation Services in Switzerland"
            />
          </h1>

          <p className="mt-6 text-xl text-muted-foreground">
            <TranslatedText
              translationKey="Domiciliation.Hero.Description"
              fallbackText="Establish your business presence with a prestigious Swiss address. We provide reliable domiciliation and mail handling for companies of all sizes."
            />
          </p>

          <div className="w-full mt-10 flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4">
            <Link href="/contact" className="w-full">
              <Button
                size="lg"
                className="w-full sm:w-auto rounded-full text-base"
              >
                <TranslatedText
                  translationKey="Domiciliation.Hero.CTA"
                  fallbackText="Get Started"
                />
                <ArrowUpRight className="h-5 w-5 ml-2" />
              </Button>
            </Link>
            <Link href="/team" className="w-full">
              <Button
                size="lg"
                variant="outline"
                className="w-full sm:w-auto rounded-full text-base shadow-none"
              >
                <Users className="h-5 w-5 mr-2" />
                <TranslatedText
                  translationKey="Home.Hero.SecondaryCTA"
                  fallbackText="Meet the Team"
                />
              </Button>
            </Link>
          </div>
        </div>
        <div className="relative lg:max-w-lg xl:max-w-xl w-full bg-accent rounded-xl aspect-square animate-in slide-in-from-right-10 duration-500">
          <Image
            src="/assets/services/domiciliation.png"
            alt="Domiciliation Services"
            fill
            className="object-cover rounded-xl brightness-100"
            priority
          />
        </div>
      </div>
    </div>
  );
};

export default DomiciliationHero;
