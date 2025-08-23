import { ArrowUpRight, Users } from "lucide-react";
import { Button } from "@/src/components/ui/button";
import { Badge } from "@/src/components/ui/badge";
import TranslatedText from "@/src/components/ui/translated-text";
import Image from "next/image";
import Link from "next/link";

const TaxesHero = () => {
  return (
    <div className="min-h-[calc(100vh-4rem)] w-full flex items-center justify-center overflow-hidden border-b border-accent">
      <div className="max-w-(--breakpoint-xl) w-full flex flex-col lg:flex-row mx-auto items-center justify-between gap-y-14 gap-x-10 px-6 py-12 lg:py-0">
        <div className="max-w-xl text-center lg:text-left animate-in fade-in duration-800">
          <div className="gap-2 flex items-center justify-center lg:justify-start">
            <Badge className="rounded-full py-1 border-none">
              <TranslatedText
                translationKey="Taxes.Hero.Badge"
                fallbackText="Swiss Expertise"
              />
            </Badge>
            <Badge
              variant="destructive"
              className="rounded-full py-1 border-none"
            >
              <TranslatedText
                translationKey="Taxes.Hero.BadgeTwo"
                fallbackText="Tax Specialists"
              />
            </Badge>
          </div>

          <h1 className="mt-6 max-w-[20ch] text-3xl xs:text-4xl sm:text-5xl lg:text-[2.75rem] xl:text-5xl font-bold tracking-tight">
            <TranslatedText
              translationKey="Taxes.Hero.Title"
              fallbackText="Expert Tax Services in Switzerland"
            />
          </h1>

          <p className="mt-6 text-xl text-muted-foreground">
            <TranslatedText
              translationKey="Taxes.Hero.Description"
              fallbackText="Navigate Swiss tax regulations with confidence. Our experts ensure optimal tax planning and compliance."
            />
          </p>

          <div className="w-full mt-10 flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4">
            <Link href="/contact" className="w-full">
              <Button
                size="lg"
                className="w-full sm:w-auto rounded-full text-base"
              >
                <TranslatedText
                  translationKey="Taxes.Hero.PrimaryCTA"
                  fallbackText="Get Started"
                />
                <ArrowUpRight className="h-5 w-5 ml-2" />
              </Button>
            </Link>
            <Link href="/team" className="w-full">
              <Button
                variant="outline"
                size="lg"
                className="w-full sm:w-auto rounded-full text-base shadow-none"
              >
                <Users className="h-5 w-5 mr-2" />
                <TranslatedText
                  translationKey="Taxes.Hero.SecondaryCTA"
                  fallbackText="Meet the Team"
                />
              </Button>
            </Link>
          </div>
        </div>
        <div className="relative lg:max-w-lg xl:max-w-xl w-full bg-accent rounded-xl aspect-square animate-in slide-in-from-right-10 duration-500">
          <Image
            src="/assets/services/tax-desk.png"
            alt="Tax Services"
            fill
            className="object-cover rounded-xl brightness-100"
            priority
          />
        </div>
      </div>
    </div>
  );
};

export default TaxesHero;
