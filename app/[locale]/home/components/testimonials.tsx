import { getTranslations, getCurrentLocale, type Locale } from "@/src/lib/i18n";
import { tidyTitle } from "@/src/lib/typography";
import { Card, CardContent } from "@/src/components/ui/card";
import { Badge } from "@/src/components/ui/badge";

interface Testimonial {
  name?: string;
  service?: string;
  testimonial: string;
  rating?: number;
}

// Inline Star icon for ratings
const StarIcon = ({ filled, className }: { filled: boolean; className?: string }) => (
  <svg
    className={className}
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill={filled ? "currentColor" : "none"}
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
  </svg>
);

// Inline Quote icon
const QuoteIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    width="32"
    height="32"
    viewBox="0 0 24 24"
    fill="currentColor"
    stroke="none"
    aria-hidden="true"
  >
    <path d="M14.017 21v-7.391c0-5.704 3.731-9.57 8.983-10.609l.995 2.151c-2.432.917-3.995 3.638-3.995 5.849h4v10h-9.983zm-14.017 0v-7.391c0-5.704 3.748-9.57 9-10.609l.996 2.151c-2.433.917-3.996 3.638-3.996 5.849h3.983v10h-9.983z" />
  </svg>
);

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5" role="img" aria-label={`${rating} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((star) => (
        <StarIcon
          key={star}
          filled={star <= rating}
          className={star <= rating ? "text-amber-400" : "text-muted-foreground/20"}
        />
      ))}
    </div>
  );
}

// Helper function to get the effective rating (default to 5 for named reviews without explicit rating)
function getEffectiveRating(testimonial: Testimonial): number {
  return testimonial.rating ?? 5;
}

// Generate JSON-LD structured data for SEO
function generateReviewsStructuredData(testimonials: Testimonial[], anonymousLabel: string) {
  const reviews = testimonials.map((testimonial) => ({
    "@type": "Review",
    "reviewBody": testimonial.testimonial,
    "author": {
      "@type": "Person",
      "name": testimonial.name || anonymousLabel
    },
    "reviewRating": {
      "@type": "Rating",
      "ratingValue": getEffectiveRating(testimonial),
      "bestRating": 5,
      "worstRating": 1
    },
    ...(testimonial.service && {
      "about": testimonial.service
    })
  }));

  // Calculate aggregate rating from ALL reviews (default to 5 stars for reviews without explicit rating)
  const avgRating = testimonials.length > 0 
    ? testimonials.reduce((sum, t) => sum + getEffectiveRating(t), 0) / testimonials.length 
    : null;

  return {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    "name": "Ark Fiduciaire SA",
    "address": {
      "@type": "PostalAddress",
      "streetAddress": "26 Boulevard Georges Favon",
      "addressLocality": "Genève",
      "postalCode": "1204",
      "addressCountry": "CH"
    },
    ...(avgRating && {
      "aggregateRating": {
        "@type": "AggregateRating",
        "ratingValue": Number(avgRating.toFixed(1)),
        "reviewCount": testimonials.length,
        "bestRating": 5,
        "worstRating": 1
      }
    }),
    "review": reviews
  };
}

export default async function Testimonials() {
  const locale: Locale = getCurrentLocale();
  const t = await getTranslations(locale, "testimonials");

  const title = (t("SectionTitle") as string) || "Testimonials";
  const testimonials = (t("List") as unknown as Testimonial[]) || [];
  const anonymousLabel = (t("Anonymous") as string) || "Anonymous";
  
  const structuredData = generateReviewsStructuredData(testimonials, anonymousLabel);

  return (
    <section
      id="testimonials"
      className="w-full max-w-[var(--breakpoint-xl)] mx-auto py-12 xs:py-20 px-6 mb-10"
      aria-labelledby="testimonials-heading"
    >
      {/* JSON-LD Structured Data for SEO */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      
      <h2 
        id="testimonials-heading"
        className="text-center text-3xl xs:text-4xl md:text-5xl leading-[1.15]! font-bold tracking-tighter max-w-4xl mx-auto mb-4"
      >
        {tidyTitle(title)}
      </h2>
      <p className="text-center text-muted-foreground text-lg max-w-2xl mx-auto mb-12">
        {t("Subtitle") as string}
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" role="list">
        {testimonials.map((testimonial, index) => {
          const isNamed = !!testimonial.name;
          const authorName = isNamed ? testimonial.name : anonymousLabel;
          const effectiveRating = getEffectiveRating(testimonial);
          
          return (
            <article
              key={index}
              role="listitem"
              aria-label={`Review by ${authorName}`}
            >
              <Card
                className="group relative h-full bg-card border border-border/50 shadow-sm hover:shadow-lg hover:border-primary/30 transition-all duration-300 ease-out hover:-translate-y-1"
              >
                <CardContent className="flex flex-col h-full p-6">
                  {/* Header with badge and rating */}
                  <div className="flex items-center justify-between mb-4">
                    {testimonial.service ? (
                      <Badge variant="secondary" className="text-xs font-medium bg-primary/10 text-primary hover:bg-primary/15">
                        {testimonial.service}
                      </Badge>
                    ) : (
                      <QuoteIcon className="w-6 h-6 text-primary/30" />
                    )}
                    <StarRating rating={effectiveRating} />
                  </div>
                  
                  <figure className="flex flex-col flex-1">
                    <blockquote className="text-[15px] text-foreground/80 leading-relaxed mb-4 flex-1">
                      <p>{testimonial.testimonial}</p>
                    </blockquote>
                    <figcaption className="flex items-center gap-3 pt-4 border-t border-border/50">
                      <div 
                        className="w-9 h-9 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center shrink-0"
                        aria-hidden="true"
                      >
                        <span className="text-primary font-medium text-sm">
                          {isNamed ? testimonial.name?.charAt(0).toUpperCase() : '✓'}
                        </span>
                      </div>
                      <cite className="text-sm text-muted-foreground font-medium not-italic">
                        {authorName}
                      </cite>
                    </figcaption>
                  </figure>
                </CardContent>
              </Card>
            </article>
          );
        })}
      </div>
    </section>
  );
}
