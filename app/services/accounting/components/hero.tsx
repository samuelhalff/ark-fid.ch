"use client";
import ServiceHero from "@/src/components/ui/service-hero";

const AccountingHero = () => {
  return (
    <ServiceHero
      namespace="accounting"
      imageSrc="/assets/services/financial-prompt.png"
      imageAlt="Accounting Services"
      badge1Key="Hero.Badge"
      badge1Fallback="Swiss Excellence"
      badge2Key="Hero.BadgeTwo"
      badge2Fallback="AI Powered"
      titleKey="Hero.Title"
      titleFallback="Expert Accounting Services for Your Success"
      descriptionKey="Hero.Description"
      descriptionFallback="From bookkeeping to financial strategy, we provide comprehensive accounting services to help your business thrive in Switzerland."
      ctaKey="Hero.CTA"
      ctaFallback="Contact us"
      secondaryCtaKey="Hero.SecondaryCTA"
      secondaryCtaFallback="Meet the Team"
    />
  );
};

export default AccountingHero;
