import React from "react";
const AwardIcon = (props: any) => (
  <svg
    viewBox="0 0 24 24"
    width="48"
    height="48"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <circle cx="12" cy="8" r="5" />
    <path d="M8 13l-2 7 6-3 6 3-2-7" />
  </svg>
);
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
        <AwardIcon className="w-12 h-12 text-primary mx-auto mb-4" />
        <h3 className="text-xl font-semibold mb-4">{title}</h3>
        <p className="mb-6">{description}</p>
        <a href={`${localePrefix}/contact/`}>
          <Button size="lg" className="rounded-full">
            {cta}
          </Button>
        </a>
      </div>
    </section>
  );
};

export default ContactSection;
