import ServiceHero from "@/src/components/ui/service-hero";

const CorporateHero = ({ locale }: { locale?: string }) => {
  return (
    <ServiceHero
      locale={locale}
      namespace="incorporation"
      imageSrc="/assets/hero/services/incorporation-hero.webp"
      imageAlt="Spiez Castle on Lake Thun with mountains, Switzerland"
      badge1Key="Hero.Badge"
      badge1Fallback="Swiss excellence"
      badge2Key="Hero.BadgeTwo"
      badge2Fallback="Business Experts"
      titleKey="Hero.Title"
      titleFallback="Company Incorporation Services"
      descriptionKey="Hero.Description"
      descriptionFallback="Expert guidance for seamless company formation and registration in Switzerland."
      ctaKey="Hero.CTA"
      ctaFallback="Contact us"
    />
  );
};

export default CorporateHero;
