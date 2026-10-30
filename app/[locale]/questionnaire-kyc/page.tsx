import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import KycQuestionnaire from "@/src/components/kyc-questionnaire/KycQuestionnaire";
import { KYC_LOCALES, type KycLocale } from "@/src/lib/kyc-questionnaire/types";
import { UI } from "@/src/lib/kyc-questionnaire/ui";

/**
 * KYC form: served at /<locale>/questionnaire-kyc/ on ark-fid.ch and at
 * https://kyc.ark-fid.ch/<fr|en>/ (middleware rewrite), opened from the link Ark sends.
 * Transactional page for clients: noindex, not in the sitemap.
 */
export const dynamic = "force-dynamic";

const asLocale = (value: string): KycLocale | null => ((KYC_LOCALES as readonly string[]).includes(value) ? (value as KycLocale) : null);

export async function generateMetadata(props: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await props.params;
  const l = asLocale(locale) || "en";
  return {
    title: `${UI.pageTitle[l]} – Ark Fiduciaire`,
    description: UI.pageIntro[l],
    robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
    alternates: { canonical: `https://ark-fid.ch/${l}/questionnaire-kyc/` },
  };
}

export default async function KycQuestionnairePage(props: { params: Promise<{ locale: string }> }) {
  const { locale } = await props.params;
  const l = asLocale(locale);
  // The form exists in fr/en; other site languages get the English version (the #acces= fragment
  // survives the redirect).
  if (!l) redirect("/en/questionnaire-kyc/");
  // In production the form only works on kyc.ark-fid.ch (host-only session cookie, API origin):
  // the browser keeps the #acces= fragment across the redirect.
  const host = ((await headers()).get("host") || "").split(":")[0].toLowerCase();
  if (process.env.NODE_ENV === "production" && host !== "kyc.ark-fid.ch") redirect(`https://kyc.ark-fid.ch/${l}/`);
  return (
    <div className="mx-auto w-full max-w-[1240px] px-5 py-8 sm:px-8 sm:py-10">
      <KycQuestionnaire locale={l} />
    </div>
  );
}
