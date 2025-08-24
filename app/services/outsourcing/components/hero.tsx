"use client";
import ServiceHero from "@/src/components/ui/service-hero";

const OutsourcingHero = () => {
  return (
    <ServiceHero
      namespace="outsourcing"
      imageSrc="/assets/services/outsourcing.png"
      imageAlt="Outsourcing Services"
      badge1Key="Hero.Badge"
      badge1Fallback="Swiss Quality"
      badge2Key="Hero.BadgeTwo"
      badge2Fallback="BPO Experts"
      titleKey="Hero.Title"
      titleFallback="Streamline Your Business Operations"
      descriptionKey="Hero.Description"
      descriptionFallback="Focus on your core business while we handle your back office operations with Swiss precision and reliability."
      ctaKey="Hero.CTA"
      ctaFallback="Contact us"
      secondaryCtaKey="Hero.SecondaryCTA"
      secondaryCtaFallback="Meet the Team"
    />
  );
};

export default OutsourcingHero;
