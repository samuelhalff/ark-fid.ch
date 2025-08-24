"use client";
import ServiceHero from "@/src/components/ui/service-hero";

const TaxesHero = () => {
  return (
    <ServiceHero
      namespace="taxes"
      imageSrc="/assets/services/tax-desk.png"
      imageAlt="Tax Services"
      badge1Key="Hero.Badge"
      badge1Fallback="Swiss Expertise"
      badge2Key="Hero.BadgeTwo"
      badge2Fallback="Tax Specialists"
      titleKey="Hero.Title"
      titleFallback="Expert Tax Services for Companies and Individuals"
      descriptionKey="Hero.Description"
      descriptionFallback="We handle all aspects of tax compliance and optimization, including VAT registration, corporate taxes, and personal tax planning."
      ctaKey="Hero.CTA"
      ctaFallback="Contact us"
      secondaryCtaKey="Hero.SecondaryCTA"
      secondaryCtaFallback="Meet the Team"
    />
  );
};

export default TaxesHero;
