import { type Metadata } from "next";
import { headers } from "next/headers";
import Hero from "@/app/[locale]/home/components/hero";
import ContactForm from "@/src/components/ui/contact-form";
import Services from "@/app/[locale]/home/components/services";
import About from "@/app/[locale]/home/components/about";
import FAQ from "@/app/[locale]/home/components/faq";
import Testimonials from "@/app/[locale]/home/components/testimonials";
import { generateMetadataForPage } from "@/src/lib/metadata";
import Defer from "@/src/components/Defer";
import StructuredData from "@/src/components/seo/StructuredData";
import { buildFAQPage, buildLocalBusiness } from "@/src/lib/structuredData";
import { getTranslations, isValidLocale, type Locale } from "@/src/lib/i18n";
import type { FAQEntry } from "@/src/lib/structuredData";
import { CtaBanner } from "@/src/components/ui/surface";

export async function generateMetadata(
  props: {
    params: Promise<{ locale: string }>;
  }
): Promise<Metadata> {
  const params = await props.params;

  const {
    locale
  } = params;

  const activeLocale = isValidLocale(locale) ? locale : "fr";
  return await generateMetadataForPage(activeLocale, "/");
}

// Redeploy happens every 48h, so cache the page until next deployment window
export const revalidate = 172800; // 48 hours

