import { type Metadata } from "next";
import { headers } from "next/headers";
import Hero from "@/app/[locale]/home/components/hero";
import ContactForm from "@/src/components/ui/contact-form";
import Services from "@/app/[locale]/home/components/services";
import About from "@/app/[locale]/home/components/about";
import FAQ from "@/app/[locale]/home/components/faq";
import Testimonials from "@/app/[locale]/home/components/testimonials";
import Link from "next/link";
import { Button } from "@/src/components/ui/button";
import { Card, CardContent } from "@/src/components/ui/card";
import { generateMetadataForPage } from "@/src/lib/metadata";
import Defer from "@/src/components/Defer";
import StructuredData from "@/src/components/seo/StructuredData";
import { buildFAQPage, buildLocalBusiness } from "@/src/lib/structuredData";
import { getTranslations, isValidLocale, type Locale } from "@/src/lib/i18n";
import type { FAQEntry } from "@/src/lib/structuredData";

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
    "Hero.Badge": homeT("Hero.Badge"),
    "Hero.Title": homeT("Hero.Title"),
    "Hero.Description": homeT("Hero.Description"),
    "Hero.CTA": homeT("Hero.CTA"),
    "Hero.SecondaryCTA": homeT("Hero.SecondaryCTA"),
    "Hero.ImageAlt": homeT("Hero.ImageAlt"),
    "Hero.OdooPartnerBadge": homeT("Hero.OdooPartnerBadge"),
    "Hero.OdooBadge": homeT("Hero.OdooBadge"),
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
      "https://maps.google.com/?cid=11595836239142935457",
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

  return (
    <div className="max-w-[var(--breakpoint-xl)] mx-auto w-full pb-4 xs:py-20 md:px-6">
      <StructuredData nonce={nonce} data={[faqJsonLd, localBusinessJsonLd]} />
      <section id="hero">
        <Hero
          locale={activeLocale}
          heroIndex={heroIndex}
          translations={heroTranslations}
        />
      </section>
      <section id="services">
        <Services locale={activeLocale} />
      </section>
      <section id="instant-quote" className="px-6 md:px-0">
        <Card className="mt-10 border-border/60 bg-muted/20">
          <CardContent className="flex flex-col gap-6 p-6 md:p-8 md:flex-row md:items-center md:justify-between">
            <div className="space-y-2">
              <h2 className="text-2xl font-semibold">
                {agentT("Title") as string}
              </h2>
              <p className="text-muted-foreground">
                {agentT("Subtitle") as string}
              </p>
              <p className="text-sm text-muted-foreground">
                {agentT("Intro") as string}
              </p>
            </div>
            <Button asChild>
              <Link href={`${localePrefix}/agent/`} prefetch={false}>
                {agentT("Lead.Button") as string}
              </Link>
            </Button>
          </CardContent>
        </Card>
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
      <section id="contact">
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
