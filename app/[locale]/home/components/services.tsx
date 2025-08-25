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
      <div className="mt-8 xs:mt-14 w-full mx-auto grid md:grid-cols-2 lg:grid-cols-3 gap-20">
        {services.map((service) => (
          <Link
            key={service.titleKey}
            href={`/services${service.href}`}
            className="block transition-transform hover:scale-105"
          >
            <Card
              // Add `overflow-hidden` as a safety net to ensure nothing can visually escape the card.
              className="flex flex-col border rounded-xl overflow-hidden shadow-none h-full cursor-pointer hover:shadow-lg transition-shadow"
            >
              <CardHeader style={{ padding: "1rem 1rem 0", minHeight: 190 }}>
                <div className="flex items-start gap-4 mt-3!">
                  <div className="flex-shrink-0 mt-1">{service.icon}</div>
                  <div className="flex-1">
                    <h4 className="text-left text-xl font-bold tracking-tight">
                      <TranslatedText
                        translationKey={service.titleKey}
                        fallbackText={service.titleKey}
                        ns="servicesItems"
                      />
                    </h4>
                    <p className="mt-2 text-left text-gray-700 dark:text-gray-300 text-md xs:text-[17px]">
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
                {/* 
                  This div now has a fixed height and provides the left-offset
                  using PADDING, not a margin. This creates a correctly sized
                  "window" for the image.
                */}
                <div className="h-56 w-full p-0 pl-6 pb-6 box-border">
                  {/* 
                    This is the container that the image will fill. It is RELATIVE
                    and will perfectly fill the padded space of its parent.
                  */}
                  <div className="relative h-full w-full rounded-tl-xl overflow-hidden">
                    <Image
                      src={service.image}
                      alt={service.titleKey} // The alt text should also be translated for accessibility
                      width={0}
                      height={0}
                      sizes="100vw"
                      style={{ width: "100%", height: "auto" }}
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
