"use client";
import React from "react";
import TranslatedText from "@/src/components/ui/translated-text";

// Contract:
// Props: { locale?: string }
// - Reads translations from src/translations/<locale>/testimonials.json
// - If not found or empty, renders null (graceful no-op)
// - Accessible markup with heading and list of quotes

type Testimonial = {
  name: string;
  designation?: string;
  company?: string;
  testimonial: string;
};

export default function Testimonials({ locale }: { locale?: string }) {
  const [items, setItems] = React.useState<Testimonial[] | null>(null);

  React.useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const loc = locale || "en";
        const mod = await import(`@/src/translations/${loc}/testimonials.json`);
        const list = (mod?.default?.List || []) as Testimonial[];
        if (mounted) setItems(Array.isArray(list) && list.length ? list : []);
      } catch {
        if (mounted) setItems([]);
      }
    }
    load();
    return () => {
      mounted = false;
    };
  }, [locale]);

  if (!items || items.length === 0) return null;

  return (
    <div className="py-8">
      <h2 className="text-2xl font-semibold mb-4">
        <TranslatedText
          ns="home"
          translationKey="Testimonials.SectionTitle"
          fallbackText="Testimonials"
        />
      </h2>
      <ul className="grid gap-4 md:grid-cols-2">
        {items.map((t, i) => (
          <li
            key={i}
            className="rounded-md border p-4 bg-card text-card-foreground"
          >
            <figure>
              <blockquote className="italic leading-relaxed">
                “{t.testimonial}”
              </blockquote>
              <figcaption className="mt-3 text-sm text-muted-foreground">
                <span className="font-medium text-foreground">{t.name}</span>
                {t.designation && <> · {t.designation}</>}
                {t.company && <> · {t.company}</>}
              </figcaption>
            </figure>
          </li>
        ))}
      </ul>
    </div>
  );
}
