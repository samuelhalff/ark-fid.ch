import {
  Building2,
  UserCheck,
  FileText,
  CheckCircle,
  Lightbulb,
} from "lucide-react";
import { StylishList } from "@/src/components/ui/stylish-list";
import { useTranslation } from "react-i18next";

const iconMap = [Building2, UserCheck, FileText, CheckCircle, Lightbulb];

const Presentation = () => {
  const { t } = useTranslation();
  const strengths = t("Corporate.Presentation.Strengths", {
    returnObjects: true,
  }) as Array<{ Title: string; Desc: string }>;
  const iconList = iconMap;
  return (
    <section
      className="max-w-(--breakpoint-xl) mx-auto w-full py-12 xs:py-20 px-4 sm:px-6 flex flex-col items-center pt-25"
      id="presentation"
    >
      <h1 className="max-w-3xl text-3xl xs:text-4xl md:text-5xl md:leading-14 font-bold tracking-tight mb-8 text-left w-full">
        {t("Corporate.Presentation.Title")}
      </h1>
      <div className="max-w-3xl text-left">
        <h2 className="text-xl xs:text-2xl md:text-2xl font-bold mb-8 md:leading-8 tracking-tight">
          {t("Corporate.Presentation.Subtitle")}
        </h2>
        {(
          t("Corporate.Presentation.Intro", { returnObjects: true }) as string[]
        ).map((text, idx) => (
          <p key={idx} className="mb-8 text-lg text-justify">
            {text}
          </p>
        ))}
        <StylishList
          items={
            t("Corporate.Presentation.List", {
              returnObjects: true,
            }) as string[]
          }
          Icon={CheckCircle}
          iconClass="text-primary"
          bulletBg="bg-primary/5"
          className="mt-3 mb-8"
        />
        <section>
          <h3 className="text-2xl font-semibold mb-6">
            {t("Corporate.Presentation.StrengthsTitle")}
          </h3>
          <ul className="space-y-6 mt-4">
            {strengths.map((item, idx) => {
              const Icon = iconList[idx] || CheckCircle;
              return (
                <li
                  key={idx}
                  className="flex items-start gap-4 px-4 py-3 rounded-xl bg-muted/50 shadow-none hover:shadow-md transition-shadow"
                >
                  <span className="mt-1">
                    <Icon className="text-primary min-w-[22px]" size={22} />
                  </span>
                  <div>
                    <span className="font-semibold text-lg text-gray-900 dark:text-gray-100">
                      {item.Title}
                    </span>
                    <span className="ml-1 text-lg text-gray-700 dark:text-gray-300">
                      : {item.Desc}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      </div>
    </section>
  );
};

export default Presentation;
