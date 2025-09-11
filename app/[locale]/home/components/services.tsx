import { Card, CardContent, CardHeader } from "@/src/components/ui/card";
import services from "@/app/[locale]/home/components/services-items";
import Image from "next/image";
import Link from "next/link";
import { getTranslations, type Locale } from "@/src/lib/i18n";

interface ServicesProps {
  showSubtitle?: boolean;
  locale?: string;
}

const Services = async ({ showSubtitle = false, locale }: ServicesProps) => {
  const currentLocale = (locale as Locale) || ("fr" as Locale);
  const localePrefix = locale ? `/${locale}` : "/fr";
  const tHome = await getTranslations(currentLocale, "home");
  const tItems = await getTranslations(currentLocale, "servicesItems");
  return (
    <div
      id="services"
      className="max-w-[var(--breakpoint-xl)] mx-auto w-full py-12 xs:py-20 px-6"
    >
      <h2 className="text-3xl xs:text-4xl md:text-5xl md:leading-14 font-bold tracking-tight max-w-4xl mx-auto text-center mb-10">
        {tHome("Services.Title")}
      </h2>
      {showSubtitle && (
        <p className="text-lg text-center mb-8 max-w-3xl mx-auto">
          {tHome("Services.Subtitle")}
        </p>
      )}
      <div className="mt-10 xs:mt-16 w-full mx-auto grid md:grid-cols-2 lg:grid-cols-3 gap-10 lg:gap-12">
        {services.map((service) => (
          <Link
            key={service.titleKey}
            href={`${localePrefix}/services${service.href}`}
            locale={locale}
            className="block h-full"
          >
            <Card
              // Add `overflow-hidden` as a safety net to ensure nothing can visually escape the card.
              className="group flex flex-col justify-between items-center text-center border rounded-2xl overflow-hidden shadow-none h-full cursor-pointer ring-1 ring-border/50 hover:ring-primary/60 hover:shadow-xl transition-all duration-200"
            >
              <CardHeader className="px-6 pt-6 pb-4 w-full">
                <div className="flex flex-col items-center gap-5">
                  <div className="text-gray-200 flex-shrink-0 flex items-center justify-center h-12 w-12 my-1 bg-gray-800/70 rounded-full">
                    {service.icon}
                  </div>
                  {/* Text block with a min-height so all cards align their image area */}
                  <div className="flex-1 w-full min-h-[240px] md:min-h-[260px] flex flex-col items-center justify-start">
                    <h4 className="text-2xl font-bold tracking-tight break-words text-balance">
                      {tItems(service.titleKey)}
                    </h4>
                    <p className="mt-3 text-muted-foreground text-base xs:text-[17px] leading-7 break-words text-pretty">
                      {tItems(service.descriptionKey)}
                    </p>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="p-0 w-full mt-auto">
                {/* Fixed aspect-ratio image area so all cards align visually */}
                <div className="w-full p-0 box-border">
                  <div className="relative w-full aspect-[4/3] overflow-hidden bg-muted/30">
                    <Image
                      src={service.image}
                      alt={tItems(service.titleKey)}
                      fill
                      sizes="(min-width:1024px) 33vw, (min-width:768px) 50vw, 100vw"
                      quality={72}
                      className="object-cover transition-transform duration-300 ease-out group-hover:scale-[1.02]"
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
