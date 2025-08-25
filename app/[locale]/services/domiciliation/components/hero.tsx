"use client";
import ServiceHero from "@/src/components/ui/service-hero";

const DomiciliationHero = () => {
  return (
    <ServiceHero
      namespace="domiciliation"
      imageSrc="/assets/services/domiciliation.png"
      imageAlt="Domiciliation Services"
      badge1Key="Hero.Badge"
      badge1Fallback="Swiss Address"
      badge2Key="Hero.BadgeTwo"
      badge2Fallback="Business Solutions"
      titleKey="Hero.Title"
      titleFallback="Professional Domiciliation Services"
      descriptionKey="Hero.Description"
      descriptionFallback="Domiciliation services provide businesses with a registered address. These services are ideal for companies looking to establish a presence in Switzerland."
      ctaKey="Hero.CTA"
      ctaFallback="Contact us"
      secondaryCtaKey="Hero.SecondaryCTA"
      secondaryCtaFallback="Meet the Team"
    />
  );
};

export default DomiciliationHero;
