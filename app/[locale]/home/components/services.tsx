import { Card, CardContent, CardHeader } from "@/src/components/ui/card";
import services from "@/app/[locale]/home/components/services-items";
import ImageWithFallback from "@/src/components/ui/image-with-fallback";
import Link from "next/link";
import heroBlurData from "@/src/lib/heroBlurData.json";
import { localizePath } from "@/src/lib/paths";
import { getTranslations, type Locale } from "@/src/lib/i18n";
import { tidyTitle } from "@/src/lib/typography";
import SectionHeading from "@/src/components/site/section-heading";

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
    aria-hidden="true"
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
      className="mx-auto w-full max-w-[var(--breakpoint-xl)] px-6 py-10 xs:py-14"
    >
      {showHeading && (
        <>
          <SectionHeading
            eyebrow="Nos services"
            title={tidyTitle(tHome("Services.Title") as string)}
            description={showSubtitle ? tHome("Services.Subtitle") : undefined}
            className="max-w-4xl"
          />
        </>
      )}
      <div className="mx-auto mt-8 grid w-full gap-4 sm:mt-10 md:grid-cols-2 lg:grid-cols-3 lg:gap-5">
        {services.map((service) => {
          const headingId = `service-card-${service.titleKey.replace(
            /\./g,
            "-"
          )}`;
          const toggleId = `${headingId}-toggle`;
          const serviceHref = `${localePrefix}${localizePath(
            service.href,
            currentLocale
          )}`;
          return (
            <div key={service.titleKey} className="relative h-full group">
              <Card className="relative flex flex-col justify-between items-center text-center border rounded-2xl overflow-hidden shadow-none h-full cursor-pointer ring-0 dark:ring-2 ring-border/10 dark:ring-border/30 hover:ring-primary/5 dark:hover:ring-primary/20 hover:shadow-xl transition-all duration-200">
                <CardHeader className="w-full px-5 pb-2 pt-5 sm:px-6">
                  <div className="flex w-full flex-1 flex-col items-start gap-4 text-left">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-[#D17A4F]/20 bg-[#FAEEE5] text-[#B86340] ring-1 ring-[#D17A4F]/10 transition-colors duration-200 group-hover:bg-[#F6E4D9] dark:border-[#D17A4F]/20 dark:bg-[#D17A4F]/10 dark:text-[#F3C0A6]">
                      {service.icon}
                    </div>
                    <h3
                      id={headingId}
                      className="text-2xl font-semibold tracking-tight break-words text-balance"
                    >
                      {tItems(service.titleKey)}
                    </h3>
                    <input
                      id={toggleId}
                      type="checkbox"
                      className="peer sr-only"
                      aria-controls={`${toggleId}-content`}
                    />
                    <label
                      htmlFor={toggleId}
                      className="service-toggle relative z-20 inline-flex items-center justify-center gap-2 self-start cursor-pointer select-none rounded-full border border-border/70 bg-background/90 px-4 py-2 text-sm font-medium text-foreground/80 transition-colors hover:border-[#D17A4F]/25 hover:text-[#B86340] focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 peer-checked:text-[#B86340]"
                    >
                      <span className="peer-checked:hidden">
                        {tItems("ShowMore")}
                      </span>
                      <span className="hidden peer-checked:inline">
                        {tItems("ShowLess")}
                      </span>
                      <ArrowUpRightIcon className="transition-transform duration-200 peer-checked:rotate-90" />
                    </label>
                    <div
                      id={`${toggleId}-content`}
                      className="service-toggle-content relative z-20 max-h-0 overflow-hidden px-0 text-left text-sm leading-7 text-muted-foreground transition-all duration-300 ease-in-out peer-checked:mt-3 peer-checked:max-h-[600px] sm:text-base"
                    >
                      <p>{tItems(service.descriptionKey)}</p>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="mt-auto w-full p-0">
                  <div className="box-border w-full p-0">
                    <div className="relative w-full overflow-hidden border-t border-border/60 bg-muted/30 aspect-[2.4/1] transition-transform duration-300 ease-out will-change-transform group-hover:scale-[1.01]">
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
                      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-background/20 to-transparent dark:from-background/35" />
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
