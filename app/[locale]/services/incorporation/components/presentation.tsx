"use client";
import {
  Building2,
  UserCheck,
  FileText,
  Shield,
  Lightbulb,
  CheckCircle,
} from "lucide-react";
import TranslatedText from "@/src/components/ui/translated-text";
import TranslatedTextArray from "@/src/components/ui/translated-text-array";
import TranslatedObjectArray from "@/src/components/ui/translated-object-array";
import ServicesList from "@/src/components/ui/services-list";

const iconMap = [Building2, UserCheck, FileText, Shield, Lightbulb];

const CorporatePresentation = () => {
  return (
    <section className="mx-auto w-full py-12 xs:py-20 px-6 flex flex-col items-center pt-25">
      <div className="w-full max-w-[1200px]">
        <h1 className="text-3xl xs:text-4xl md:text-5xl md:leading-[3.5rem] font-bold tracking-tight mb-8 text-left w-full">
          <TranslatedText
            ns="incorporation"
            translationKey="Presentation.Title"
            fallbackText="Company Incorporation Services"
          />
        </h1>

        <h2 className="text-xl xs:text-2xl md:text-2xl font-bold mb-8 md:leading-[2rem] tracking-tight">
          <TranslatedText
            ns="incorporation"
            translationKey="Presentation.Subtitle"
            fallbackText="Expert Incorporation & Registration"
          />
        </h2>

        <div className="text-left w-full">
          <div className="space-y-6 mb-12">
            <TranslatedTextArray
              ns="incorporation"
              translationKey="Presentation.Intro"
              fallbackText={[
                "We specialise in company incorporation, guiding you through registration, documentation, and compliance for a smooth start.",
                "From choosing the right legal form to filing with authorities, we make company formation efficient and compliant.",
              ]}
            />
          </div>

          <div className="space-y-16">
            <section>
              <h3 className="text-xl xs:text-2xl md:text-2xl font-bold mb-8 md:leading-[2rem] tracking-tight">
                <TranslatedText
                  ns="incorporation"
                  translationKey="Presentation.StrengthsTitle"
                  fallbackText="Why Choose Our Incorporation Services"
                />
              </h3>
              <div className="space-y-4 mb-8">
                <TranslatedObjectArray
                  ns="incorporation"
                  translationKey="Presentation.Strengths"
                  fallbackItems={[
                    {
                      Title: "Formation expertise",
                      Desc: "Experienced guidance on entity selection, registration steps and documentation.",
                    },
                    {
                      Title: "Regulatory compliance",
                      Desc: "Ensure your new company meets all local legal and tax requirements from day one.",
                    },
                    {
                      Title: "Post-incorporation support",
                      Desc: "Registered office, nominee services and ongoing reporting assistance.",
                    },
                  ]}
                  renderItem={(item, index) => (
                    <div
                      key={index}
                      className="flex items-start gap-4 px-6 py-4 rounded-lg bg-primary/5 mb-4"
                    >
                      <CheckCircle
                        className="text-blue-400 mt-1 min-w-[20px]"
                        size={20}
                      />
                      <div>
                        <span className="font-semibold block text-lg mb-2">
                          {item.Title}
                        </span>
                        <span className="text-base leading-relaxed">
                          {item.Desc}
                        </span>
                      </div>
                    </div>
                  )}
                />
              </div>
            </section>

            <section>
              <h3 className="text-xl xs:text-2xl md:text-2xl font-bold mb-8 md:leading-[2rem] tracking-tight">
                <TranslatedText
                  ns="incorporation"
                  translationKey="Presentation.ServicesTitle"
                  fallbackText="Incorporation Services"
                />
              </h3>
              <ServicesList
                ns="incorporation"
                translationKey="Presentation.Services"
                fallbackText={[
                  "Company registration and formation",
                  "Preparation and filing of incorporation documents",
                  "Registered office and nominee services",
                  "Tax registration and compliance onboarding",
                ]}
                iconMap={iconMap}
                className="space-y-6"
              />
            </section>
          </div>
        </div>
      </div>
    </section>
  );
};

export default CorporatePresentation;
