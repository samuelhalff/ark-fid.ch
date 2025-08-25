// 1. ADD: This component uses hooks, so it must be a Client Component.
"use client";

import { Card, CardContent, CardHeader } from "@/src/components/ui/card";
import services from "@/app/[locale]/home/components/services-items"; // Corrected import path
import TranslatedText from "@/src/components/ui/translated-text"; // 2. ADD: Import our hydration-safe component
import Image from "next/image"; // 3. CHANGE: We are now using the Next.js Image component
import Link from "next/link"; // ADD: Import Link for navigation

interface ServicesProps {
  showSubtitle?: boolean;
}

const Services = ({ showSubtitle = false }: ServicesProps) => {
  // We no longer need `useTranslation()` here, as TranslatedText handles it.
  return (
    <div
      id="services"
      className="max-w-[var(--breakpoint-xl)] mx-auto w-full py-12 xs:py-20 px-6"
    >
      <h2 className="text-3xl xs:text-4xl md:text-5xl md:leading-14 font-bold tracking-tight max-w-4xl mx-auto text-center mb-10">
        {/* 4. CHANGE: Replaced t() with our hydration-safe component */}
        <TranslatedText
          translationKey="Services.Title"
          fallbackText="Services"
          ns="home"
        />
      </h2>
      {showSubtitle && (
        <p className="text-lg text-muted-foreground text-center mb-8 max-w-3xl mx-auto">
          <TranslatedText
            translationKey="Services.Subtitle"
            fallbackText="Comprehensive fiduciary, accounting, and tax services tailored to your business needs."
            ns="home"
          />
        </p>
      )}
      <div className="mt-8 xs:mt-14 w-full mx-auto grid md:grid-cols-2 lg:grid-cols-3 gap-10">
        {services.map((service) => (
          <Link
            key={service.titleKey}
            href={`/services${service.href}`}
            className="block h-full transition-transform hover:scale-105"
          >
            <Card
              // Add `overflow-hidden` as a safety net to ensure nothing can visually escape the card.
              className="flex flex-col justify-between items-center text-center border rounded-xl overflow-hidden shadow-none h-full cursor-pointer hover:shadow-lg transition-shadow"
            >
              <CardHeader className="p-4 pt-4 h-[250px]">
                <div className="flex flex-col items-center gap-4 mt-3">
                  <div className="flex-shrink-0 mt-1">{service.icon}</div>
                  <div className="flex-1">
                    <h4 className="text-xl font-bold tracking-tight break-anywhere hyphenate">
                      <TranslatedText
                        translationKey={service.titleKey}
                        fallbackText={service.titleKey}
                        ns="servicesItems"
                      />
                    </h4>
                    <p className="mt-2 text-gray-700 dark:text-gray-300 text-md xs:text-[17px] break-anywhere hyphenate">
                      <TranslatedText
                        translationKey={service.descriptionKey}
                        fallbackText={service.descriptionKey}
                        ns="servicesItems"
                      />
                    </p>
                  </div>
                </div>
              </CardHeader>

              {/* 5. FUNDAMENTAL CHANGE: The Layout Logic */}
              <CardContent className="grow p-0">
                {/* fixed-height image area; use Next/Image fill + object-cover to ensure consistent cropping and centering */}
                <div className="w-[100%] w-full p-0 box-border flex items-center justify-center">
                  {/* Add a light rounded container so images that don't reach the card edge keep a subtle rounded appearance */}
                  <div className="relative h-full w-full max-w-[90%] overflow-hidden rounded-lg bg-muted/30 p-2 mt-5">
                    <Image
                      src={service.image}
                      alt={service.titleKey}
                      width={0}
                      height={0}
                      sizes="(min-width:1024px) 33vw, (min-width:768px) 50vw, 100vw"
                      className="object-cover w-full h-full rounded-md"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
};

export default Services;
