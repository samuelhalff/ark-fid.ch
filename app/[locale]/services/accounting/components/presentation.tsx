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
import IconList from "@/src/components/ui/icon-list";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/src/components/ui/accordion";

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

        <h2 className="text-xl xs:text-2xl md:text-2xl font-bold mb-8 md:leading-[2rem] tracking-tight">
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
          {/* Top-level key points list */}
          <div className="mb-12">
            <IconList
              namespace="accounting"
              className="grid gap-3"
              icon={<CheckCircle className="w-4 h-4 text-primary" />}
              items={[
                { key: "Presentation.List.0", fallbackText: "General accounting" },
                { key: "Presentation.List.1", fallbackText: "Analytical accounting" },
                { key: "Presentation.List.2", fallbackText: "Periodic tasks" },
                { key: "Presentation.List.3", fallbackText: "Dashboards" },
                { key: "Presentation.List.4", fallbackText: "Custom services" },
              ]}
            />
          </div>

          <div className="space-y-16">
            {/* Detailed sections using Accordion */}
            <section>
              <Accordion type="single" collapsible className="w-full">
                <AccordionItem value="general">
                  <AccordionTrigger className="text-left text-lg">
                    <TranslatedText
                      ns="accounting"
                      translationKey="Presentation.General.Title"
                      fallbackText="General accounting"
                    />
                  </AccordionTrigger>
                  <AccordionContent>
                    <p className="mb-4 text-muted-foreground">
                      <TranslatedText
                        ns="accounting"
                        translationKey="Presentation.General.Desc"
                        fallbackText="We master all aspects of general accounting, from ledger to financial statements, ensuring accuracy and compliance."
                      />
                    </p>
                    <IconList
                      namespace="accounting"
                      icon={<CheckCircle className="w-4 h-4 text-primary" />}
                      items={[
                        { key: "Presentation.General.List.0", fallbackText: "Tailored chart of accounts" },
                        { key: "Presentation.General.List.1", fallbackText: "Accounts payable and receivable" },
                        { key: "Presentation.General.List.2", fallbackText: "Payment management" },
                        { key: "Presentation.General.List.3", fallbackText: "Treasury management" },
                      ]}
                    />
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="analytic">
                  <AccordionTrigger className="text-left text-lg">
                    <TranslatedText
                      ns="accounting"
                      translationKey="Presentation.Analytic.Title"
                      fallbackText="Analytical accounting"
                    />
                  </AccordionTrigger>
                  <AccordionContent>
                    <p className="text-muted-foreground">
                      <TranslatedText
                        ns="accounting"
                        translationKey="Presentation.Analytic.Desc"
                        fallbackText="We help you set up and analyze an effective analytical accounting system to support better decisions."
                      />
                    </p>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="periodic">
                  <AccordionTrigger className="text-left text-lg">
                    <TranslatedText
                      ns="accounting"
                      translationKey="Presentation.Periodic.Title"
                      fallbackText="Periodic tasks"
                    />
                  </AccordionTrigger>
                  <AccordionContent>
                    <p className="mb-4 text-muted-foreground">
                      <TranslatedText
                        ns="accounting"
                        translationKey="Presentation.Periodic.Desc"
                        fallbackText="We prepare your periodic returns and obligations with rigor and timeliness."
                      />
                    </p>
                    <IconList
                      namespace="accounting"
                      icon={<CheckCircle className="w-4 h-4 text-primary" />}
                      items={[
                        { key: "Presentation.Periodic.List.0", fallbackText: "Interim and/or annual closing" },
                        { key: "Presentation.Periodic.List.1", fallbackText: "VAT semi-annual or quarterly" },
                        { key: "Presentation.Periodic.List.2", fallbackText: "Social insurances" },
                        { key: "Presentation.Periodic.List.3", fallbackText: "Tax return" },
                        { key: "Presentation.Periodic.List.4", fallbackText: "Ordinary and extraordinary general meetings" },
                        { key: "Presentation.Periodic.List.5", fallbackText: "Board of directors" },
                      ]}
                    />
                    <p className="mt-4 text-muted-foreground">
                      <TranslatedText
                        ns="accounting"
                        translationKey="Presentation.Periodic.Followup"
                        fallbackText="Our dedicated team supports you at every step, ensuring transparent and optimized management."
                      />
                    </p>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="dashboards">
                  <AccordionTrigger className="text-left text-lg">
                    <TranslatedText
                      ns="accounting"
                      translationKey="Presentation.Dashboards.Title"
                      fallbackText="Dashboards"
                    />
                  </AccordionTrigger>
                  <AccordionContent>
                    <p className="text-muted-foreground">
                      <TranslatedText
                        ns="accounting"
                        translationKey="Presentation.Dashboards.Desc"
                        fallbackText="Optimize visibility and control with intuitive accounting dashboards tailored to your needs."
                      />
                    </p>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </section>

            {/* Custom services as highlighted cards */}
            <section>
              <h3 className="text-xl xs:text-2xl md:text-2xl font-bold mb-8 md:leading-[2rem] tracking-tight">
                <TranslatedText
                  ns="accounting"
                  translationKey="Presentation.Custom.Title"
                  fallbackText="Custom Services"
                />
              </h3>
              <div className="space-y-4 mb-8">
                <TranslatedObjectArray
                  ns="accounting"
                  translationKey="Presentation.CustomServicesList"
                  fallbackItems={[
                    { Title: "Expertise and experience", Desc: "Our team brings years of experience in Swiss accounting standards." },
                    { Title: "Personalized approach", Desc: "We analyze your situation to offer tailored solutions." },
                    { Title: "Compliance and security", Desc: "We guarantee compliance with all legal obligations." },
                  ]}
                  renderItem={(item, index) => (
                    <div
                      key={index}
                      className="flex items-start gap-4 px-6 py-4 rounded-lg bg-primary/5 mb-4"
                    >
                      <CheckCircle className="text-blue-400 mt-1 min-w-[20px]" size={20} />
                      <div>
                        <span className="font-semibold block text-lg mb-2">{item.Title}</span>
                        <span className="text-base leading-relaxed">{item.Desc}</span>
                      </div>
                    </div>
                  )}
                />
              </div>
            </section>

            {/* Services list */}
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
                fallbackText={["Service 1: Description", "Service 2: Description", "Service 3: Description", "Service 4: Description"]}
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
