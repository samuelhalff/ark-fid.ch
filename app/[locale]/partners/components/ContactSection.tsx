import React from "react";
import { Award } from "lucide-react";
import { Button } from "@/src/components/ui/button";

const ContactSection = ({
  locale,
  title,
  description,
  cta,
}: {
  locale?: string;
  title: string;
  description: string;
  cta: string;
}) => {
  const localePrefix = locale ? `/${locale}` : "/fr";

  return (
    <section className="bg-muted/50 rounded-xl p-8 text-center">
      <div className="max-w-2xl mx-auto">
        <Award className="w-12 h-12 text-primary mx-auto mb-4" />
        <h3 className="text-xl font-semibold mb-4">{title}</h3>
        <p className="mb-6">{description}</p>
        <a href={`${localePrefix}/contact`}>
          <Button size="lg" className="rounded-full">
            {cta}
          </Button>
        </a>
      </div>
    </section>
  );
};

export default ContactSection;
