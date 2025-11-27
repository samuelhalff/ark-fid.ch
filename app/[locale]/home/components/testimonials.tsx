import { getTranslations, getCurrentLocale, type Locale } from "@/src/lib/i18n";
import { tidyTitle } from "@/src/lib/typography";
import { Card, CardContent } from "@/src/components/ui/card";
import { Badge } from "@/src/components/ui/badge";

interface Testimonial {
  service: string;
  testimonial: string;
  rating: number;
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
  >
    <path d="M14.017 21v-7.391c0-5.704 3.731-9.57 8.983-10.609l.995 2.151c-2.432.917-3.995 3.638-3.995 5.849h4v10h-9.983zm-14.017 0v-7.391c0-5.704 3.748-9.57 9-10.609l.996 2.151c-2.433.917-3.996 3.638-3.996 5.849h3.983v10h-9.983z" />
  </svg>
);

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
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

export default async function Testimonials() {
  const locale: Locale = getCurrentLocale();
  const t = await getTranslations(locale, "testimonials");

  const title = (t("SectionTitle") as string) || "Testimonials";
  const testimonials = (t("List") as unknown as Testimonial[]) || [];

  return (
    <div
      id="testimonials"
      className="w-full max-w-[var(--breakpoint-xl)] mx-auto py-12 xs:py-20 px-6 mb-10"
    >
      <h2 className="text-center text-3xl xs:text-4xl md:text-5xl leading-[1.15]! font-bold tracking-tighter max-w-4xl mx-auto mb-4">
        {tidyTitle(title)}
      </h2>
      <p className="text-center text-muted-foreground text-lg max-w-2xl mx-auto mb-12">
        {t("Subtitle") as string}
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {testimonials.map((testimonial, index) => (
          <Card
            key={index}
            className="group relative bg-gradient-to-br from-background to-accent/50 border border-border/50 shadow-sm hover:shadow-lg hover:border-primary/20 transition-all duration-300 hover:-translate-y-1"
          >
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-4">
                <Badge variant="secondary" className="text-xs font-medium bg-primary/10 text-primary hover:bg-primary/15">
                  {testimonial.service}
                </Badge>
                <StarRating rating={testimonial.rating} />
              </div>
              
              <QuoteIcon className="w-8 h-8 text-primary/20 mb-3" />
              
              <blockquote className="text-[15px] text-foreground/80 leading-relaxed mb-4">
                {testimonial.testimonial}
              </blockquote>
              
              <div className="flex items-center gap-2 pt-4 border-t border-border/50">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center">
                  <span className="text-primary text-sm">✓</span>
                </div>
                <span className="text-sm text-muted-foreground font-medium">
                  {t("VerifiedClient") as string}
                </span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
