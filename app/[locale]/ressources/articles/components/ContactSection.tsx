import React from "react";
import { Button } from "@/src/components/ui/button";
import Link from "next/link";
import TranslatedText from "@/src/components/ui/translated-text";

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

const ContactSection = ({ locale }: { locale?: string }) => {
  const localePrefix = locale ? `/${locale}` : "/fr";

  return (
    <section className="bg-muted/50 rounded-xl p-8 text-center mt-12">
      <div className="max-w-2xl mx-auto">
        <MessageCircleIcon className="w-12 h-12 text-primary mx-auto mb-4" />
        <h3 className="text-xl font-semibold mb-4">
          <TranslatedText
            ns="ressources"
            translationKey="Contact.Title"
            fallbackText="Questions about this article?"
          />
        </h3>
        <p className="mb-6">
          <TranslatedText
            ns="ressources"
            translationKey="Contact.Description"
            fallbackText="Our experts are here to help you understand the details and implications for your business. Get personalized advice tailored to your situation."
          />
        </p>
        <Link href={`${localePrefix}/contact`} locale={locale} prefetch={false}>
          <Button size="lg" className="rounded-full">
            <TranslatedText
              ns="ressources"
              translationKey="Contact.ButtonText"
              fallbackText="Contact Our Team"
            />
          </Button>
        </Link>
      </div>
    </section>
  );
};

export default ContactSection;
