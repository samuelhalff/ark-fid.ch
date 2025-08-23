"use client";
import { ArrowUpRight, BadgeCheckIcon, Users } from "lucide-react";
import { Button } from "@/src/components/ui//button";
import { Badge } from "@/src/components/ui/badge";
import TranslatedText from "@/src/components/ui/translated-text";
import Image from "next/image";
import Link from "next/link";

const Hero = () => (
  <div className="min-h-[calc(100vh-4rem)] w-full flex items-center justify-center overflow-hidden border-b border-accent">
    <div className="max-w-(--breakpoint-xl) w-full flex flex-col lg:flex-row mx-auto items-center justify-between gap-y-14 gap-x-10 px-6 py-12 lg:py-0">
      <div className="max-w-xl text-center animate-in fade-in duration-800">
        <div className="gap-2 flex justify-center items-center">
          <Badge className="rounded-full py-1 border-none">
            <TranslatedText
              ns="home"
              translationKey="Hero.Badge"
              fallbackText="Swiss Made"
            />
          </Badge>
          <Badge
            variant="destructive"
            className="rounded-full py-1 border-none"
          >
            <TranslatedText
              ns="home"
              translationKey="Hero.OdooBadge"
              fallbackText="Official Odoo Partner"
            />
          </Badge>
        </div>
        <h1 className="mt-6 max-w-[20ch] w-full text-3xl xs:text-4xl sm:text-5xl lg:text-[2.75rem] xl:text-5xl font-bold tracking-tight m-auto">
          <TranslatedText
            ns="home"
            translationKey="Hero.Title"
            fallbackText="Title"
          />
        </h1>
        <p className="mt-6 max-w-[60ch] xs:text-lg">
          <TranslatedText
            ns="home"
            translationKey="Hero.Description"
            fallbackText="Description"
          />
        </p>
        <div className="w-full mt-12 flex flex-col sm:flex-row items-center gap-4 justify-center">
          <Link href="/contact" className="w-full">
            <Button
              size="lg"
              className="w-full sm:w-auto rounded-full text-base"
              style={{ cursor: "pointer" }}
            >
              <TranslatedText
                ns="home"
                translationKey="Hero.CTA"
                fallbackText="Contact"
              />
              <ArrowUpRight className="h-5! w-5!" />
            </Button>
          </Link>
          <Link href="/team" className="w-full">
            <Button
              variant="outline"
              size="lg"
              className="w-full sm:w-auto rounded-full text-base shadow-none"
              style={{ cursor: "pointer" }}
            >
              <Users className="h-5! w-5!" />{" "}
              <TranslatedText
                ns="home"
                translationKey="Hero.SecondaryCTA"
                fallbackText="Team"
              />
            </Button>
          </Link>
        </div>
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
      </div>
      <div className="relative lg:max-w-lg xl:max-w-xl w-full bg-accent rounded-xl aspect-square animate-in slide-in-from-right-10 duration-500">
        <Image
          src="/assets/main-bg.jpg"
          alt="main background"
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

export default Hero;
