import { Card, CardContent, CardHeader } from "@/src/components/ui/card";
import services from "@/app/[locale]/home/components/services-items";
import ImageWithFallback from "@/src/components/ui/image-with-fallback";
import Link from "next/link";
import heroBlurData from "@/src/lib/heroBlurData.json";
import { localizePath } from "@/src/lib/paths";
import { getTranslations, type Locale } from "@/src/lib/i18n";
import { tidyTitle } from "@/src/lib/typography";

const ArrowUpRightIcon = ({ className }: { className?: string }) => (
  <svg
    viewBox="0 0 24 24"
    width="16"
    height="16"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path d="M7 17 17 7" />
    <polyline points="7 7 17 7 17 17" />
  </svg>
);

interface ServicesProps {
  showSubtitle?: boolean;
  showHeading?: boolean; // controls rendering of the internal heading block
  locale?: string;
}

const Services = async ({
  showSubtitle = false,
  showHeading = true,
  locale,
}: ServicesProps) => {
  const currentLocale = (locale || "fr") as Locale;
  const localePrefix = currentLocale ? `/${currentLocale}` : "/fr";

  const tHome = await getTranslations(currentLocale, "home");
  const tItems = await getTranslations(currentLocale, "servicesItems");
  return (
    <div
      id="services"
      className="max-w-[var(--breakpoint-xl)] mx-auto w-full py-8 xs:py-12 px-6"
    >
      <style>{`
        .service-toggle-input + label .service-toggle__less {
          display: none;
        }
        .service-toggle-input:checked + label .service-toggle__less {
          display: inline;
        }
        .service-toggle-input:checked + label .service-toggle__more {
          display: none;
        }
        .service-toggle-input:checked + label .service-toggle__icon {
          transform: rotate(90deg);
        }
        .service-toggle-content {
          max-height: 0;
          overflow: hidden;
          margin-top: 0;
          transition: max-height 0.3s ease, margin-top 0.3s ease;
        }
        .service-toggle-input:checked ~ .service-toggle-content {
          max-height: 600px;
          margin-top: 0.75rem;
        }
      `}</style>
      {showHeading && (
        <>
          <h2 className="text-3xl xs:text-4xl md:text-5xl md:leading-14 font-bold tracking-tight max-w-4xl mx-auto text-center mb-10">
            {tidyTitle(tHome("Services.Title") as string)}
          </h2>
          {showSubtitle && (
            <p className="text-lg text-center mb-8 max-w-3xl mx-auto">
              {tHome("Services.Subtitle")}
            </p>
          )}
        </>
      )}
      <div className="mt-8 xs:mt-12 w-full mx-auto grid md:grid-cols-2 lg:grid-cols-3 gap-8 lg:gap-10">
        {services.map((service) => {
          const headingId = `service-card-${service.titleKey.replace(/\./g, "-")}`;
          const toggleId = `${headingId}-toggle`;
          const serviceHref = `${localePrefix}${localizePath(
            service.href,
            currentLocale
          )}`;
          return (
            <div key={service.titleKey} className="relative h-full">
              <Card className="relative group flex flex-col justify-between items-center text-center border rounded-2xl overflow-hidden shadow-none h-full cursor-pointer ring-0 dark:ring-2 ring-border/10 dark:ring-border/30 hover:ring-primary/5 dark:hover:ring-primary/20 hover:shadow-xl transition-all duration-200">
                <CardHeader className="px-6 pt-6 pb-2 w-full">
                  <div className="flex-1 w-full flex flex-col items-center text-center gap-4">
                    <div className="flex-shrink-0 flex items-center justify-center h-14 w-14 sm:h-16 sm:w-16 rounded-full bg-primary/10 text-primary ring-1 ring-primary/20">
                      {service.icon}
                    </div>
                    <h3
                      id={headingId}
                      className="text-2xl font-bold tracking-tight break-words text-balance"
                    >
                      {tItems(service.titleKey)}
                    </h3>
                    <input
                      id={toggleId}
                      type="checkbox"
                      className="service-toggle-input sr-only"
                      aria-controls={`${toggleId}-content`}
                    />
                    <label
                      htmlFor={toggleId}
                      className="service-toggle relative z-20 inline-flex items-center justify-center gap-2 cursor-pointer select-none rounded-full px-4 py-2 text-sm font-medium text-primary/80 hover:text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 bg-primary/10 hover:bg-primary/15 transition-colors"
                    >
                      <span className="service-toggle__more">
                        {tItems("ShowMore")}
                      </span>
                      <span className="service-toggle__less">
                        {tItems("ShowLess")}
                      </span>
                      <ArrowUpRightIcon className="service-toggle__icon transition-transform duration-200" />
                    </label>
                    <div
                      id={`${toggleId}-content`}
                      className="service-toggle-content relative z-20 px-1 text-left text-muted-foreground text-base xs:text-[17px] leading-7"
                    >
                      <p>{tItems(service.descriptionKey)}</p>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="p-0 w-full mt-auto">
                  <div className="w-full p-0 box-border">
                    <div className="relative w-full aspect-[2/1] overflow-hidden bg-muted/30 will-change-transform transition-transform duration-300 ease-out group-hover:scale-[1.02]">
                      <ImageWithFallback
                        src={service.image}
                        alt={tItems(service.titleKey)}
                        fill
                        sizes="(min-width:1024px) 20vw, (min-width:768px) 30vw, 80vw"
                        quality={60}
                        placeholder="blur"
                        loading="lazy"
                        blurDataURL={
                          (heroBlurData as Record<string, string>)[
                            service.image
                          ] ||
                          "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mO0dOjYfwAIGQMCq9zJ3wAAAABJRU5ErkJggg=="
                        }
                        className="object-cover object-center transition-transform duration-300 ease-out group-hover:scale-[1.02]"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Link
                href={serviceHref}
                prefetch={false}
                locale={locale}
                className="absolute inset-0 z-10"
                aria-labelledby={headingId}
              >
                <span className="sr-only">{tItems(service.titleKey)}</span>
              </Link>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default Services;
