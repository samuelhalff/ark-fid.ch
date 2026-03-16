import dynamic from "next/dynamic";
import { getTranslations, getCurrentLocale, type Locale } from "@/src/lib/i18n";
import { tidyTitle } from "@/src/lib/typography";
import GoogleReviewsBadge from "@/src/components/ui/google-reviews-badge";

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

  const title = (t("SectionTitle") as string) || "Testimonials";
  const subtitle = (t("Subtitle") as string) || "";
  const ratingBadge =
    (t("RatingBadge") as string) || "Rated 5 stars by clients";
  const testimonials: Testimonial[] = [
    {
      name: "Julien Roques",
      company: "Florissant 1928 Sàrl",
      service: "Odoo & ERP",
      testimonial:
        "Ark s'est montrée très disponible et nous a permis en quelques jours de mettre en place notre comptabilité sur Odoo.",
    },
    {
      name: "Antoine Fortis",
      company: "Pargo Sàrl",
      service: "Comptabilité",
      testimonial:
        "Je souhaitais être autonome tout en ayant un support ponctuel pour ma comptabilité et mes salaires; chez Ark j'ai pu compter sur une équipe compétente et dynamique.",
    },
    {
      name: "Armands Bush",
      company: "Austrenis Capital SA",
      service: "Comptabilité",
      testimonial:
        "Nous nous reposons sur Ark pour l'ensemble de notre comptabilité, salaires et notre fiscalité. L'équipe de Ark est toujours disponible et réactive. Nous pouvons nous concentrer pleinement sur notre activité et être confiants que ces tâches sont gérées parfaitement.",
    },
    {
      name: "Pierre Saouter",
      company: "Principles Analytics Sàrl",
      service: "Comptabilité & Fiscalité",
      testimonial:
        "Ark gère notre comptabilité et nos affaires fiscales avec un professionnalisme remarquable. Leur expertise nous donne une tranquillité d'esprit totale, nous permettant de nous concentrer entièrement sur le développement de notre activité.",
    },
    {
      service: "Comptabilité",
      testimonial:
        "Notre comptabilité est désormais parfaitement structurée grâce à Ark. Les clôtures mensuelles sont livrées dans les délais et la qualité des rapports nous permet de prendre des décisions éclairées.",
    },
    {
      service: "Salaires & RH",
      testimonial:
        "La gestion de notre paie est devenue un jeu d'enfant. Fiches de salaire précises, déclarations sociales conformes, et un support toujours disponible pour répondre à nos questions.",
    },
    {
      service: "Fiscalité",
      testimonial:
        "Grâce à leur expertise fiscale, nous avons optimisé notre situation tout en restant parfaitement conformes. Un accompagnement professionnel et rassurant.",
    },
    {
      service: "Fusions & Acquisitions",
      testimonial:
        "L'équipe nous a accompagnés tout au long de notre acquisition. Due diligence rigoureuse, valorisation précise et conseils stratégiques qui ont fait la différence.",
    },
    {
      service: "Family Office",
      testimonial:
        "Une approche sur mesure pour la gestion de notre patrimoine familial. Discrétion, expertise et un suivi personnalisé qui répond à toutes nos attentes.",
    },
    {
      service: "Odoo & ERP",
      testimonial:
        "L'implémentation d'Odoo a transformé notre façon de travailler. Processus automatisés, données centralisées et une visibilité en temps réel sur notre activité.",
    },
  ];
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

      <div className="max-w-[var(--breakpoint-xl)] mx-auto px-6">
        {/* Rating badge */}
        <div className="flex justify-center mb-4">
          <div className="inline-flex items-center gap-2 text-sm text-muted-foreground">
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
        </div>

        <h2
          id="testimonials-heading"
          className="text-center text-3xl xs:text-4xl md:text-5xl leading-[1.15]! font-bold tracking-tighter max-w-4xl mx-auto mb-4"
        >
          {tidyTitle(title)}
        </h2>
        <p className="text-center text-muted-foreground text-lg max-w-2xl mx-auto mb-12">
          {subtitle}
        </p>
      </div>

      <TestimonialsCarousel
        testimonials={testimonials}
        anonymousLabel={anonymousLabel}
      />

      {/* Google Reviews badge — social proof */}
      <div className="flex justify-center mt-8">
        <GoogleReviewsBadge locale={locale} />
      </div>
    </section>
  );
}
