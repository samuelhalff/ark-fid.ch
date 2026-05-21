import { getCurrentLocale, getTranslations, type Locale } from "@/src/lib/i18n";
import { tidyTitle } from "@/src/lib/typography";
import ContextualLinksServer from "@/src/components/ui/contextual-links-server";
import SectionHeading from "@/src/components/site/section-heading";
import Reveal from "@/src/components/motion/reveal";

export default async function About() {
  const locale: Locale = await getCurrentLocale();
  const t = await getTranslations(locale, "home");

  const content = (t("About.Content") as unknown) as string[];

  return (
    <section className="mx-auto flex w-full flex-col items-center px-6 py-12 xs:py-20">
      <div className="w-full max-w-[1200px]">
        <Reveal className="mb-8 max-w-4xl mx-auto">
          <SectionHeading
            eyebrow="À propos"
            title={tidyTitle(t("About.Title") as string)}
            align="center"
          />
        </Reveal>

        <div className="w-full space-y-8 text-left">
          <Reveal className="rounded-[28px] border border-border/70 bg-gradient-to-br from-muted/60 via-background to-muted/20 p-6 shadow-sm sm:p-8">
            <ContextualLinksServer locale={locale}>
              {content}
            </ContextualLinksServer>
          </Reveal>

          <div className="mt-12 grid gap-5 md:grid-cols-2">
            <Reveal className="space-y-4 rounded-[28px] border border-border/70 bg-background p-6 shadow-sm sm:p-7">
              <h3 className="text-2xl font-semibold tracking-tight">
                {tidyTitle(t("About.Quality.Title") as string)}
              </h3>
              <ContextualLinksServer locale={locale}>
                {(t("About.Quality.Content") as unknown) as string}
              </ContextualLinksServer>
            </Reveal>

            <Reveal
              className="space-y-4 rounded-[28px] border border-border/70 bg-background p-6 shadow-sm sm:p-7"
              delay={0.08}
            >
              <h3 className="text-2xl font-semibold tracking-tight">
                {tidyTitle(t("About.Innovation.Title") as string)}
              </h3>
              <ContextualLinksServer locale={locale}>
                {(t("About.Innovation.Content") as unknown) as string}
              </ContextualLinksServer>
            </Reveal>
          </div>
        </div>
      </div>
    </section>
  );
}
