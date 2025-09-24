"use client";

import TranslatedText from "@/src/components/ui/translated-text";
import IconList from "@/src/components/ui/icon-list";

export default function AccountingAccordion() {
  return (
    <div className="space-y-6">
      <section>
        <h3 className="text-left text-lg font-semibold">
          <TranslatedText
            ns="accounting"
            translationKey="Presentation.General.Title"
            fallbackText="General accounting"
          />
        </h3>
        <p className="mb-4 text-muted-foreground">
          <TranslatedText
            ns="accounting"
            translationKey="Presentation.General.Desc"
            fallbackText="We master all aspects of general accounting, from ledger to financial statements, ensuring accuracy and compliance."
          />
        </p>
        <IconList
          namespace="accounting"
          icon={
            <svg
              className="w-4 h-4 text-primary"
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
          }
          items={[
            {
              key: "Presentation.General.List.0",
              fallbackText: "Tailored chart of accounts",
            },
            {
              key: "Presentation.General.List.1",
              fallbackText: "Accounts payable and receivable",
            },
            {
              key: "Presentation.General.List.2",
              fallbackText: "Payment management",
            },
            {
              key: "Presentation.General.List.3",
              fallbackText: "Treasury management",
            },
          ]}
        />
      </section>

      <section>
        <h3 className="text-left text-lg font-semibold">
          <TranslatedText
            ns="accounting"
            translationKey="Presentation.Analytic.Title"
            fallbackText="Analytical accounting"
          />
        </h3>
        <p className="text-muted-foreground">
          <TranslatedText
            ns="accounting"
            translationKey="Presentation.Analytic.Desc"
            fallbackText="We help you set up and analyze an effective analytical accounting system to support better decisions."
          />
        </p>
      </section>

      <section>
        <h3 className="text-left text-lg font-semibold">
          <TranslatedText
            ns="accounting"
            translationKey="Presentation.Periodic.Title"
            fallbackText="Periodic tasks"
          />
        </h3>
        <p className="mb-4 text-muted-foreground">
          <TranslatedText
            ns="accounting"
            translationKey="Presentation.Periodic.Desc"
            fallbackText="We prepare your periodic returns and obligations with rigor and timeliness."
          />
        </p>
        <IconList
          namespace="accounting"
          icon={
            <svg
              className="w-4 h-4 text-primary"
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
          }
          items={[
            {
              key: "Presentation.Periodic.List.0",
              fallbackText: "Interim and/or annual closing",
            },
            {
              key: "Presentation.Periodic.List.1",
              fallbackText: "VAT semi-annual or quarterly",
            },
            {
              key: "Presentation.Periodic.List.2",
              fallbackText: "Social insurances",
            },
            { key: "Presentation.Periodic.List.3", fallbackText: "Tax return" },
            {
              key: "Presentation.Periodic.List.4",
              fallbackText: "Ordinary and extraordinary general meetings",
            },
            {
              key: "Presentation.Periodic.List.5",
              fallbackText: "Board of directors",
            },
          ]}
        />
        <p className="mt-4 text-muted-foreground">
          <TranslatedText
            ns="accounting"
            translationKey="Presentation.Periodic.Followup"
            fallbackText="Our dedicated team supports you at every step, ensuring transparent and optimized management."
          />
        </p>
      </section>

      <section>
        <h3 className="text-left text-lg font-semibold">
          <TranslatedText
            ns="accounting"
            translationKey="Presentation.Dashboards.Title"
            fallbackText="Dashboards"
          />
        </h3>
        <p className="text-muted-foreground">
          <TranslatedText
            ns="accounting"
            translationKey="Presentation.Dashboards.Desc"
            fallbackText="Optimize visibility and control with intuitive accounting dashboards tailored to your needs."
          />
        </p>
      </section>
    </div>
  );
}
