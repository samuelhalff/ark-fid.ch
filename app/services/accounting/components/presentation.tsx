"use client";

import {
  ListChecks,
  CalendarCheck2,
  Users,
  Clock,
  ShieldCheck,
  Rocket,
  MessageSquare,
  CheckCircle,
} from "lucide-react";
import { StylishList } from "@/src/components/ui/stylish-list";
import TranslatedText from "@/src/components/ui/translated-text";
import TranslatedTextArray from "@/src/components/ui/translated-text-array";
import { useTranslation } from "react-i18next";
import React from "react";
import { convertRawToList } from "@/lib/utils";

const iconMap = [Users, Clock, ShieldCheck, Rocket, MessageSquare];

const AccountingPresentation = () => {
  const { t } = useTranslation();
  const listItemsRaw = t("Accounting.Presentation.CustomServicesList", {
    returnObjects: true,
  }) as Array<{ titleKey: string; descKey: string }>;

  return (
    <section
      className="mx-auto w-full py-12 xs:py-20 px-6 flex flex-col items-center pt-25"
      id="presentation"
    >
      <h1 className="text-3xl xs:text-4xl md:text-5xl md:leading-[3.5rem] font-bold tracking-tight mb-8 text-left w-full">
        <TranslatedText
          translationKey="Accounting.Presentation.Title"
          fallbackText="Holistic Vision of Your Accounting"
        />
      </h1>

      <div className="text-left w-full">
        <h2 className="text-xl xs:text-2xl md:text-2xl font-bold mb-8 md:leading-[2rem] tracking-tight">
          <TranslatedText
            translationKey="Accounting.Presentation.Subtitle"
            fallbackText="A 360° Offer"
          />
        </h2>

        <div className="space-y-6 mb-12">
          <TranslatedTextArray
            translationKey="Accounting.Presentation.Intro"
            fallbackText={[
              "We are dedicated to providing comprehensive and personalized solutions, designed to address every facet of your financial and accounting needs with precision and insight.",
              "Beyond the numbers, we offer strategic advice aimed at supporting your growth, navigating challenges, and leveraging market opportunities with discernment. We are the strategic partner committed to your company's success.",
            ]}
          />
        </div>

        <div className="space-y-12">
          <section>
            <h3 className="text-2xl font-semibold mb-6">
              <TranslatedText
                translationKey="Accounting.Presentation.General.Title"
                fallbackText="General Accounting"
              />
            </h3>
            <p className="mb-8 text-lg text-muted-foreground">
              <TranslatedText
                translationKey="Accounting.Presentation.General.Desc"
                fallbackText="At Ark Fiduciaire, we master all aspects of general accounting, from the general ledger to financial statements and management accounting. Our professionals ensure that each book of accounts is up-to-date, accurate, and compliant with industry standards and current regulations."
              />
            </p>
            <StylishList
              items={
                (t("Accounting.Presentation.General.List", {
                  returnObjects: true,
                }) as string[]) || []
              }
              Icon={ListChecks}
              iconClass="text-blue-400"
              bulletBg="light:bg-primary/5 dark:bg-primary/15"
              className="mt-3 mb-2"
            />
          </section>

          <section>
            <h3 className="text-2xl font-semibold mb-6">
              <TranslatedText
                translationKey="Accounting.Presentation.Analytic.Title"
                fallbackText="Analytical Accounting"
              />
            </h3>
            <p className="mb-8 text-lg text-muted-foreground">
              <TranslatedText
                translationKey="Accounting.Presentation.Analytic.Desc"
                fallbackText="Analytical accounting is a powerful tool for understanding where and how you generate profits, as well as identifying areas that need attention. Our experts at Ark Fiduciaire will help you set up and analyze an effective analytical accounting system that will enable you to make more informed business decisions."
              />
            </p>
          </section>

          <section>
            <h3 className="text-2xl font-semibold mb-6">
              <TranslatedText
                translationKey="Accounting.Presentation.Periodic.Title"
                fallbackText="Periodic Tasks"
              />
            </h3>
            <p className="mb-8 text-lg text-muted-foreground">
              <TranslatedText
                translationKey="Accounting.Presentation.Periodic.Desc"
                fallbackText="Experience peace of mind through our expertise in establishing periodic statements for all your obligations, including:"
              />
            </p>
            <StylishList
              items={
                (t("Accounting.Presentation.Periodic.List", {
                  returnObjects: true,
                }) as string[]) || []
              }
              Icon={CalendarCheck2}
              iconClass="text-green-500"
              bulletBg="light:bg-primary/5 dark:bg-primary/15"
              className="mt-3 mb-2"
            />
          </section>

          <section>
            <h3 className="text-2xl font-semibold mb-6">
              <TranslatedText
                translationKey="Accounting.Presentation.Dashboards.Title"
                fallbackText="Dashboards"
              />
            </h3>
            <p className="mb-8 text-lg text-muted-foreground">
              <TranslatedText
                translationKey="Accounting.Presentation.Dashboards.Desc"
                fallbackText="Optimize the visibility and control of your finances with our innovative accounting dashboard solutions. The dashboards provide a clear and accessible summary of your financial data, enabling informed and strategic decision-making. Enjoy simplified management through intuitive dashboards tailored to your specific needs. With a user-friendly interface and precise analytics, our solutions ensure effective monitoring of your financial health."
              />
            </p>
          </section>
          <StylishList
            items={
              t("Accounting.Presentation.List", {
                returnObjects: true,
              }) as string[]
            }
            Icon={CheckCircle}
            iconClass="text-blue-400"
            bulletBg="bg-primary/5"
            className="mt-3 mb-8"
          />
          <section>
            <h3 className="text-2xl font-semibold mb-6">
              <TranslatedText
                translationKey="Accounting.Presentation.Custom.Title"
                fallbackText="Custom Services"
              />
            </h3>
            <ul className="space-y-6 mt-4">
              {convertRawToList(listItemsRaw).map((item, idx) => (
                <li
                  key={idx}
                  className="flex items-start gap-4 px-4 py-3 rounded-xl bg-muted/50 shadow-none hover:shadow-md transition-shadow"
                >
                  <span className="mt-1">{item.icon}</span>
                  <div>
                    <span className="font-semibold text-lg">
                      <TranslatedText
                        translationKey={item.Title}
                        fallbackText={"Feature title"}
                      />
                    </span>
                    <span className="ml-1 text-lg text-muted-foreground">
                      :{" "}
                      <TranslatedText
                        translationKey={item.Desc}
                        fallbackText={"Feature description"}
                      />
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    </section>
  );
};

export default AccountingPresentation;
