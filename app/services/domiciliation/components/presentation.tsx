"use client";

import {
  Users,
  Clock,
  ShieldCheck,
  Rocket,
  MessageSquare,
  CheckCircle,
} from "lucide-react";
import TranslatedText from "@/src/components/ui/translated-text";
import TranslatedTextArray from "@/src/components/ui/translated-text-array";
import TranslatedObjectArray from "@/src/components/ui/translated-object-array";
import ServicesList from "@/src/components/ui/services-list";
import StrengthsList from "@/src/components/ui/strengths-list";

const iconMap = [Users, Clock, ShieldCheck, Rocket, MessageSquare];

const DomiciliationPresentation = () => {
  return (
    <section className="mx-auto w-full py-12 xs:py-20 px-6 flex flex-col items-center pt-25">
      <div className="w-full max-w-[1200px]">
        <h1 className="text-3xl xs:text-4xl md:text-5xl md:leading-[3.5rem] font-bold tracking-tight mb-8 text-left w-full">
          <TranslatedText
            ns="domiciliation"
            translationKey="Presentation.Title"
            fallbackText="Professional Domiciliation Services"
          />
        </h1>
        <h2 className="text-xl xs:text-2xl md:text-2xl font-bold mb-8 md:leading-[2rem] tracking-tight text-muted-foreground">
          <TranslatedText
            ns="domiciliation"
            translationKey="Presentation.Subtitle"
            fallbackText="Your Swiss Business Address Solution"
          />
        </h2>

        <div className="text-left w-full">
          <div className="space-y-6 mb-12">
            <TranslatedTextArray
              ns="domiciliation"
              translationKey="Presentation.Intro"
              fallbackText={[
                "Our domiciliation services provide your company with a prestigious Swiss address, mail handling, and compliance support. We help you establish a credible presence in Switzerland, whether you are a startup, SME, or international group.",
                "Benefit from our expertise in regulatory requirements and our commitment to confidentiality and efficiency.",
              ]}
            />
          </div>

          <div className="space-y-16">
            <section>
              <h3 className="text-xl xs:text-2xl md:text-2xl font-bold mb-8 md:leading-[2rem] tracking-tight text-left">
                <TranslatedText
                  ns="domiciliation"
                  translationKey="Presentation.ServicesTitle"
                  fallbackText="Meet the team"
                />
              </h3>
              <div className="space-y-4 mb-8">
                <TranslatedTextArray
                  ns="domiciliation"
                  translationKey="Presentation.List"
                  fallbackText={["Domiciliation services"]}
                  renderItem={(text, index) => (
                    <div key={index} className="flex items-start gap-4 py-2">
                      <CheckCircle
                        className="text-blue-500 mt-1 min-w-[20px]"
                        size={20}
                      />
                      <span className="text-base leading-relaxed">{text}</span>
                    </div>
                  )}
                />
              </div>
            </section>

            <section>
              <h3 className="text-xl xs:text-2xl md:text-2xl font-bold mb-8 md:leading-[2rem] tracking-tight">
                <TranslatedText
                  ns="domiciliation"
                  translationKey="Presentation.ServicesTitle"
                  fallbackText="Our Services"
                />
              </h3>
              <ServicesList
                ns="domiciliation"
                translationKey="Presentation.Services"
                fallbackText={[
                  "Service 1: Description",
                  "Service 2: Description",
                  "Service 3: Description",
                ]}
                iconMap={iconMap}
                className="space-y-6 mb-12"
              />
            </section>

            <section>
              <h3 className="text-xl xs:text-2xl md:text-2xl font-bold mb-8 md:leading-[2rem] tracking-tight">
                <TranslatedText
                  ns="domiciliation"
                  translationKey="Presentation.StrengthsTitle"
                  fallbackText="Our Strengths"
                />
              </h3>
              <StrengthsList
                ns="domiciliation"
                translationKey="Presentation.Strengths"
                fallbackItems={[
                  {
                    Title: "Prestigious address",
                    Desc: "Benefit from a recognized address in Switzerland for your company.",
                  },
                  {
                    Title: "Administrative support",
                    Desc: "We handle your mail and provide all necessary administrative assistance.",
                  },
                  {
                    Title: "Compliance and security",
                    Desc: "We ensure your company meets all legal requirements for domiciliation.",
                  },
                ]}
                iconMap={iconMap}
                className="space-y-4 mb-12"
              />
            </section>
          </div>
        </div>
      </div>
    </section>
  );
};

export default DomiciliationPresentation;
