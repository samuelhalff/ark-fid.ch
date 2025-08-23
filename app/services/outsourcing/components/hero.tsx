"use client";

import { ArrowUpRight, Users } from "lucide-react";
import { Button } from "@/src/components/ui/button";
import { Badge } from "@/src/components/ui/badge";
import TranslatedText from "@/src/components/ui/translated-text";
import Image from "next/image";
import Link from "next/link";

const OutsourcingHero = () => {
  return (
    <div className="min-h-[calc(100vh-4rem)] w-full flex items-center justify-center overflow-hidden border-b border-accent">
      <div className="container max-w-7xl w-full flex flex-col lg:flex-row mx-auto items-center justify-between gap-y-12 lg:gap-y-14 gap-x-8 lg:gap-x-10 px-4 sm:px-6 py-12 lg:py-20">
        <div className="w-full max-w-xl text-center lg:text-left animate-in fade-in duration-800">
          <div className="gap-2 flex flex-wrap items-center justify-center lg:justify-start">
            <Badge className="rounded-full py-1 border-none">
              <TranslatedText
                translationKey="Outsourcing.Hero.Badge"
                fallbackText="Swiss Quality"
              />
            </Badge>
            <Badge
              variant="destructive"
              className="rounded-full py-1 border-none"
            >
              <TranslatedText
                translationKey="Outsourcing.Hero.BadgeTwo"
                fallbackText="BPO Experts"
              />
            </Badge>
          </div>

          <h1 className="mt-8 sm:mt-10 max-w-[20ch] text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-bold tracking-tight leading-[1.1]">
            <TranslatedText
              translationKey="Outsourcing.Hero.Title"
              fallbackText="Streamline Your Business Operations"
            />
          </h1>

          <p className="mt-6 text-lg sm:text-xl text-muted-foreground max-w-md sm:max-w-lg">
            <TranslatedText
              translationKey="Outsourcing.Hero.Description"
              fallbackText="Focus on your core business while we handle your back office operations with Swiss precision and reliability."
            />
          </p>

          <div className="mt-10 w-full sm:w-auto flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
            <Link href="/contact" className="w-full sm:w-auto">
              <Button
                size="lg"
                className="w-full rounded-full text-base h-12 sm:h-14 px-8"
              >
                <TranslatedText
                  translationKey="Outsourcing.Hero.PrimaryCTA"
                  fallbackText="Get Started"
                />
                <ArrowUpRight className="h-5 w-5 ml-2" />
              </Button>
            </Link>
            <Link href="/team" className="w-full sm:w-auto">
              <Button
                variant="outline"
                size="lg"
                className="w-full rounded-full text-base h-12 sm:h-14 px-8 shadow-none hover:shadow-sm"
              >
                <Users className="h-5 w-5 mr-2" />
                <TranslatedText
                  translationKey="Outsourcing.Hero.SecondaryCTA"
                  fallbackText="Meet the Team"
                />
              </Button>
            </Link>
          </div>
        </div>
        <div className="relative w-full sm:w-4/5 md:w-2/3 lg:w-1/2 xl:w-[45%] aspect-[4/3] sm:aspect-square bg-accent rounded-xl animate-in slide-in-from-right-10 duration-500">
          <Image
            src="/assets/services/outsourcing.png"
            alt="Outsourcing Services"
            fill
            className="object-cover rounded-xl brightness-100 hover:scale-105 transition-transform duration-500"
            priority
          />
        </div>
      </div>
    </div>
  );
};

export default OutsourcingHero;
