import React from "react";
import { CtaBanner } from "@/src/components/ui/surface";
import { Medal as AwardIcon } from "@phosphor-icons/react/dist/ssr";

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
