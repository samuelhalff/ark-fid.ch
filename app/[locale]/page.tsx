import { type Metadata } from "next";
import { headers } from "next/headers";
import Hero from "@/app/[locale]/home/components/hero";
import Services from "@/app/[locale]/home/components/services";
import FAQ from "@/app/[locale]/home/components/faq";
import Contact from "@/src/components/ui/contact-form";
import { generateMetadataForPage } from "@/src/lib/metadata";
import { type Locale } from "@/src/lib/i18n";

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
  // Load FAQ texts for JSON-LD
  let faqModule: any;
  try {
    faqModule = await import(`@/src/translations/${locale}/faq.json`);
  } catch {
    faqModule = await import("@/src/translations/en/faq.json");
  }
  const faq = faqModule.default;

  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: Array.from({ length: 12 })
      .map((_, i) => i + 1)
      .filter((i) => faq[`Question${i}`] && faq[`Answer${i}`])
      .map((i) => ({
        "@type": "Question",
        name: faq[`Question${i}`],
        acceptedAnswer: {
          "@type": "Answer",
          text: faq[`Answer${i}`],
        },
      })),
  } as const;

  return (
    <div className="max-w-[var(--breakpoint-xl)] mx-auto w-full pb-4 xs:py-20 md:px-6">
      <script
        type="application/ld+json"
        nonce={nonce}
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />
      <section id="hero">
        <Hero locale={locale} />
      </section>
      <section id="services">
        <Services locale={locale} />
      </section>
      <section id="faq">
        <FAQ />
      </section>
      {/* <section id="testimonials">
        <Testimonials />
      </section> */}
      <section id="contact">
        <Contact />
      </section>
    </div>
  );
}
