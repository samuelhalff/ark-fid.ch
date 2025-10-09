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
  };
}) => {
  const s = strings;
  return (
    <section className="mx-auto w-full py-12 xs:py-20 px-6 flex flex-col items-center">
      <div className="w-full max-w-[1200px]">
        <h1 className="text-3xl xs:text-4xl md:text-5xl md:leading-[3.5rem] font-bold tracking-tight mb-8 text-center w-full">
          {s.title}
        </h1>

        <div className="text-center w-full mb-16">
          <h2 className="text-xl xs:text-2xl md:text-2xl font-bold mb-8 md:leading-[2rem] tracking-tight">
            {s.subtitle}
          </h2>

          <div className="max-w-4xl mx-auto mb-12">
            <p className="text-lg leading-relaxed">{s.description}</p>
          </div>
        </div>

        {/* Partners Section */}
        <section className="mb-20">
          <div className="text-center mb-12">
            <h2 className="text-2xl md:text-3xl font-semibold mb-4">
              {s.partnersTitle}
            </h2>
            <p className="max-w-2xl mx-auto">{s.partnersDescription}</p>
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
        />
      </div>
    </section>
  );
};

export default PartnersPresentation;
