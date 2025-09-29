"use client";

import {
  ShieldCheck,
  HandCoins,
  Gavel,
  Globe,
  HeartHandshake,
  Briefcase,
  Library,
  Building2,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import TranslatedText from "@/src/components/ui/translated-text";
import TranslatedTextArray from "@/src/components/ui/translated-text-array";
import TranslatedObjectArray from "@/src/components/ui/translated-object-array";
import ServicesList from "@/src/components/ui/services-list";

const serviceIcons = [
  Briefcase,
  HandCoins,
  Users,
  Library,
  HeartHandshake,
];

const highlightIcons = [ShieldCheck, HandCoins, Gavel, Globe];

const FamilyOfficePresentation = () => {
  const params = useParams<{ locale?: string }>();
  const localePrefix = params?.locale ? `/${params.locale}` : "/fr";

  return (
    <section className="mx-auto w-full py-12 xs:py-20 px-6 flex flex-col items-center pt-25">
      <div className="w-full max-w-[1200px] space-y-16">
        <header className="space-y-6 text-left">
          <h1 className="text-3xl xs:text-4xl md:text-5xl md:leading-[3.5rem] font-bold tracking-tight">
            <TranslatedText
              ns="family-office"
              translationKey="Presentation.Title"
              fallbackText="Family office advisory in Switzerland"
            />
          </h1>
          <h2 className="text-xl xs:text-2xl md:text-2xl font-semibold md:leading-[2rem] tracking-tight text-muted-foreground">
            <TranslatedText
              ns="family-office"
              translationKey="Presentation.Subtitle"
              fallbackText="Swiss multi-family office support for wealth, governance and succession."
            />
          </h2>
          <TranslatedTextArray
            ns="family-office"
            translationKey="Presentation.Intro"
            fallbackText={[
              "Ark Fiduciaire acts as your Swiss family office desk, coordinating wealth, governance and reporting for entrepreneurs and family shareholders.",
              "We consolidate banking, legal and tax stakeholders to protect and grow multi-generational wealth from Geneva and Lausanne.",
            ]}
            className="space-y-4 text-base leading-relaxed"
          />
        </header>

        <section className="space-y-6">
          <h3 className="text-xl xs:text-2xl md:text-2xl font-bold tracking-tight">
            <TranslatedText
              ns="family-office"
              translationKey="Presentation.HighlightsTitle"
              fallbackText="What sets our family office apart"
            />
          </h3>
          <TranslatedObjectArray
            ns="family-office"
            translationKey="Presentation.Highlights"
            fallbackItems={[
              {
                Title: "Independent Swiss oversight",
                Desc: "We coordinate banks, asset managers and trustees with no product bias.",
              },
              {
                Title: "360° coordination",
                Desc: "One lead advisor manages administration, tax, legal and lifestyle matters.",
              },
              {
                Title: "Governance & succession",
                Desc: "Support for family charters, shareholder agreements and education programmes.",
              },
              {
                Title: "Impact & philanthropy",
                Desc: "Design and administration of foundations and sustainable investment policies.",
              },
            ]}
            renderItem={(item, index) => {
              const Icon = highlightIcons[index] ?? Building2;
              return (
                <div
                  key={`${item.Title}-${index}`}
                  className="flex items-start gap-4 px-6 py-4 rounded-lg bg-primary/5"
                >
                  <Icon className="text-primary mt-1 min-w-[20px]" size={20} />
                  <div>
                    <span className="font-semibold block text-lg mb-2">
                      {item.Title}
                    </span>
                    <span className="text-base leading-relaxed text-muted-foreground">
                      {item.Desc}
                    </span>
                  </div>
                </div>
              );
            }}
          />
        </section>

        <section className="space-y-6">
          <h3 className="text-xl xs:text-2xl md:text-2xl font-bold tracking-tight">
            <TranslatedText
              ns="family-office"
              translationKey="Presentation.ServicesTitle"
              fallbackText="Flagship family office services"
            />
          </h3>
          <ServicesList
            ns="family-office"
            translationKey="Presentation.Services"
            fallbackText={[
              "Wealth structuring reviews · consolidation of holdings and balance sheets",
              "Cross-border tax and legal coordination · liaison with Swiss and international advisers",
              "Family governance facilitation · charters, councils and education workshops",
              "Deal and investment support · due diligence, documentation and follow-up",
              "Philanthropy and lifestyle administration · foundations, art, property and concierge oversight",
            ]}
            iconMap={serviceIcons}
            className="space-y-4"
          />
        </section>

        <section className="rounded-xl border border-primary/20 bg-primary/5 p-8 text-left">
          <h3 className="text-xl font-semibold mb-3">
            <TranslatedText
              ns="family-office"
              translationKey="Presentation.CalloutTitle"
              fallbackText="Secure your family legacy from Switzerland"
            />
          </h3>
          <p className="text-base leading-relaxed text-muted-foreground mb-4">
            <TranslatedText
              ns="family-office"
              translationKey="Presentation.CalloutText"
              fallbackText="Schedule a confidential strategy session with our Geneva or Lausanne team to map your priorities and define a governance roadmap."
            />
          </p>
          <Link
            href={`${localePrefix}/contact`}
            className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
          >
            <TranslatedText
              ns="family-office"
              translationKey="Presentation.CalloutCTA"
              fallbackText="Speak with a family office advisor"
            />
          </Link>
        </section>
      </div>
    </section>
  );
};

export default FamilyOfficePresentation;
