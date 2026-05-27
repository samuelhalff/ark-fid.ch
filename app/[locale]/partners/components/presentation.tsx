import React from "react";
import PartnersGrid from "./PartnersGrid";
import ServiceAreasGrid from "./ServiceAreasGrid";
import BenefitsList from "./BenefitsList";
import ContactSection from "./ContactSection";

const PartnersPresentation = ({
  locale,
  partners,
  serviceAreas,
  benefits,
  strings,
}: {
  locale?: string;
  partners: any[];
  serviceAreas: any[];
  benefits: string[];
  strings: {
    title: string;
    subtitle: string;
    description: string;
    partnersTitle: string;
    partnersDescription: string;
    serviceAreasTitle: string;
    serviceAreasDescription: string;
    partnershipTitle: string;
    partnershipDescription: string;
    contactTitle: string;
    contactDescription: string;
    contactCta: string;
    contactSecondaryCta: string;
  };
}) => {
  const s = strings;
  return (
    <section className="w-full px-5 py-12 sm:px-8 xs:py-20">
      <div className="mx-auto w-full max-w-[1240px]">
        <h2 className="mb-6 max-w-[18ch] text-4xl font-semibold leading-[1.05] tracking-tight text-foreground sm:text-5xl">
          {s.title}
        </h2>

        <div className="mb-16 w-full text-left">
          <h3 className="mb-5 text-xl font-semibold tracking-tight">
            {s.subtitle}
          </h3>

          <div className="mb-12 max-w-3xl">
            <p className="text-base leading-8 text-muted-foreground sm:text-lg">{s.description}</p>
          </div>
        </div>

        {/* Partners Section */}
        <section className="mb-20">
          <div className="text-left mb-12">
            <h2 className="text-2xl font-semibold mb-4">{s.partnersTitle}</h2>
            <p className="max-w-3xl text-base leading-8 text-muted-foreground sm:text-lg">{s.partnersDescription}</p>
          </div>
          <PartnersGrid partners={partners} />
        </section>

        {/* Service Areas Section */}
        <section className="mb-20">
          <div className="text-center mb-12">
            <h2 className="text-2xl md:text-3xl font-semibold mb-4">
              {s.serviceAreasTitle}
            </h2>
            <p className="max-w-2xl mx-auto">{s.serviceAreasDescription}</p>
          </div>
          <ServiceAreasGrid serviceAreas={serviceAreas} />
        </section>

        {/* Partnership Benefits Section */}
        <section className="mb-20">
          <div className="text-center mb-12">
            <h2 className="text-2xl md:text-3xl font-semibold mb-4">
              {s.partnershipTitle}
            </h2>
            <p className="max-w-2xl mx-auto">{s.partnershipDescription}</p>
          </div>
          <BenefitsList benefits={benefits} />
        </section>

        {/* Contact Section */}
        <ContactSection
          locale={locale}
          title={s.contactTitle}
          description={s.contactDescription}
          cta={s.contactCta}
          secondaryCta={s.contactSecondaryCta}
        />
      </div>
    </section>
  );
};

export default PartnersPresentation;
