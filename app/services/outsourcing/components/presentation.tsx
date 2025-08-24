"use client";

import React from "react";
import {
  Users,
  Clock,
  Settings,
  Laptop,
  MessageSquare,
  CheckCircle,
} from "lucide-react";
import TranslatedText from "@/src/components/ui/translated-text";
import TranslatedTextArray from "@/src/components/ui/translated-text-array";
import TranslatedObjectArray from "@/src/components/ui/translated-object-array";
import ServicesList from "@/src/components/ui/services-list";

const iconMap = [Users, Clock, Settings, Laptop, MessageSquare];

const OutsourcingPresentation = () => {
  return (
    <section className="mx-auto w-full py-12 xs:py-20 px-6 flex flex-col items-center pt-25">
      <div className="w-full max-w-[1200px]">
        <h1 className="text-3xl xs:text-4xl md:text-5xl md:leading-[3.5rem] font-bold tracking-tight mb-8 text-left w-full">
          <TranslatedText
            ns="outsourcing"
            translationKey="Presentation.Title"
            fallbackText="Outsourcing"
          />
        </h1>
        <h2 className="text-xl xs:text-2xl md:text-2xl font-bold mb-8 md:leading-[2rem] tracking-tight text-muted-foreground">
          <TranslatedText
            ns="outsourcing"
            translationKey="Presentation.Subtitle"
            fallbackText="Delegate, focus, grow"
          />
        </h2>

        <div className="text-left w-full">
          <div className="space-y-6 mb-12">
            <TranslatedTextArray
              ns="outsourcing"
              translationKey="Presentation.Intro"
              fallbackText={["Welcome to our outsourcing services"]}
            />
          </div>

          <div className="space-y-16">
            <section>
              <h3 className="text-xl xs:text-2xl md:text-2xl font-bold mb-8 md:leading-[2rem] tracking-tight text-left">
                <TranslatedText
                  ns="outsourcing"
                  translationKey="Presentation.ServicesTitle"
                  fallbackText="Meet the team"
                />
              </h3>
              <div className="space-y-4 mb-8">
                <TranslatedTextArray
                  ns="outsourcing"
                  translationKey="Presentation.List"
                  fallbackText={["Outsourcing services"]}
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
                  ns="outsourcing"
                  translationKey="Presentation.ServicesTitle"
                  fallbackText="Our Services"
                />
              </h3>
              <ServicesList
                ns="outsourcing"
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
                  ns="outsourcing"
                  translationKey="Presentation.StrengthsTitle"
                  fallbackText="Our Strengths"
                />
              </h3>
              <div className="space-y-4 mb-12">
                <TranslatedObjectArray
                  ns="outsourcing"
                  translationKey="Presentation.Strengths"
                  fallbackItems={[
                    {
                      Title: "Expertise and reliability",
                      Desc: "Our team guarantees high-quality services and strict confidentiality.",
                    },
                    {
                      Title: "Cost control",
                      Desc: "Outsourcing allows you to optimize your costs and benefit from scalable solutions.",
                    },
                    {
                      Title: "Flexibility and scalability",
                      Desc: "Our services adapt to your needs and the evolution of your business.",
                    },
                  ]}
                  renderItem={(item, index) => {
                    const Icon = iconMap[index] || CheckCircle;
                    return (
                      <div
                        key={index}
                        className="flex items-start gap-6 px-6 py-6 rounded-xl bg-muted/50 shadow-sm hover:shadow-md transition-shadow"
                      >
                        <span className="mt-1">
                          <Icon
                            className="text-primary min-w-[24px]"
                            size={24}
                          />
                        </span>
                        <div>
                          <span className="font-semibold text-lg text-gray-900 dark:text-gray-100 block mb-2">
                            {item.Title}
                          </span>
                          <span className="text-base text-gray-700 dark:text-gray-300 leading-relaxed">
                            {item.Desc}
                          </span>
                        </div>
                      </div>
                    );
                  }}
                />
              </div>
            </section>
          </div>
        </div>
      </div>
    </section>
  );
};

export default OutsourcingPresentation;
