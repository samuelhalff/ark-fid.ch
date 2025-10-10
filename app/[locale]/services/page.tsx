import React from "react";
import { headers } from "next/headers";
import { Metadata } from "next";
import Service from "@/app/[locale]/home/components/services";
import ContactForm from "@/src/components/ui/contact-form";
import StructuredData from "@/src/components/seo/StructuredData";
import { buildBreadcrumbList, buildFAQPage } from "@/src/lib/structuredData";
import { getTranslations, type Locale } from "@/src/lib/i18n";
import { generateMetadataForPage } from "@/src/lib/metadata";

export async function generateMetadata({
  params: { locale },
}: {
  params: { locale: string };
}): Promise<Metadata> {
  return await generateMetadataForPage(locale as Locale, "/services");
}

export default async function ServicesPage({
  params,
}: {
  params: { locale: string };
}) {
  const nonce = headers().get("x-nonce") || undefined;
  const locale = params.locale as Locale;
  const tHome = await getTranslations(locale, "home");
  const tNav = await getTranslations(locale, "navbar");

  // Load FAQ translations
  let faqModule: { default: Record<string, string> };
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
  const localePrefix = locale ? `/${locale}` : "/fr";
  const breadcrumbJsonLd = buildBreadcrumbList([
    {
      name: (tHome("Services.Title") as string) || "Services",
      item: `${baseUrl}${localePrefix}/services/`,
    },
  ]);

  const t = await getTranslations(locale, "contact");
  const contactStrings = {
    title: (t("Title") as string) || "Get in Touch",
    subtitle: (t("Subtitle") as string) || "",
    labels: {
      name: (t("Form.Name") as string) || "Name",
      companyName:
        (t("Form.CompanyName") as string) || "Company Name (Optional)",
      phone: (t("Form.Phone") as string) || "Phone Number (Optional)",
      email: (t("Form.Email") as string) || "Email",
      message: (t("Form.Message") as string) || "Message",
      consent: (t("Form.Consent") as string) || "I consent to being contacted",
      submit: (t("Form.Submit") as string) || "Submit",
      sending: (t("Form.Sending") as string) || "Sending...",
    },
    placeholders: {
      name: (t("Form.Placeholders.Name") as string) || "Your name",
      companyName:
        (t("Form.Placeholders.CompanyName") as string) || "Company name",
      phone: (t("Form.Placeholders.Phone") as string) || "Phone number",
      email: (t("Form.Placeholders.Email") as string) || "email@example.com",
      message: (t("Form.Placeholders.Message") as string) || "How can we help?",
    },
    errors: {
      required: (t("Errors.Required") as string) || "This field is required",
      invalidEmail:
        (t("Errors.InvalidEmail") as string) || "Invalid email address",
      maxLength: (t("Errors.MaxLength") as string) || "Message is too long",
      consent: (t("Errors.Consent") as string) || "Please provide consent",
    },
    toasts: {
      success:
        (t("Form.Success") as string) || "Thanks! We'll get back to you soon.",
      error: (t("Form.Error") as string) || "Something went wrong.",
    },
  } as const;

  return (
    <main
      className="max-w-[var(--breakpoint-xl)] mx-auto w-full pt-10 md:pt-14 pb-12 md:px-6"
      role="main"
    >
      <StructuredData nonce={nonce} data={[breadcrumbJsonLd, faqJsonLd]} />
      <header className="px-6">
        <h1 className="text-3xl xs:text-4xl md:text-5xl md:leading-14 font-bold tracking-tight max-w-4xl mx-auto text-center mb-4">
          {(tHome("Services.Title") as string) || "Services"}
        </h1>
        <nav aria-label="Breadcrumb" className="px-6 md:px-0 mt-2 mb-6">
          <ol className="flex items-center gap-1 text-sm text-muted-foreground justify-center">
            <li>
              <a href={`${localePrefix}/`} className="hover:underline">
                {(tNav("Home") as string) || "Home"}
              </a>
            </li>
            <li className="flex items-center gap-1">
              <span className="text-muted-foreground/60">/</span>
              <span aria-current="page" className="font-medium text-foreground">
                {(tHome("Services.Title") as string) || "Services"}
              </span>
            </li>
          </ol>
        </nav>
      </header>
      <Service showSubtitle={true} showHeading={false} locale={locale} />
      <div className="max-w-[var(--breakpoint-xl)] mx-auto px-6 mt-8 text-sm text-muted-foreground">
        <p>
          {locale === "fr"
            ? "Ressources utiles : "
            : locale === "de"
            ? "Nützliche Ressourcen: "
            : locale === "es"
            ? "Recursos útiles: "
            : locale === "pt"
            ? "Recursos úteis: "
            : "Useful resources: "}
          <a
            className="underline hover:no-underline"
            href={`${localePrefix}/ressources/`}
          >
            {locale === "fr"
              ? "articles et guides"
              : locale === "de"
              ? "Artikel & Leitfäden"
              : locale === "es"
              ? "artículos y guías"
              : locale === "pt"
              ? "artigos e guias"
              : "articles & guides"}
          </a>
          {" · "}
          <a
            className="underline hover:no-underline"
            href={`${localePrefix}/contact`}
          >
            {locale === "fr"
              ? "nous contacter"
              : locale === "de"
              ? "Kontakt"
              : locale === "es"
              ? "contacto"
              : locale === "pt"
              ? "contacto"
              : "contact"}
          </a>
        </p>
      </div>
      <ContactForm strings={contactStrings} redirectPath={`${localePrefix}/`} />
    </main>
  );
}
