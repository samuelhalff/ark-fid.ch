// Server component: no client hooks, translations provided by server
import { Button } from "@/src/components/ui/button";
import Link from "next/link";
import TrackedLink from "@/src/components/ui/tracked-link";
// import { useTranslation } from "react-i18next";
// import "@/src/i18n";
import { splitTitle } from "@/src/lib/typography";
import GoogleRating from "@/src/components/ui/google-rating";

interface HeroFact {
  label: string;
  value: string;
  sub: string;
}

interface HeroProps {
  locale?: string;
  heroIndex?: number; // kept for caller compatibility
  translations?: Record<string, string>; // server-provided translations to avoid hydration mismatch
  facts?: HeroFact[];
}

const Hero = ({ locale, heroIndex, translations, facts }: HeroProps) => {
  const currentLocale = (locale || "fr") as string;
  // const { t } = useTranslation("home");
  const t = (key: string) => translations?.[key] || key; // fallback to key if translation missing
  const localePrefix = currentLocale ? `/${currentLocale}` : "/fr";

  const rawTitle = t("Hero.Title") as string;
  const { title, subtitle } = splitTitle(rawTitle);
  // First sentence stays above the CTAs; any further sentences follow them.
  const rawIntro = t("Hero.Description") as string;
  const sentenceEnd = rawIntro.search(/[.!?](\s+)(?=\S)/);
  const intro = sentenceEnd === -1 ? rawIntro : rawIntro.slice(0, sentenceEnd + 1);
  const introRest = sentenceEnd === -1 ? "" : rawIntro.slice(sentenceEnd + 1).trim();

  return (
    <section className="relative w-full bg-background px-5 pb-10 pt-4 sm:px-8 sm:pb-16 sm:pt-16 lg:pt-20">
      <div className="mx-auto w-full max-w-[1240px]">
        {/* No Reveal here: hiding the hero after hydration and fading it back
            in pushed the mobile LCP to about 8 s. */}
        <div className="max-w-5xl">
          <h1 className="max-w-[14ch] text-balance text-[1.875rem] font-semibold leading-[1.02] min-[400px]:text-5xl tracking-tight text-foreground sm:text-6xl md:text-7xl lg:text-8xl">
            {title}
            {subtitle ? (
              <>
                <br />
                <span className="text-brand-hover dark:text-brand">
                  {subtitle}
                </span>
              </>
            ) : null}
          </h1>

          <p className="mt-3 max-w-[56ch] text-sm leading-6 text-muted-foreground sm:mt-8 sm:text-xl sm:leading-8">
            {intro}
          </p>

          <div className="mt-4 flex w-full flex-col sm:mt-10 items-stretch gap-2 sm:gap-3 sm:w-auto sm:flex-row sm:items-center">
            <TrackedLink
              cta="home_hero_agent"
              href={`${localePrefix}/agent/`}
              className="w-full sm:w-auto"
              locale={locale}
              prefetch={false}
            >
              <Button
                size="lg"
                variant="brand"
                className="btn-main-cta w-full rounded-full px-6 text-base transition-colors sm:w-auto"
              >
                <span>{t("Hero.SecondaryCTA")}</span>
              </Button>
            </TrackedLink>
            <Link
              href={`${localePrefix}/contact/`}
              className="w-full sm:w-auto"
              locale={locale}
            >
              <Button
                size="lg"
                variant="secondary"
                className="btn-secondary-cta w-full rounded-full px-6 text-base sm:w-auto"
              >
                <span>{t("Hero.CTA")}</span>
              </Button>
            </Link>
          </div>

          {introRest ? (
            <p className="mt-5 max-w-[56ch] text-sm leading-6 text-muted-foreground sm:text-lg">
              {introRest}
            </p>
          ) : null}

          <GoogleRating locale={currentLocale} className="mt-6" />

          {facts && facts.length > 0 && (
            <div className="mt-8 border-t border-border/50 pt-6 grid grid-cols-1 gap-8 sm:mt-16 sm:pt-10 sm:grid-cols-3 sm:gap-10">
              {facts.map((fact) => (
                <div key={fact.label} className="flex flex-col gap-2">
                  <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground/60">
                    {fact.label}
                  </p>
                  <p className="text-[28px] font-semibold leading-none tracking-[-0.025em] text-foreground sm:text-[32px]">
                    {fact.value}
                  </p>
                  <p className="text-[13.5px] leading-[1.55] text-muted-foreground">
                    {fact.sub}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
};
export default Hero;
