import React from "react";
import { headers } from "next/headers";
import Service from "@/app/[locale]/home/components/services";
import ContactForm from "@/src/components/ui/contact-form";

export default function ServicesPage() {
  const nonce = headers().get("x-nonce") || undefined;
  // BreadcrumbList for /services
  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Services",
      },
    ],
  } as const;
  return (
    <main
      className="max-w-[var(--breakpoint-xl)] mx-auto w-full pb-4 xs:py-20 md:px-6"
      role="main"
    >
      <script
        type="application/ld+json"
        nonce={nonce}
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <Service showSubtitle={true} />
      <ContactForm />
    </main>
  );
}
