import { getTranslations, type Locale } from "@/src/lib/i18n";
import { tidyTitle } from "@/src/lib/typography";

type Case = { Situation?: string; WhatWeDo?: string };

const text = (value: unknown, key: string): string =>
  typeof value === "string" && value && value !== key ? value : "";

/**
 * Fictional, simplified "typical situations" for a service page.
 * Reads `TypicalSituations.Cases` (and optional `PriceNote`) from the service
 * namespace, and shared labels from `services:TypicalSituations`.
 * Returns null when the block is absent in the active locale.
 */
const ServiceTypicalSituations = async ({
  locale,
  ns,
}: {
  locale: string;
  ns: string;
}) => {
  const activeLocale = (locale as Locale) || ("fr" as Locale);
  const tService = await getTranslations(activeLocale, ns);
  const rawCases = tService("TypicalSituations.Cases") as unknown;
  const cases = (Array.isArray(rawCases) ? (rawCases as Case[]) : []).filter(
    (c) => c && c.Situation && c.WhatWeDo,
  );
  if (cases.length === 0) return null;

  const tShared = await getTranslations(activeLocale, "services");
  const title = text(tShared("TypicalSituations.Title"), "TypicalSituations.Title");
  if (!title) return null;
  const disclaimer = text(
    tShared("TypicalSituations.Disclaimer"),
    "TypicalSituations.Disclaimer",
  );
  const situationLabel = text(
    tShared("TypicalSituations.SituationLabel"),
    "TypicalSituations.SituationLabel",
  );
  const whatWeDoLabel = text(
    tShared("TypicalSituations.WhatWeDoLabel"),
    "TypicalSituations.WhatWeDoLabel",
  );
  const priceNote = text(
    tService("TypicalSituations.PriceNote"),
    "TypicalSituations.PriceNote",
  );

  const colon = activeLocale === "fr" ? " : " : ": ";

  return (
    <section className="max-w-3xl space-y-4">
      <h3 className="text-xl xs:text-2xl md:text-2xl font-bold tracking-tight">
        {tidyTitle(title)}
      </h3>
      {disclaimer ? (
        <p className="text-sm italic text-muted-foreground">{disclaimer}</p>
      ) : null}
      <div className="grid gap-4 md:grid-cols-2">
        {cases.map((item, index) => (
          <div
            key={index}
            className="rounded-lg bg-muted/40 px-6 py-4 space-y-3 text-base leading-7"
          >
            <p>
              {situationLabel ? (
                <span className="font-semibold text-foreground">
                  {situationLabel}
                  {colon}
                </span>
              ) : null}
              <span className="text-muted-foreground">{item.Situation}</span>
            </p>
            <p>
              {whatWeDoLabel ? (
                <span className="font-semibold text-foreground">
                  {whatWeDoLabel}
                  {colon}
                </span>
              ) : null}
              <span className="text-muted-foreground">{item.WhatWeDo}</span>
            </p>
          </div>
        ))}
      </div>
      {priceNote ? (
        <p className="text-sm font-medium text-foreground">{priceNote}</p>
      ) : null}
    </section>
  );
};

export default ServiceTypicalSituations;
