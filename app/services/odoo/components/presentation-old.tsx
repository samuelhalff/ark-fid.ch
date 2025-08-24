"use client";

import {
  CheckCircle,
  Settings,
  Laptop,
  MessageSquare,
  Users,
} from "lucide-react";
import TranslatedText from "@/src/components/ui/translated-text";
import ServicesList from "@/src/components/ui/services-list";
import StrengthsList from "@/src/components/ui/strengths-list";
import TranslatedTextArray from "@/src/components/ui/translated-text-array";

const iconMapServices = [Settings, Laptop, MessageSquare, Users];

const OdooPresentation = () => {
  return (
    <section className="w-full flex justify-center py-16 sm:py-24 lg:py-32">
      <div className="w-full max-w-[1200px] px-4 sm:px-6">
        <h1 className="max-w-3xl text-3xl xs:text-4xl md:text-5xl md:leading-14 font-bold tracking-tight mb-8 text-left w-full">
          <TranslatedText
            ns="odoo"
            translationKey="Presentation.Title"
            fallbackText="Odoo Presentation"
          />
        </h1>
        <h2 className="text-xl xs:text-2xl md:text-2xl font-bold mb-8 md:leading-8 tracking-tight">
          <TranslatedText
            ns="odoo"
            translationKey="Presentation.Subtitle"
            fallbackText="Subtitle"
          />
        </h2>

        <div className="space-y-6 mb-12">
          <TranslatedTextArray
            ns="odoo"
            translationKey="Presentation.Intro"
            fallbackText={["Welcome to our Odoo services"]}
            renderItem={(text, idx) => (
              <p key={idx} className="mb-8 text-lg text-justify">
                {text}
              </p>
            )}
          />
        </div>

        <div className="mt-3 mb-8">
          <TranslatedTextArray
            ns="odoo"
            translationKey="Presentation.List"
            fallbackText={[
              "Odoo service 1",
              "Odoo service 2",
              "Odoo service 3",
            ]}
            renderItem={(text, index) => (
              <div key={index} className="flex items-start gap-4 py-2">
                <CheckCircle
                  className="text-green-400 mt-1 min-w-[20px]"
                  size={20}
                />
                <span className="text-base leading-relaxed">{text}</span>
              </div>
            )}
          />
        </div>
        <h3 className="text-2xl font-semibold mb-6">
          <TranslatedText
            ns="odoo"
            translationKey="Presentation.StrengthsTitle"
            fallbackText="Strengths"
          />
        </h3>
        <div className="mb-12">
          <StrengthsList
            ns="odoo"
            translationKey="Presentation.Strengths"
            fallbackItems={[
              {
                Title: "Expertise and reliability",
                Desc: "Our team guarantees high-quality services.",
              },
              {
                Title: "Cost control",
                Desc: "Optimize your costs with scalable solutions.",
              },
              {
                Title: "Flexibility",
                Desc: "Our services adapt to your business needs.",
              },
            ]}
            iconMap={iconMapServices}
          />
        </div>
      </div>
    </section>
  );
};

export default OdooPresentation;
