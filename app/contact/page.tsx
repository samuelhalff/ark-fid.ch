import { Metadata } from "next";
import ContactForm from "@/src/components/ui/contact-form";
import TranslatedText from "@/src/components/ui/translated-text";

export const metadata: Metadata = {
  title: "Contact | Ark Fiduciaire",
  description:
    "Get in touch with Ark Fiduciaire SA for expert accounting, tax, and corporate services in Switzerland.",
};

export default function ContactPage() {
  return (
    <div className="p-15 xs:p-10 md:p-16 w-full max-w-[var(--breakpoint-xl)] mx-auto">
      <h1 className="mb-3 text-center xs:mb-14 text-2xl/7 font-bold sm:text-3xl sm:tracking-tight mt-10 animate-in fade-in duration-700">
        <TranslatedText
          ns="contact"
          translationKey="Title"
          fallbackText="Get in Touch"
        />
      </h1>
      <p className="mt-6 w-full text-center text-muted-foreground">
        <TranslatedText
          ns="contact"
          translationKey="Subtitle"
          fallbackText="Subtitle"
        />
      </p>
      <ContactForm />
    </div>
  );
}
