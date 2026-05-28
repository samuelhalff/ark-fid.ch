import React from "react";
import { CtaBanner } from "@/src/components/ui/surface";
// Server-provided texts via ArticleContent props; no client translation needed

function MessageCircleIcon({
  className = "",
  size = 48,
}: {
  className?: string;
  size?: number;
}) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
      focusable="false"
    >
      <path d="M21 15a4 4 0 0 1-4 4H7l-4 4V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z" />
    </svg>
  );
}

const ContactSection = ({
  locale,
  title,
  description,
  buttonText,
  secondaryButtonText,
}: {
  locale?: string;
  title: string;
  description: string;
  buttonText: string;
  /** Optional "Get instant quote" CTA displayed next to the primary contact button */
  secondaryButtonText?: string;
}) => {
  const localePrefix = locale ? `/${locale}` : "/fr";

  return (
    <CtaBanner
      className="mt-16"
      variant="contrast"
      eyebrow="Parlons-en"
      title={title}
      description={description}
      icon={
        <span className="flex size-14 items-center justify-center rounded-full bg-background/10 text-brand-onDark dark:bg-[#1f1b19]/10 dark:text-brand-hover">
          <MessageCircleIcon className="h-7 w-7" />
        </span>
      }
      primary={{
        href: `${localePrefix}/contact/`,
        label: buttonText,
        locale,
      }}
      secondary={
        secondaryButtonText
          ? {
              href: `${localePrefix}/agent/`,
              label: secondaryButtonText,
              locale,
            }
          : undefined
      }
    />
  );
};

export default ContactSection;
