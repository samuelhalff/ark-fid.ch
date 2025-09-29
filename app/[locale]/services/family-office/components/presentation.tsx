// "use client";

import React from "react";
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
    <section className="mx-auto w-full py-12 xs:py-20 px-6 flex flex-col items-center pt-25">
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
                  className="flex items-start gap-6 px-6 py-6 rounded-xl bg-muted/50 shadow-sm hover:shadow-md transition-shadow"
                >
                  <span className="mt-1">
                    <Icon className="text-primary min-w-[20px]" size={20} />
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

        <section className="rounded-xl border border-primary/20 bg-primary/5 p-12 text-center">
          <h3 className="text-2xl font-semibold mb-10">
            {t("Presentation.CalloutTitle")}
          </h3>
          <p className="text-lg leading-loose text-muted-foreground mb-12 mx-auto max-w-2xl">
            {t("Presentation.CalloutText")}
          </p>
          <Link
            href={`${localePrefix}/contact`}
            className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-base font-semibold text-primary-foreground transition hover:opacity-90"
          >
            {t("Presentation.CalloutCTA")}
          </Link>
        </section>
      </div>
    </section>
  );
};

export default FamilyOfficePresentation;
