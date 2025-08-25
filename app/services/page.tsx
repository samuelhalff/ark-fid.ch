import React from "react";
import Service from "@/app/home/components/services";
import ContactForm from "@/src/components/ui/contact-form";

export default function ServicesPage() {
  return (
    <main
      className="max-w-[var(--breakpoint-xl)] mx-auto w-full pb-4 xs:py-20 md:px-6"
      role="main"
    >
      <Service showSubtitle={true} />
      <ContactForm />
    </main>
  );
}
