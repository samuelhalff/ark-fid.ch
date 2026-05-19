import { getCurrentLocale, getTranslations, type Locale } from "@/src/lib/i18n";
import { tidyTitle } from "@/src/lib/typography";
import ContextualLinksServer from "@/src/components/ui/contextual-links-server";
import SectionHeading from "@/src/components/site/section-heading";

export default async function About() {
  const locale: Locale = await getCurrentLocale();
  const t = await getTranslations(locale, "home");

  const content = (t("About.Content") as unknown) as string[];

  return (
    <section className="mx-auto flex w-full flex-col items-center px-6 py-12 xs:py-20">
      <div className="w-full max-w-[1200px]">
        <SectionHeading
          eyebrow="À propos"
          title={tidyTitle(t("About.Title") as string)}
          align="center"
          className="mb-8 max-w-4xl"
        />

        <div className="w-full space-y-8 text-left">
          <div className="rounded-[28px] border border-border/70 bg-gradient-to-br from-muted/60 via-background to-muted/20 p-6 shadow-sm sm:p-8">
            <ContextualLinksServer locale={locale}>
              {content}
            </ContextualLinksServer>
          </div>

          <div className="mt-12 grid gap-5 md:grid-cols-2">
            <div className="space-y-4 rounded-[28px] border border-border/70 bg-background p-6 shadow-sm sm:p-7">
              <h3 className="text-2xl font-semibold tracking-tight">
                {tidyTitle(t("About.Quality.Title") as string)}
              </h3>
              <ContextualLinksServer locale={locale}>
                {(t("About.Quality.Content") as unknown) as string}
              </ContextualLinksServer>
            </div>

            <div className="space-y-4 rounded-[28px] border border-border/70 bg-background p-6 shadow-sm sm:p-7">
              <h3 className="text-2xl font-semibold tracking-tight">
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
