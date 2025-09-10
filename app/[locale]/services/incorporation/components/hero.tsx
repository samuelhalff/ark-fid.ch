import ServiceHero from "@/src/components/ui/service-hero";

const CorporateHero = ({ locale }: { locale?: string }) => {
  return (
    <ServiceHero
      locale={locale}
      namespace="incorporation"
      imageSrc="/assets/services/modern-office.webp"
      imageAlt="Company incorporation services in Switzerland"
      badge1Key="Hero.Badge"
      badge1Fallback="Swiss Excellence"
      badge2Key="Hero.BadgeTwo"
      badge2Fallback="Business Experts"
      titleKey="Hero.Title"
      titleFallback="Company Incorporation Services"
      descriptionKey="Hero.Description"
      descriptionFallback="Expert guidance for seamless company formation and registration in Switzerland."
      ctaKey="Hero.CTA"
      ctaFallback="Contact us"
      secondaryCtaKey="Hero.SecondaryCTA"
      secondaryCtaFallback="Learn more"
    />
  );
};

export default CorporateHero;
