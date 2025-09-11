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
      }))
      .slice(0, 5),
  } as const;

  // Reviews JSON-LD (derive from testimonials translations if available client side)
  // We'll inject a lightweight placeholder AggregateRating server-side; client can enhance if needed.
  const reviewsJsonLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "Ark Fiduciaire",
    url: process.env.NEXT_PUBLIC_SITE_URL || "https://ark-fid.ch",
    aggregateRating: {
      "@type": "AggregateRating",
      ratingValue: "5.0",
      reviewCount: 6,
    },
  } as const;

  return (
    <div className="max-w-[var(--breakpoint-xl)] mx-auto w-full pb-4 xs:py-20 md:px-6">
      <script
        type="application/ld+json"
        nonce={nonce}
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />
      <script
        type="application/ld+json"
        nonce={nonce}
        dangerouslySetInnerHTML={{ __html: JSON.stringify(reviewsJsonLd) }}
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
      <section id="testimonials">
        <Testimonials locale={locale} />
      </section>
      <section id="contact">
        <Contact />
      </section>
    </div>
  );
}
