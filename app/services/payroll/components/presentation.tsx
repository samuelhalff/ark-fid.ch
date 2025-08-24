"use client";

import TranslatedText from "@/src/components/ui/translated-text";
import {
  CheckCircle,
  Users,
  Clock,
  FileText,
  Calculator,
  Shield,
  TrendingUp,
  Award,
} from "lucide-react";
import TranslatedTextArray from "@/src/components/ui/translated-text-array";
import ServicesList from "@/src/components/ui/services-list";

const iconMapList = [Users, Clock, FileText, Calculator, Shield];
const iconMapServices = [Users, Calculator, Shield, Award];

const PayrollPresentation = () => {
  return (
    <section className="mx-auto w-full py-12 xs:py-20 px-6 flex flex-col items-center pt-25">
      <div className="w-full max-w-[1200px]">
        <h1 className="text-3xl xs:text-4xl md:text-5xl md:leading-[3.5rem] font-bold tracking-tight mb-8 text-left w-full">
          <TranslatedText
            ns="payroll"
            translationKey="Presentation.Title"
            fallbackText="Payroll Presentation"
          />
        </h1>
        <h2 className="text-xl xs:text-2xl md:text-2xl font-bold mb-8 md:leading-[2rem] tracking-tight">
          <TranslatedText
            ns="payroll"
            translationKey="Presentation.Subtitle"
            fallbackText="Subtitle"
          />
        </h2>
        <TranslatedTextArray
          ns="payroll"
          translationKey="Presentation.Intro"
          fallbackText={["Welcome to our Payroll Services"]}
        />
        <div className="mt-3 mb-8">
          <TranslatedTextArray
            ns="payroll"
            translationKey="Presentation.List"
            fallbackText={["List item 1", "List item 2", "List item 3"]}
            renderItem={(text, index) => {
              const Icon = iconMapList[index % iconMapList.length];
              return (
                <div
                  key={index}
                  className="flex items-start gap-3 px-4 py-2 rounded-lg mb-2"
                >
                  <Icon className="text-blue-400 mt-1 min-w-[18px]" size={18} />
                  <span className="text-base">{text}</span>
                </div>
              );
            }}
          />
        </div>
        <ServicesList
          ns="payroll"
          translationKey="Presentation.Services"
          fallbackText={[
            "Service 1: Description",
            "Service 2: Description",
            "Service 3: Description",
          ]}
          iconMap={iconMapServices}
        />
      </div>
    </section>
  );
};

export default PayrollPresentation;
