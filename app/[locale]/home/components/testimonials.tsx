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

// Generate JSON-LD structured data for SEO
function generateReviewsStructuredData(testimonials: Testimonial[], anonymousLabel: string) {
  const reviews = testimonials.map((testimonial) => ({
    "@type": "Review",
    "reviewBody": testimonial.testimonial,
    "author": {
      "@type": "Person",
      "name": testimonial.name || anonymousLabel
    },
    ...(testimonial.rating && {
      "reviewRating": {
        "@type": "Rating",
        "ratingValue": testimonial.rating,
        "bestRating": 5,
        "worstRating": 1
      }
    }),
    ...(testimonial.service && {
      "about": testimonial.service
    })
  }));

  // Calculate aggregate rating from reviews with ratings
  const ratedReviews = testimonials.filter(t => typeof t.rating === 'number');
  const avgRating = ratedReviews.length > 0 
    ? ratedReviews.reduce((sum, t) => sum + (t.rating || 0), 0) / ratedReviews.length 
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
        "ratingValue": avgRating.toFixed(1),
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
          const hasRating = typeof testimonial.rating === 'number';
          const authorName = isNamed ? testimonial.name : anonymousLabel;
          
          return (
            <article
              key={index}
              role="listitem"
              aria-label={`Review by ${authorName}`}
            >
              <Card
                className="group relative h-full bg-gradient-to-br from-background to-accent/50 border border-border/50 shadow-sm hover:shadow-lg hover:border-primary/20 transition-all duration-300 hover:-translate-y-1"
              >
                <CardContent className="p-6">
                  {testimonial.service && hasRating && (
                    <div className="flex items-center justify-between mb-4">
                      <Badge variant="secondary" className="text-xs font-medium bg-primary/10 text-primary hover:bg-primary/15">
                        {testimonial.service}
                      </Badge>
                      <StarRating rating={testimonial.rating as number} />
                    </div>
                  )}
                  
                  <QuoteIcon className="w-8 h-8 text-primary/20 mb-3" />
                  
                  <figure>
                    <blockquote 
                      className="text-[15px] text-foreground/80 leading-relaxed mb-4"
                      cite="https://ark-fid.ch"
                    >
                      <p>{testimonial.testimonial}</p>
                    </blockquote>
                    <figcaption className="flex items-center gap-2 pt-4 border-t border-border/50">
                      <div 
                        className="w-8 h-8 rounded-full bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center"
                        aria-hidden="true"
                      >
                        <span className="text-primary text-sm">
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
