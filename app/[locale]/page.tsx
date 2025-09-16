import { type Metadata } from "next";
import { headers } from "next/headers";
import Hero from "@/app/[locale]/home/components/hero";
import Services from "@/app/[locale]/home/components/services";
import dynamic from "next/dynamic";
const FAQ = dynamic(() => import("@/app/[locale]/home/components/faq"), {
  ssr: false,
  loading: () => null,
});
const Contact = dynamic(() => import("@/src/components/ui/contact-form"), {
  ssr: false,
  loading: () => null,
});
const Testimonials = dynamic(() => import("@/src/components/ui/testimonials"), {
  ssr: false,
  loading: () => null,
});
import { generateMetadataForPage } from "@/src/lib/metadata";
import Defer from "@/src/components/Defer";
import StructuredData from "@/src/components/seo/StructuredData";
import {
  buildFAQPage,
  buildOrganizationAggregateRating,
} from "@/src/lib/structuredData";
import { getTranslations, type Locale } from "@/src/lib/i18n";

export async function generateMetadata({
  params: { locale },
}: {
  params: { locale: string };
}): Promise<Metadata> {
  return await generateMetadataForPage(locale as Locale, "/");
}

export default async function Home({ params }: { params: { locale: string } }) {
  const nonce = headers().get("x-nonce") || undefined;
  const locale = params.locale;
  const t = await getTranslations(locale as Locale, "contact");
  const localePrefix = locale ? `/${locale}` : "/fr";
  // Load FAQ texts for JSON-LD
  let faqModule: any;
  try {
    faqModule = await import(`@/src/translations/${locale}/faq.json`);
  } catch {
    faqModule = await import("@/src/translations/en/faq.json");
  }
  const faq = faqModule.default;

  const faqEntries = Array.from({ length: 12 })
    .map((_, i) => i + 1)
    .filter((i) => faq[`Question${i}`] && faq[`Answer${i}`])
    .map((i) => ({ question: faq[`Question${i}`], answer: faq[`Answer${i}`] }));
  const faqJsonLd = buildFAQPage(faqEntries, 8);

  // Reviews JSON-LD (derive from testimonials translations if available client side)
  // We'll inject a lightweight placeholder AggregateRating server-side; client can enhance if needed.
  const reviewsJsonLd = buildOrganizationAggregateRating({
    name: "Ark Fiduciaire",
    url: process.env.NEXT_PUBLIC_SITE_URL || "https://ark-fid.ch",
    ratingValue: "5.0",
    reviewCount: 6,
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
      <StructuredData nonce={nonce} data={[faqJsonLd, reviewsJsonLd]} />
      <section id="hero">
        <Hero locale={locale} />
      </section>
      <section id="services">
        <Services locale={locale} />
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
      {/* <section id="testimonials">
        <Testimonials locale={locale} />
      </section> */}
      <section id="contact">
        <Defer
          rootMargin="300px"
          idle={200}
          placeholder={<div className="h-64 w-full rounded-lg bg-muted/40" />}
        >
          <Contact strings={contactStrings} redirectPath={`${localePrefix}/`} />
        </Defer>
      </section>
    </div>
  );
}
