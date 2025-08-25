import React from "react";
import TranslatedText from "@/src/components/ui/translated-text";
import PartnersGrid from "./PartnersGrid";
import ServiceAreasGrid from "./ServiceAreasGrid";
import BenefitsList from "./BenefitsList";
import ContactSection from "./ContactSection";

const PartnersPresentation = ({ locale }: { locale?: string }) => {
  return (
    <section className="mx-auto w-full py-12 xs:py-20 px-6 flex flex-col items-center">
      <div className="w-full max-w-[1200px]">
        <h1 className="text-3xl xs:text-4xl md:text-5xl md:leading-[3.5rem] font-bold tracking-tight mb-8 text-center w-full">
          <TranslatedText
            ns="partners"
            translationKey="Presentation.Title"
            fallbackText="Building Strong Partnerships"
          />
        </h1>

        <div className="text-center w-full mb-16">
          <h2 className="text-xl xs:text-2xl md:text-2xl font-bold mb-8 md:leading-[2rem] tracking-tight">
            <TranslatedText
              ns="partners"
              translationKey="Presentation.Subtitle"
              fallbackText="Strategic Collaboration Network"
            />
          </h2>

          <div className="max-w-4xl mx-auto mb-12">
            <p className="text-lg text-muted-foreground leading-relaxed">
              <TranslatedText
                ns="partners"
                translationKey="Presentation.Description"
                fallbackText="Through strategic partnerships, we expand our capabilities and deliver comprehensive solutions that meet all your professional service needs."
              />
            </p>
          </div>
        </div>

        {/* Partners Section */}
        <section className="mb-20">
          <div className="text-center mb-12">
            <h2 className="text-2xl md:text-3xl font-semibold mb-4">
              <TranslatedText
                ns="partners"
                translationKey="PartnersTitle"
                fallbackText="Our Partner Network"
              />
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              <TranslatedText
                ns="partners"
                translationKey="PartnersDescription"
                fallbackText="Discover our network of professional partners who share our commitment to excellence and client service."
              />
            </p>
          </div>
          <PartnersGrid />
        </section>

        {/* Service Areas Section */}
        <section className="mb-20">
          <div className="text-center mb-12">
            <h2 className="text-2xl md:text-3xl font-semibold mb-4">
              <TranslatedText
                ns="partners"
                translationKey="ServiceAreas.Title"
                fallbackText="Collaborative Service Areas"
              />
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              <TranslatedText
                ns="partners"
                translationKey="ServiceAreas.Description"
                fallbackText="Through our partnerships, we offer enhanced capabilities across multiple domains:"
              />
            </p>
          </div>
          <ServiceAreasGrid />
        </section>

        {/* Partnership Benefits Section */}
        <section className="mb-20">
          <div className="text-center mb-12">
            <h2 className="text-2xl md:text-3xl font-semibold mb-4">
              <TranslatedText
                ns="partners"
                translationKey="Partnership.Title"
                fallbackText="Partnership Benefits"
              />
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              <TranslatedText
                ns="partners"
                translationKey="Partnership.Description"
                fallbackText="Our strategic partnerships enable us to:"
              />
            </p>
          </div>
          <BenefitsList />
        </section>

        {/* Contact Section */}
        <ContactSection locale={locale} />
      </div>
    </section>
  );
};

export default PartnersPresentation;
