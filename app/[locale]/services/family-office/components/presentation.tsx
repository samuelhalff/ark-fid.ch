// "use client";
import React from "react";
import ServiceExpertBanner from "@/src/components/ui/service-expert-banner";
import ServiceContactForm from "@/src/components/ui/service-contact-form";
import GoogleReviewsBadge from "@/src/components/ui/google-reviews-badge";
import ServiceLongForm from "@/src/components/ui/service-longform";
// Inline SVGs for icons (replace lucide-react)
const Briefcase = () => (
  <svg
    width="20"
    height="20"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="3" y="7" width="18" height="13" rx="2" />
    <path d="M8 7V5a4 4 0 0 1 8 0v2" />
  </svg>
);
const HandCoins = () => (
  <svg
    width="20"
    height="20"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="17" cy="7" r="3" />
    <path d="M2 15.5V17a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-1.5" />
    <path d="M2 15.5a2 2 0 0 1 2-2h7.5" />
  </svg>
);
const Users = () => (
  <svg
    width="20"
    height="20"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    {/* Centered single user silhouette for clarity at small sizes */}
    <circle cx="12" cy="7" r="4" />
    <path d="M6 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2" />
  </svg>
);
const Library = () => (
  <svg
    width="20"
    height="20"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="3" y="4" width="18" height="16" rx="2" />
    <path d="M7 4v16" />
    <path d="M17 4v16" />
  </svg>
);
const HeartHandshake = () => (
  <svg
    width="20"
    height="20"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M12 21s-8-7.58-8-12A5 5 0 0 1 12 4a5 5 0 0 1 8 5c0 4.42-8 12-8 12z" />
    <path d="M12 13l3-3" />
    <path d="M12 13l-3-3" />
  </svg>
);
const ShieldCheck = () => (
  <svg
    width="20"
    height="20"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M12 2l7 4v6c0 5.25-3.5 9.74-7 10-3.5-.26-7-4.75-7-10V6l7-4z" />
    <path d="M9 12l2 2 4-4" />
  </svg>
);
const Gavel = () => (
  <svg
    width="20"
    height="20"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="7" y="2" width="10" height="4" rx="1" />
    <rect x="2" y="7" width="4" height="10" rx="1" />
    <rect x="7" y="18" width="10" height="4" rx="1" />
    <path d="M2 22l20-20" />
  </svg>
);
const Globe = () => (
  <svg
    width="20"
    height="20"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="12" cy="12" r="10" />
    <path d="M2 12h20" />
    <path d="M12 2a15.3 15.3 0 0 1 0 20" />
    <path d="M12 2a15.3 15.3 0 0 0 0 20" />
  </svg>
);
const Building2 = () => (
  <svg
    width="20"
    height="20"
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="3" y="7" width="18" height="13" rx="2" />
    <path d="M8 7V5a4 4 0 0 1 8 0v2" />
  </svg>
);
import Link from "next/link";
const serviceIcons = [Briefcase, HandCoins, Users, Library, HeartHandshake];
const highlightIcons = [ShieldCheck, HandCoins, Gavel, Globe];
const FamilyOfficePresentation = ({
  locale,
  t,
}: {
  locale: string;
  t: (key: string) => any;
}) => {
  // const params = useParams<{ locale?: string }>();
  const localePrefix = locale ? `/${locale}` : "/fr";
  return (
    <section data-service-content className="mx-auto w-full py-12 xs:py-20 px-6 flex flex-col items-center pt-25">
      <div className="w-full max-w-[1200px] space-y-16">
        <header className="space-y-6 text-left">
          <h1 className="text-3xl xs:text-4xl md:text-5xl md:leading-[3.5rem] font-bold tracking-tight">
            {t("Presentation.Title")}
          </h1>
          <h2 className="text-xl xs:text-2xl md:text-2xl font-semibold md:leading-[2rem] tracking-tight text-muted-foreground">
            {t("Presentation.Subtitle")}
          </h2>
          <div className="space-y-4 text-base leading-relaxed">
            {t("Presentation.Intro").map((text: string, index: number) => (
              <p key={index} className="text-muted-foreground">
                {text}
              </p>
            ))}
          </div>
        </header>
        <section className="space-y-6">
          <h3 className="text-xl xs:text-2xl md:text-2xl font-bold tracking-tight">
            {t("Presentation.HighlightsTitle")}
          </h3>
          <div className="space-y-5">
            {t("Presentation.Highlights").map((item: any, index: number) => {
              const Icon = highlightIcons[index] ?? Building2;
              return (
                <div
                  key={`${item.Title}-${index}`}
                  className="flex items-center gap-5 px-6 py-5 rounded-lg bg-primary/5"
                >
                  <span className="ui-icon inline-flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary ring-1 ring-primary/20 shrink-0">
                    <Icon />
                  </span>
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
            })}
          </div>
        </section>
        <section className="space-y-6">
          <h3 className="text-xl xs:text-2xl md:text-2xl font-bold tracking-tight">
            {t("Presentation.ServicesTitle")}
          </h3>
          <div className="space-y-4">
            {t("Presentation.Services").map((text: string, index: number) => {
              const [title, ...descParts] = text.split(":");
              const desc = descParts.join(":").trim();
              const Icon = serviceIcons[index % serviceIcons.length];
              return (
                <div
                  key={index}
                  className="flex items-center gap-6 px-6 py-6 rounded-xl bg-muted/50 shadow-sm hover:shadow-md transition-shadow"
                >
                  <span className="ui-icon inline-flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary ring-1 ring-primary/20 shrink-0">
                    <Icon />
                  </span>
                  <div>
                    <span className="font-semibold text-lg text-gray-900 dark:text-gray-100 block mb-2">
                      {title}
                    </span>
                    {desc && (
                      <span className="text-lg text-gray-700 dark:text-gray-300">
                        {desc}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
        <ServiceLongForm t={t} />
        <section className="rounded-xl border border-primary/20 bg-primary/5 p-12 text-center">
          <h3 className="text-2xl font-semibold mb-10">
            {t("Presentation.CalloutTitle")}
          </h3>
          <p className="text-lg leading-loose text-muted-foreground mb-12 mx-auto max-w-2xl">
            {t("Presentation.CalloutText")}
          </p>
          <Link
            href={`${localePrefix}/contact/`}
            className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-base font-semibold text-primary-foreground transition hover:opacity-90"
          >
            {t("Presentation.CalloutCTA")}
          </Link>
        </section>
        <ServiceContactForm locale={locale} />
        <div className="flex justify-center">
          <GoogleReviewsBadge locale={locale} />
        </div>
        <ServiceExpertBanner locale={locale} />
      </div>
    </section>
  );
};
export default FamilyOfficePresentation;
