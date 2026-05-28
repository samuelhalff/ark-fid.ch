import dynamic from "next/dynamic";
import { getTranslations, getCurrentLocale, type Locale } from "@/src/lib/i18n";
import { tidyTitle } from "@/src/lib/typography";
import GoogleReviewsBadge from "@/src/components/ui/google-reviews-badge";
import SectionHeading from "@/src/components/site/section-heading";
import Reveal from "@/src/components/motion/reveal";

// Dynamic import to avoid blocking first paint
const TestimonialsCarousel = dynamic(() => import("./testimonials-carousel"), {
  loading: () => (
    <div className="w-full overflow-hidden relative">
      <div className="flex gap-6">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="shrink-0 w-[350px] sm:w-[420px] lg:w-[480px] h-[180px] bg-muted/30 rounded-xl animate-pulse"
          />
        ))}
      </div>
    </div>
  ),
});

interface Testimonial {
  name?: string;
  company?: string;
  service?: string;
  testimonial: string;
  rating?: number;
}

// Helper function to get the effective rating (default to 5 for named reviews without explicit rating)
function getEffectiveRating(testimonial: Testimonial): number {
  return testimonial.rating ?? 5;
}

// Generate JSON-LD structured data for SEO
function generateReviewsStructuredData(
  testimonials: Testimonial[],
  anonymousLabel: string
) {
  const reviews = testimonials.map((testimonial) => ({
    "@type": "Review",
    reviewBody: testimonial.testimonial,
    author: {
      "@type": "Person",
      name: testimonial.name || anonymousLabel,
    },
    reviewRating: {
      "@type": "Rating",
      ratingValue: getEffectiveRating(testimonial),
      bestRating: 5,
      worstRating: 1,
    },
    ...(testimonial.service && {
      about: testimonial.service,
    }),
  }));

  // Calculate aggregate rating from ALL reviews (default to 5 stars for reviews without explicit rating)
  const avgRating =
    testimonials.length > 0
      ? testimonials.reduce((sum, t) => sum + getEffectiveRating(t), 0) /
        testimonials.length
      : null;

  return {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name: "Ark Fiduciaire SA",
    address: {
      "@type": "PostalAddress",
      streetAddress: "26 Boulevard Georges Favon",
      addressLocality: "Genève",
      postalCode: "1204",
      addressCountry: "CH",
    },
    ...(avgRating && {
      aggregateRating: {
        "@type": "AggregateRating",
        ratingValue: Number(avgRating.toFixed(1)),
        reviewCount: testimonials.length,
        bestRating: 5,
        worstRating: 1,
      },
    }),
    review: reviews,
  };
}

export default async function Testimonials() {
  const locale: Locale = await getCurrentLocale();
  const t = await getTranslations(locale, "testimonials");

  const eyebrow = (t("Eyebrow") as string) || "Client reviews";
  const title = (t("SectionTitle") as string) || "Testimonials";
  const subtitle = (t("Subtitle") as string) || "";
  const ratingBadge =
    (t("RatingBadge") as string) || "Rated 5 stars by clients";
  const testimonials: Testimonial[] = (t("List") as Testimonial[]) || [];
  const anonymousLabel = (t("Anonymous") as string) || "Anonymous";

  const structuredData = generateReviewsStructuredData(
    testimonials,
    anonymousLabel
  );

  return (
    <section
      id="testimonials"
      className="w-full py-12 xs:py-20 mb-10"
      aria-labelledby="testimonials-heading"
    >
      {/* JSON-LD Structured Data for SEO */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />

      <div className="mx-auto max-w-[1240px] px-5 sm:px-8">
        {/* Rating badge */}
        <Reveal className="flex justify-center mb-4">
          <div className="inline-flex items-center gap-2 rounded-full bg-surface-warm px-3 py-1.5 text-sm text-muted-foreground shadow-sm">
            <svg
              className="w-4 h-4 text-amber-500"
              viewBox="0 0 24 24"
              fill="currentColor"
              aria-hidden="true"
            >
              <path d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            <span>{ratingBadge}</span>
          </div>
        </Reveal>

        <Reveal className="mb-12 max-w-4xl mx-auto" delay={0.04}>
          <SectionHeading
            eyebrow={eyebrow}
            title={tidyTitle(title)}
            description={subtitle}
          />
        </Reveal>
      </div>

      <Reveal delay={0.08}>
        <TestimonialsCarousel
          testimonials={testimonials}
          anonymousLabel={anonymousLabel}
        />
      </Reveal>

      {/* Google Reviews badge — social proof */}
      <Reveal className="flex justify-center mt-8" delay={0.1}>
        <GoogleReviewsBadge locale={locale} />
      </Reveal>
    </section>
  );
}
