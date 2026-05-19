import React from "react";
import { Button } from "@/src/components/ui/button";
import Link from "next/link";
import SectionHeading from "@/src/components/site/section-heading";
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
    <section className="mt-12 rounded-[30px] border border-border/70 bg-gradient-to-br from-muted/60 via-background to-muted/20 p-8 text-center shadow-sm sm:p-10">
      <div className="mx-auto max-w-2xl">
        <div className="mb-5 flex justify-center">
          <span className="flex size-14 items-center justify-center rounded-full bg-[#FAEEE5] text-[#B86340] dark:bg-[#D17A4F]/10 dark:text-[#F3C0A6]">
            <MessageCircleIcon className="h-7 w-7" />
          </span>
        </div>
        <SectionHeading
          eyebrow="Parlons-en"
          title={title}
          description={description}
          className="max-w-2xl"
        />
        <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            href={`${localePrefix}/contact/`}
            locale={locale}
            prefetch={false}
          >
            <Button size="lg" className="rounded-full">
              {buttonText}
            </Button>
          </Link>
          {secondaryButtonText && (
            <Link
              href={`${localePrefix}/agent/`}
              locale={locale}
              prefetch={false}
            >
              <Button size="lg" variant="secondary" className="rounded-full">
                {secondaryButtonText}
              </Button>
            </Link>
          )}
        </div>
      </div>
    </section>
  );
};

export default ContactSection;
