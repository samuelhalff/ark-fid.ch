"use client";
import ServiceHero from "@/src/components/ui/service-hero";

const OdooHero = () => {
  return (
    <ServiceHero
      namespace="odoo"
      imageSrc="/assets/services/odoo-services.png"
      imageAlt="Odoo Implementation Services"
      badge1Key="Hero.Badge"
      badge1Fallback="Official Partner"
      badge2Key="Hero.BadgeTwo"
      badge2Fallback="ERP Experts"
      titleKey="Hero.Title"
      titleFallback="Professional Odoo Implementation & Configuration"
      descriptionKey="Hero.Description"
      descriptionFallback="We are official Odoo partners providing full implementation and configuration services to streamline your business operations."
      ctaKey="Hero.CTA"
      ctaFallback="Contact us"
      secondaryCtaKey="Hero.SecondaryCTA"
      secondaryCtaFallback="Meet the Team"
    />
  );
};

export default OdooHero;
