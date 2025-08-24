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

const iconMap = [Users, Clock, ShieldCheck, Rocket, MessageSquare];

const AccountingPresentation = () => {
  return (
    <section className="mx-auto w-full py-12 xs:py-20 px-6 flex flex-col items-center pt-25">
      <div className="w-full max-w-[1200px]">
        <h1 className="text-3xl xs:text-4xl md:text-5xl md:leading-[3.5rem] font-bold tracking-tight mb-8 text-left w-full">
          <TranslatedText
            ns="accounting"
            translationKey="Presentation.Title"
            fallbackText="Holistic Vision of Your Accounting"
          />
        </h1>

        <h2 className="text-xl xs:text-2xl md:text-2xl font-bold mb-8 md:leading-[2rem] tracking-tight text-muted-foreground">
          <TranslatedText
            ns="accounting"
            translationKey="Presentation.Subtitle"
            fallbackText="A 360° Offer"
          />
        </h2>

        <div className="text-left w-full">
          <div className="space-y-6 mb-12">
            <TranslatedTextArray
              ns="accounting"
              translationKey="Presentation.Intro"
              fallbackText={[
                "We provide comprehensive accounting services for businesses of all sizes. Our expert team ensures your financial records are accurate, compliant, and optimized for growth.",
                "From basic bookkeeping to complex financial analysis, we handle all aspects of your accounting needs with precision and professionalism.",
              ]}
            />
          </div>

          <div className="space-y-16">
            <section>
              <h3 className="text-xl xs:text-2xl md:text-2xl font-bold mb-8 md:leading-[2rem] tracking-tight">
                <TranslatedText
                  ns="accounting"
                  translationKey="Presentation.StrengthsTitle"
                  fallbackText="Our Strengths"
                />
              </h3>
              <div className="space-y-4 mb-8">
                <TranslatedObjectArray
                  ns="accounting"
                  translationKey="Presentation.Strengths"
                  fallbackItems={[
                    {
                      Title: "Expertise and experience",
                      Desc: "Our team brings years of experience in Swiss accounting standards.",
                    },
                    {
                      Title: "Personalized approach",
                      Desc: "We analyze your situation to offer tailored solutions.",
                    },
                    {
                      Title: "Compliance and security",
                      Desc: "We guarantee compliance with all legal obligations.",
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
                        <span className="text-base leading-relaxed text-muted-foreground">
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
                  ns="accounting"
                  translationKey="Presentation.ServicesTitle"
                  fallbackText="Services"
                />
              </h3>
              <ServicesList
                ns="accounting"
                translationKey="Presentation.Services"
                fallbackText={[
                  "Service 1: Description",
                  "Service 2: Description",
                  "Service 3: Description",
                  "Service 4: Description",
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

export default AccountingPresentation;