export default async function Home(props: { params: Promise<{ locale: string }> }) {
  const params = await props.params;
  const nonce = (await headers()).get("x-nonce") || undefined;
  const requestedLocale = params.locale;
  const activeLocale = isValidLocale(requestedLocale) ? requestedLocale : "fr";
  const t = await getTranslations(activeLocale, "contact");
  const homeT = await getTranslations(activeLocale, "home");
  const agentT = await getTranslations(activeLocale, "agent");
  const heroTranslations = {
    "Hero.Title": homeT("Hero.Title"),
    "Hero.Description": homeT("Hero.Description"),
    "Hero.CTA": homeT("Hero.CTA"),
    "Hero.SecondaryCTA": homeT("Hero.SecondaryCTA"),
    "Hero.ImageAlt": homeT("Hero.ImageAlt"),
    "Hero.OdooPartnerBadge": homeT("Hero.OdooPartnerBadge"),
    "Hero.OdooBadge": homeT("Hero.OdooBadge"),
    "Hero.ScrollHint": homeT("Hero.ScrollHint"),
  };
  const localePrefix = `/${activeLocale}`;
  // Load FAQ texts for JSON-LD
  const loadFaq = async (locale: Locale) => {
    try {
      const faqModule: { default: Record<string, string> } = await import(
        `@/src/translations/${locale}/faq.json`
      );
      return faqModule.default;
    } catch {
      const fallbackModule: { default: Record<string, string> } = await import(
        "@/src/translations/en/faq.json"
      );
      return fallbackModule.default;
    }
  };
  const faq = await loadFaq(activeLocale);

  const faqEntries: FAQEntry[] = Array.from({ length: 12 })
    .map((_, i) => i + 1)
    .filter((i) => faq[`Question${i}`] && faq[`Answer${i}`])
    .map((i) => ({ question: faq[`Question${i}`], answer: faq[`Answer${i}`] }));
  const faqJsonLd = buildFAQPage(faqEntries, 8);

  // Choose a stable hero image index per request to avoid hydration mismatch
  const indexSeed = (nonce || `${Date.now()}`)
    .split("")
    .reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  const heroIndex = indexSeed % 9; // there are 9 service hero images

  // LocalBusiness schema for home page
  const localBusinessJsonLd = buildLocalBusiness({
    name: "Ark Fiduciaire SA",
    description: homeT("Hero.Description"),
    url: "https://ark-fid.ch",
    logo: "https://ark-fid.ch/assets/arkfid--color.svg",
    telephone: "+41225125050",
    email: "info@ark-fid.ch",
    address: {
      streetAddress: "26 Boulevard Georges Favon",
      postalCode: "1204",
      addressLocality: "Genève",
      addressCountry: "CH",
    },
    geo: {
      latitude: 46.2021,
      longitude: 6.1419,
    },
    openingHours: ["Mo-Fr 09:00-18:00"],
    areaServed: ["Geneva", "Switzerland", "Genève", "Suisse"],
    sameAs: [
      "https://www.linkedin.com/company/ark-fiduciaire/",
      "https://maps.google.com/?cid=14946625157719331801",
    ],
  });

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

  const trustItems = [
    {
      title: homeT("Trust.Sofit.Title") as string,
      description: homeT("Trust.Sofit.Description") as string,
      featured: true,
    },
    {
      title: homeT("Trust.Odoo.Title") as string,
      description: homeT("Trust.Odoo.Description") as string,
    },
    {
      title: homeT("Trust.Gaap.Title") as string,
      description: homeT("Trust.Gaap.Description") as string,
    },
  ];

  return (
    <div className="mx-auto w-full pb-4">
      <StructuredData nonce={nonce} data={[faqJsonLd, localBusinessJsonLd]} />
      <section id="hero">
        <Hero
          locale={activeLocale}
          heroIndex={heroIndex}
          translations={heroTranslations}
        />
      </section>
      <section
        id="affiliations"
        className="mx-auto w-full max-w-[1240px] px-5 pb-8 sm:px-8"
        aria-labelledby="affiliations-title"
      >
        <div className="grid gap-2.5 rounded-[24px] bg-surface-warm p-3 text-center shadow-sm dark:bg-card sm:grid-cols-[0.85fr_repeat(3,1fr)] sm:p-4 sm:text-left">
          <div className="flex items-center justify-center rounded-2xl bg-background/70 px-4 py-3 text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-muted-foreground dark:bg-background/10 sm:justify-start">
            <span id="affiliations-title">
              {homeT("Trust.Eyebrow") as string}
            </span>
          </div>
          {trustItems.map((item) => (
            <article
              key={item.title}
              className={`rounded-2xl px-4 py-3 ${
                item.featured
                  ? "bg-foreground text-background dark:bg-background dark:text-foreground"
                  : "bg-background/70 text-foreground dark:bg-background/10"
              }`}
            >
              <h2 className="text-base font-semibold tracking-tight">
                {item.title}
              </h2>
              <p
                className={`mt-1.5 text-sm leading-6 ${
                  item.featured
                    ? "text-background/76 dark:text-foreground/76"
                    : "text-muted-foreground"
                }`}
              >
                {item.description}
              </p>
            </article>
          ))}
        </div>
      </section>
      <section id="services">
        <Services locale={activeLocale} />
      </section>
      <section
        id="instant-quote"
        className="mx-auto w-full max-w-[900px] px-5 py-10 sm:px-8"
      >
        <CtaBanner
          variant="warm"
          className="rounded-[28px] p-6 sm:p-8"
          eyebrow={agentT("Title") as string}
          title={agentT("Lead.Title") as string}
          description={`${agentT("Subtitle") as string} ${
            agentT("Intro") as string
          }`}
          icon={
            <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-foreground text-background">
              <svg
                viewBox="0 0 24 24"
                className="size-4"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M13 2 3 14h8l-1 8 10-12h-8l1-8Z" />
              </svg>
            </span>
          }
          primary={{
            href: `${localePrefix}/agent/`,
            label: agentT("Lead.Button") as string,
          }}
        />
      </section>
      <section id="about">
        <Defer
          rootMargin="300px"
          idle={200}
          placeholder={<div className="h-40 w-full rounded-lg bg-muted/40" />}
        >
          <About />
        </Defer>
      </section>
      <section id="faq">
        <Defer
          rootMargin="300px"
          idle={200}
          placeholder={<div className="h-40 w-full rounded-lg bg-muted/40" />}
        >
          <FAQ />
        </Defer>
      </section>
      <section id="testimonials">
        <Defer
          rootMargin="400px"
          idle={300}
          placeholder={<div className="h-64 w-full rounded-lg bg-muted/40" />}
        >
          <Testimonials />
        </Defer>
      </section>
      <section id="contact" className="px-5 py-10 sm:px-8">
        <Defer
          rootMargin="300px"
          idle={200}
          placeholder={<div className="h-64 w-full rounded-lg bg-muted/40" />}
        >
          <ContactForm strings={contactStrings} redirectPath={`${localePrefix}/`} />
        </Defer>
      </section>
    </div>
  );
}
