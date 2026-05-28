import React from "react";
import { CtaBanner } from "@/src/components/ui/surface";
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

const ContactSection = ({
  locale,
  title,
  description,
  cta,
  secondaryCta,
}: {
  locale?: string;
  title: string;
  description: string;
  cta: string;
  /** Optional "Get instant quote" CTA displayed next to the primary contact button */
  secondaryCta?: string;
}) => {
  const localePrefix = locale ? `/${locale}` : "/fr";

  return (
    <CtaBanner
      variant="warm"
      icon={<AwardIcon className="size-12 text-brand-hover" />}
      title={title}
      description={description}
      primary={{ label: cta, href: `${localePrefix}/contact/` }}
      secondary={
        secondaryCta
          ? { label: secondaryCta, href: `${localePrefix}/agent/` }
          : undefined
      }
    />
  );
};

export default ContactSection;
