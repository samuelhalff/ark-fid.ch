import { getCurrentLocale, getTranslations, type Locale } from "@/src/lib/i18n";
import { tidyTitle } from "@/src/lib/typography";
import ContextualLinksServer from "@/src/components/ui/contextual-links-server";

export default async function About() {
  const locale: Locale = getCurrentLocale();
  const t = await getTranslations(locale, "home");

  const content = (t("About.Content") as unknown) as string[];

  return (
    <section className="mx-auto w-full py-12 xs:py-20 px-6 flex flex-col items-center">
      <div className="w-full max-w-[1200px]">
        <h2 className="text-3xl xs:text-4xl md:text-5xl font-bold tracking-tight mb-8 text-center">
          {tidyTitle(t("About.Title") as string)}
        </h2>

        <div className="text-left w-full space-y-8">
          <ContextualLinksServer locale={locale}>{content}</ContextualLinksServer>

          <div className="grid md:grid-cols-2 gap-8 mt-12">
            <div className="space-y-4">
              <h3 className="text-2xl font-semibold">
                {tidyTitle(t("About.Quality.Title") as string)}
              </h3>
              <ContextualLinksServer locale={locale}>
                {(t("About.Quality.Content") as unknown) as string}
              </ContextualLinksServer>
            </div>

            <div className="space-y-4">
              <h3 className="text-2xl font-semibold">
                {tidyTitle(t("About.Innovation.Title") as string)}
              </h3>
              <ContextualLinksServer locale={locale}>
                {(t("About.Innovation.Content") as unknown) as string}
              </ContextualLinksServer>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
