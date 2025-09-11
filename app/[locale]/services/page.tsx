import React from "react";
import { headers } from "next/headers";
import Service from "@/app/[locale]/home/components/services";
import ContactForm from "@/src/components/ui/contact-form";
import StructuredData from "@/src/components/seo/StructuredData";
import { buildBreadcrumbList, buildFAQPage } from "@/src/lib/structuredData";

export default async function ServicesPage({
  params,
}: {
  params: { locale: string };
}) {
  const nonce = headers().get("x-nonce") || undefined;
  const locale = params.locale;

  // Load FAQ translations
  let faqModule: any;
  try {
    faqModule = await import(`@/src/translations/${locale}/faq.json`);
  } catch {
    faqModule = await import("@/src/translations/en/faq.json");
  }
  const faq = faqModule.default;

  // Build FAQ entries 6..12 to avoid duplicating the home page set (1..5)
  const faqEntries = Array.from({ length: 12 })
    .map((_, i) => i + 1)
    .filter((i) => i >= 6 && faq[`Question${i}`] && faq[`Answer${i}`])
    .map((i) => ({ question: faq[`Question${i}`], answer: faq[`Answer${i}`] }));
  const faqJsonLd = buildFAQPage(faqEntries, 5);

  // BreadcrumbList for /services with absolute URL
  const baseUrl = "https://ark-fid.ch";
  const localePrefix = locale ? `/${locale}` : "";
  const breadcrumbJsonLd = buildBreadcrumbList([
    { name: "Services", item: `${baseUrl}${localePrefix}/services/` },
  ]);

  return (
    <main
      className="max-w-[var(--breakpoint-xl)] mx-auto w-full pb-4 xs:py-20 md:px-6"
      role="main"
    >
      <StructuredData nonce={nonce} data={[breadcrumbJsonLd, faqJsonLd]} />
      <Service showSubtitle={true} />
      <ContactForm />
    </main>
  );
}
