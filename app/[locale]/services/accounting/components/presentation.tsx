import Defer from "@/src/components/Defer";
import AccountingAccordion from "./sections/AccountingAccordion";
import ServicesListSection from "./sections/ServicesListSection";
import ServiceLongForm from "@/src/components/ui/service-longform";
import ServiceExpertBanner from "@/src/components/ui/service-expert-banner";
import { getCurrentLocale, type Locale } from "@/src/lib/i18n";

const AccountingPresentation = ({ t }: { t: (key: string) => string }) => {
  const locale: Locale = getCurrentLocale();
  return (
    <section data-service-content className="mx-auto w-full py-12 xs:py-20 px-6 flex flex-col items-center pt-25">
      <div className="w-full max-w-[1200px]">
        <h1 className="text-3xl xs:text-4xl md:text-5xl md:leading-[3.5rem] font-bold tracking-tight mb-8 text-left w-full">
          {t("Presentation.Title") || "Holistic Vision of Your Accounting"}
        </h1>

        <h2 className="text-xl xs:text-2xl md:text-2xl font-bold mb-8 md:leading-[2rem] tracking-tight">
          {t("Presentation.Subtitle") || "A 360° Offer"}
        </h2>

        <div className="text-left w-full">
          <div className="space-y-6 mb-12">
            {(Array.isArray(t("Presentation.Intro"))
              ? (t("Presentation.Intro") as unknown as string[])
              : [
                  "We provide comprehensive accounting services for businesses of all sizes. Our expert team ensures your financial records are accurate, compliant, and optimized for growth.",
                  "From basic bookkeeping to complex financial analysis, we handle all aspects of your accounting needs with precision and professionalism.",
                ]
            ).map((text, index) => (
              <p key={index} className="mb-8 text-lg">
                {text}
              </p>
            ))}
          </div>
          {/* Top-level key points list */}
          <div className="mb-12">
            {/* Keep top-level key points lightweight; icon rendered inline to avoid large icon libs here */}
            <div className="grid gap-3">
              {[
                {
                  key: "Presentation.List.0",
                  fallbackText: "General accounting",
                },
                {
                  key: "Presentation.List.1",
                  fallbackText: "Analytical accounting",
                },
                { key: "Presentation.List.2", fallbackText: "Periodic tasks" },
                { key: "Presentation.List.3", fallbackText: "Dashboards" },
                { key: "Presentation.List.4", fallbackText: "Custom services" },
              ].map((item, index) => (
                <div key={index} className="flex items-start gap-3">
                  <div className="mt-0.5 flex-shrink-0">
                    <svg
                      className="ui-icon w-4 h-4 text-primary"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path d="M9 12l2 2 4-4" />
                      <circle cx="12" cy="12" r="9" />
                    </svg>
                  </div>
                  <p className="text-muted-foreground">
                    {t(item.key) || item.fallbackText}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-16">
            {/* Detailed sections using Accordion (deferred island) */}
            <section>
              <Defer
                rootMargin="200px"
                idle={150}
                placeholder={
                  <div className="h-40 w-full rounded-lg bg-muted/40" />
                }
              >
                <AccountingAccordion />
              </Defer>
            </section>

            {/* Custom services as highlighted cards */}
            <section>
              <h3 className="text-xl xs:text-2xl md:text-2xl font-bold mb-8 md:leading-[2rem] tracking-tight">
                {t("Presentation.Custom.Title") || "Custom Services"}
              </h3>
              <div className="space-y-4 mb-8">
                {(() => {
                  const translatedList = t("Presentation.CustomServicesList");
                  const items = Array.isArray(translatedList)
                    ? translatedList
                    : [
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
                      ];
                  return items.map((item, index) => (
                    <div
                      key={index}
                      className="flex items-start gap-4 px-6 py-4 rounded-lg bg-primary/5 mb-4"
                    >
                      <svg
                        className="ui-icon text-blue-400 mt-1 min-w-[20px]"
                        width={20}
                        height={20}
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={2}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                      >
                        <path d="M9 12l2 2 4-4" />
                        <circle cx="12" cy="12" r="9" />
                      </svg>
                      <div>
                        <span className="font-semibold block text-lg mb-2">
                          {item.Title}
                        </span>
                        <span className="text-base leading-relaxed">
                          {item.Desc}
                        </span>
                      </div>
                    </div>
                  ));
                })()}
              </div>
            </section>

            {/* Services list (deferred island) */}
            <section>
              <Defer
                rootMargin="200px"
                idle={150}
                placeholder={
                  <div className="h-48 w-full rounded-lg bg-muted/40" />
                }
              >
                <ServicesListSection />
              </Defer>
            </section>

            <ServiceLongForm t={t} />
            <ServiceExpertBanner locale={locale} />
          </div>
        </div>
      </div>
    </section>
  );
};

export default AccountingPresentation;
