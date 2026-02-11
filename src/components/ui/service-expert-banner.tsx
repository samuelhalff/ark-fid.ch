import Link from "next/link";
import { Button } from "@/src/components/ui/button";
import { getTranslations, type Locale } from "@/src/lib/i18n";
import { tidyTitle } from "@/src/lib/typography";

const ServiceExpertBanner = async ({ locale }: { locale: string }) => {
  const activeLocale = (locale as Locale) || ("fr" as Locale);
  const t = await getTranslations(activeLocale, "services");
  const localePrefix = locale ? `/${locale}` : "/fr";

  const title =
    (t("ExpertBanner.Title") as string) || "Speak to one of our experts";
  const description =
    (t("ExpertBanner.Description") as string) ||
    "Need a quick opinion or a clear quote? Our team replies fast and keeps it simple.";
  const primary =
    (t("ExpertBanner.PrimaryCTA") as string) || "Speak to an expert";
  const secondary =
    (t("ExpertBanner.SecondaryCTA") as string) || "Get an instant quote";

  return (
    <section className="mt-16 rounded-2xl border border-primary/20 bg-primary/5 px-8 py-10 text-center">
      <div className="mx-auto max-w-3xl space-y-4">
        <h3 className="text-2xl font-semibold">{tidyTitle(title)}</h3>
        <p className="text-base text-muted-foreground">{description}</p>
        <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            href={`${localePrefix}/contact/`}
            locale={activeLocale}
            prefetch={false}
          >
            <Button size="lg" className="rounded-full">
              {primary}
            </Button>
          </Link>
          <Link
            href={`${localePrefix}/agent/`}
            locale={activeLocale}
            prefetch={false}
          >
            <Button size="lg" variant="secondary" className="rounded-full">
              {secondary}
            </Button>
          </Link>
        </div>
      </div>
    </section>
  );
};

export default ServiceExpertBanner;
