import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import TaxQuestionnaire from "@/src/components/tax-questionnaire/TaxQuestionnaire";
import { QF_LOCALES, type QfLocale } from "@/src/lib/tax-questionnaire/types";
import { UI } from "@/src/lib/tax-questionnaire/ui";

/**
 * Tax questionnaire: served at /<locale>/questionnaire-fiscal/ on ark-fid.ch and at
 * https://tax.ark-fid.ch/<locale>/ (middleware rewrite). Transactional page for clients:
 * noindex, not in the sitemap; canonical = the main-site URL (always reachable).
 */
export const dynamic = "force-dynamic";

const asLocale = (value: string): QfLocale | null => ((QF_LOCALES as readonly string[]).includes(value) ? (value as QfLocale) : null);

export async function generateMetadata(props: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await props.params;
  const l = asLocale(locale) || "en";
  return {
    title: `${UI.pageTitle[l]} – Ark Fiduciaire`,
    description: UI.pageIntro[l],
    robots: { index: false, follow: false, googleBot: { index: false, follow: false } },
    alternates: { canonical: `https://ark-fid.ch/${l}/questionnaire-fiscal/` },
  };
}

export default async function TaxQuestionnairePage(props: { params: Promise<{ locale: string }> }) {
  const { locale } = await props.params;
  const l = asLocale(locale);
  // The questionnaire exists in fr/en/de; other site languages get the English version.
  if (!l) redirect("/en/questionnaire-fiscal/");
  const mode = (await headers()).get("x-tax-host") === "1" ? "tax" : "main";
  return (
    <div className="mx-auto w-full max-w-[1240px] px-5 py-8 sm:px-8 sm:py-10">
      <TaxQuestionnaire locale={l} mode={mode} />
    </div>
  );
}
