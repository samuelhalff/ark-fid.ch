"use client";

import {
  CheckCircle,
  FileText,
  Briefcase,
  SearchCheck,
  Landmark,
} from "lucide-react";
import { StylishList } from "@/src/components/ui/stylish-list";
import TranslatedText from "@/src/components/ui/translated-text";
import TranslatedTextArray from "@/src/components/ui/translated-text-array";
import TranslatedObjectArray from "@/src/components/ui/translated-object-array";

const iconMap = [FileText, Briefcase, SearchCheck, Landmark];

const Presentation = () => {
  return (
    <section className="mx-auto w-full py-12 xs:py-20 px-6 flex flex-col items-center pt-25">
      <div className="w-full max-w-[1200px]">
        <h1 className="text-3xl xs:text-4xl md:text-5xl md:leading-[3.5rem] font-bold tracking-tight mb-8 text-left w-full">
          <TranslatedText
            ns="taxes"
            translationKey="Presentation.Title"
            fallbackText="Taxes"
          />
        </h1>
        <h2 className="text-xl xs:text-2xl md:text-2xl font-bold mb-8 md:leading-[2rem] tracking-tight text-muted-foreground">
          <TranslatedText
            ns="taxes"
            translationKey="Presentation.Subtitle"
            fallbackText="Expertise and compliance"
          />
        </h2>

        <div className="text-left w-full">
          <div className="space-y-6 mb-12">
            <TranslatedTextArray
              ns="taxes"
              translationKey="Presentation.Intro"
              fallbackText={["Welcome to our tax services"]}
            />
          </div>

          <div className="space-y-16">
            <section>
              <h3 className="text-xl xs:text-2xl md:text-2xl font-bold mb-8 md:leading-[2rem] tracking-tight text-left">
                <TranslatedText
                  ns="taxes"
                  translationKey="Presentation.ExpertiseTitle"
                  fallbackText="Our Expertise"
                />
              </h3>
              <div className="space-y-4 mb-8">
                <TranslatedTextArray
                  ns="taxes"
                  translationKey="Presentation.List"
                  fallbackText={["Tax expertise and services"]}
                  renderItem={(text, index) => (
                    <div key={index} className="flex items-start gap-4 py-2">
                      <CheckCircle
                        className="text-primary mt-1 min-w-[20px]"
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
                  ns="taxes"
                  translationKey="Presentation.ReinventedTitle"
                  fallbackText="Reinvented Process"
                />
              </h3>
              <div className="space-y-6 mb-12">
                <TranslatedTextArray
                  ns="taxes"
                  translationKey="Presentation.Reinvented"
                  fallbackText={["Our reinvented process description"]}
                />
              </div>

              <h4 className="text-lg xs:text-xl font-semibold mb-6 tracking-tight">
                <TranslatedText
                  ns="taxes"
                  translationKey="Presentation.StrengthsTitle"
                  fallbackText="Our Strengths"
                />
              </h4>
              <div className="space-y-4 mb-12">
                <TranslatedObjectArray
                  ns="taxes"
                  translationKey="Presentation.Strengths"
                  fallbackItems={[
                    {
                      Title: "Comprehensive expertise",
                      Desc: "Our team covers all areas of Swiss taxation.",
                    },
                    {
                      Title: "Personalized advice",
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
                  ns="taxes"
                  translationKey="Presentation.ServicesTitle"
                  fallbackText="Services"
                />
              </h3>
              <div className="space-y-6">
                <TranslatedTextArray
                  ns="taxes"
                  translationKey="Presentation.Services"
                  fallbackText={[
                    "Service 1: Description",
                    "Service 2: Description",
                    "Service 3: Description",
                    "Service 4: Description",
                  ]}
                  renderItem={(text, idx) => {
                    const Icon = iconMap[idx] || CheckCircle;
                    const [title, ...descParts] = text.split(":");
                    const desc = descParts.join(":").trim();
                    return (
                      <div
                        key={idx}
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
                            {title}
                          </span>
                          {desc && (
                            <span className="text-base text-gray-700 dark:text-gray-300 leading-relaxed">
                              {desc}
                            </span>
                          )}
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

export default Presentation;
