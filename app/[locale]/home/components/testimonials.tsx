import { getTranslations, getCurrentLocale, type Locale } from "@/src/lib/i18n";
import { tidyTitle } from "@/src/lib/typography";
import { Card, CardContent } from "@/src/components/ui/card";
import { Avatar, AvatarFallback } from "@/src/components/ui/avatar";

interface Testimonial {
  name: string;
  testimonial: string;
}

// Inline Quote icon to avoid additional dependencies
const QuoteIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="currentColor"
    stroke="none"
  >
    <path d="M14.017 21v-7.391c0-5.704 3.731-9.57 8.983-10.609l.995 2.151c-2.432.917-3.995 3.638-3.995 5.849h4v10h-9.983zm-14.017 0v-7.391c0-5.704 3.748-9.57 9-10.609l.996 2.151c-2.433.917-3.996 3.638-3.996 5.849h3.983v10h-9.983z" />
  </svg>
);

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((word) => word[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export default async function Testimonials() {
  const locale: Locale = getCurrentLocale();
  const t = await getTranslations(locale, "testimonials");

  const title = (t("SectionTitle") as string) || "Testimonials";
  const testimonials = (t("List") as unknown as Testimonial[]) || [];

  return (
    <div
      id="testimonials"
      className="w-full max-w-[var(--breakpoint-xl)] mx-auto py-8 xs:py-16 px-6 mb-10"
    >
      <h2 className="text-center text-3xl xs:text-4xl md:text-5xl leading-[1.15]! font-bold tracking-tighter max-w-4xl mx-auto mb-8">
        {tidyTitle(title)}
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
        {testimonials.map((testimonial, index) => (
          <Card
            key={index}
            className="bg-accent border-0 shadow-none hover:shadow-none hover:translate-y-0"
          >
            <CardContent className="pt-6">
              <QuoteIcon className="w-8 h-8 text-muted-foreground/30 mb-4" />
              <blockquote className="text-[15px] text-muted-foreground leading-relaxed mb-6">
                &ldquo;{testimonial.testimonial}&rdquo;
              </blockquote>
              <div className="flex items-center gap-3">
                <Avatar className="h-10 w-10 bg-foreground/10">
                  <AvatarFallback className="bg-foreground/10 text-foreground text-sm font-medium">
                    {getInitials(testimonial.name)}
                  </AvatarFallback>
                </Avatar>
                <span className="font-semibold text-foreground">
                  {testimonial.name}
                </span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
