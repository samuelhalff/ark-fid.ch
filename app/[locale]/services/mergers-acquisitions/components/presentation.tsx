import Link from "next/link";
import { Suspense } from "react";
import dynamic from "next/dynamic";
import { getCurrentLocale, getTranslations, type Locale } from "@/src/lib/i18n";
import { localizePath } from "@/src/lib/paths";
import { tidyTitle } from "@/src/lib/typography";

const ServicesListServer = dynamic(
  () => import("@/src/components/ui/services-list-server"),
  { suspense: true }
);

const Check = (props: { className?: string }) => (
  <svg
    viewBox="0 0 24 24"
    width="20"
    height="20"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={`ui-icon ${props?.className || ""}`}
    {...props}
  >
    <path d="M9 12l2 2 4-4" />
    <circle cx="12" cy="12" r="9" />
  </svg>
);

const MAPresentation = async () => {
  const locale: Locale = getCurrentLocale();
  const t = await getTranslations(locale, "mna");
  const localePrefix = `/${locale}`;
  const title = t("Presentation.Title") as string;
  const subtitle = t("Presentation.Subtitle") as string;
  const intro = (t("Presentation.Intro") as unknown as string[]) || [];
  const partnerNote = t("Presentation.PartnerNote") as string;
  const partnerLinkLabel = t("Presentation.PartnerLinkLabel") as string;
  const strengths =
    (t("Presentation.Strengths") as unknown as Array<{
      Title: string;
      Desc: string;
    }>) || [];

  return (
    <section className="mx-auto w-full py-12 xs:py-20 px-6 flex flex-col items-center pt-25">
      <div className="w-full max-w-[1200px]">
        <h1 className="text-3xl xs:text-4xl md:text-5xl md:leading-[3.5rem] font-bold tracking-tight mb-8 text-left w-full">
          {tidyTitle(title || "Swiss M&A advisory for SMEs")}
        </h1>
        <h2 className="text-xl xs:text-2xl md:text-2xl font-bold mb-8 md:leading-[2rem] tracking-tight">
          {tidyTitle(subtitle || "Guiding founders through each transaction step")}
        </h2>

        <div className="text-left w-full">
          <div className="space-y-6 mb-12">
            {(Array.isArray(intro) && intro.length > 0
              ? intro
              : [
                  "We advise Swiss entrepreneurs and investors on buy-side and sell-side mandates with a focus on deals up to the mid-market size.",
                  "Our team blends financial modelling, company valuation, deal structuring and post-merger integration planning backed by Swiss regulatory know-how.",
                ]
            ).map((p, idx) => (
              <p key={idx} className="mb-6">
                {p}
              </p>
            ))}
            {partnerNote && (
              <p className="mb-6">
                {partnerNote}{" "}
                <Link
                  href={`${localePrefix}${localizePath("/partners", locale)}/`}
                  className="text-primary hover:underline"
                  prefetch={false}
                >
                  {partnerLinkLabel || "Discover our partners"}
                </Link>
                .
              </p>
            )}
          </div>

          <div className="space-y-16">
            <section>
              <h3 className="text-xl xs:text-2xl md:text-2xl font-bold mb-8 md:leading-[2rem] tracking-tight">
                {tidyTitle(
                  (t("Presentation.StrengthsTitle") as string) || "How we support your deal"
                )}
              </h3>
              <div className="space-y-4 mb-8">
                {(Array.isArray(strengths) && strengths.length > 0
                  ? strengths
                  : [
                      {
                        Title: "Sector aware advice",
                        Desc: "Experience with Swiss industrial, services and tech SMEs so we can benchmark terms, valuation ranges and buyer expectations.",
                      },
                      {
                        Title: "Process discipline",
                        Desc: "Clear milestones for due diligence, vendor data rooms, management presentations and negotiation rounds.",
                      },
                      {
                        Title: "Integration and succession focus",
                        Desc: "We anticipate people, tax and reporting impacts so the post-merger integration or succession handover runs smoothly.",
                      },
                    ]
                ).map((item, index) => (
                  <div
                    key={index}
                    className="flex items-start gap-4 px-6 py-4 rounded-lg bg-primary/5 mb-4"
                  >
                    <Check className="text-blue-400 mt-1 min-w-[20px]" />
                    <div>
                      <span className="font-semibold block text-lg mb-2">
                        {item.Title}
                      </span>
                      <span className="text-base leading-relaxed">{item.Desc}</span>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section>
              <h3 className="text-xl xs:text-2xl md:text-2xl font-bold mb-8 md:leading-[2rem] tracking-tight">
                {tidyTitle(
                  (t("Presentation.ServicesTitle") as string) || "M&A services"
                )}
              </h3>
              <Suspense
                fallback={
                  <div className="space-y-4">
                    <div className="h-24 rounded-lg bg-muted/40" />
                    <div className="h-24 rounded-lg bg-muted/40" />
                    <div className="h-24 rounded-lg bg-muted/40" />
                  </div>
                }
              >
                <ServicesListServer
                  ns="mna"
                  translationKey="Presentation.Services"
                  fallbackText={[
                    "Buy-side and sell-side advisory mandates",
                    "Financial modelling and valuation analyses",
                    "Coordination of due diligence and data rooms",
                    "Post-merger integration planning",
                  ]}
                  className="space-y-6"
                  locale={locale}
                />
              </Suspense>
            </section>
          </div>
        </div>
      </div>
    </section>
  );
};

export default MAPresentation;
