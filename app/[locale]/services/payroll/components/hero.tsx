"use client";
import ServiceHero from "@/src/components/ui/service-hero";

const PayrollHero = () => {
  return (
    <ServiceHero
      namespace="payroll"
      imageSrc="/assets/services/hr-services.png"
      imageAlt="Payroll & HR Services"
      badge1Key="Hero.Badge"
      badge1Fallback="Swiss Standards"
      badge2Key="Hero.BadgeTwo"
      badge2Fallback="HR Experts"
      titleKey="Hero.Title"
      titleFallback="Professional Payroll & HR Services"
      descriptionKey="Hero.Description"
      descriptionFallback="We manage payroll processing, including salary calculations, payslip generation, and compliance with Swiss labor laws."
      ctaKey="Hero.CTA"
      ctaFallback="Contact us"
      secondaryCtaKey="Hero.SecondaryCTA"
      secondaryCtaFallback="Meet the Team"
    />
  );
};

export default PayrollHero;
