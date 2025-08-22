import { useTranslation } from "react-i18next";
import {
  CheckCircle,
  FileText,
  Briefcase,
  SearchCheck,
  Landmark,
} from "lucide-react";
import { StylishList } from "@/src/components/ui/stylish-list";
import TranslatedText from "@/src/components/ui/translated-text";

const iconMap = [FileText, Briefcase, SearchCheck, Landmark];

const Presentation = () => {
  const { t } = useTranslation();
  const services = t("Taxes.Presentation.Services", {
    returnObjects: true,
  }) as Array<{ Title: string; Desc: string }>;
  return (
    <section
      className="max-w-(--breakpoint-xl) mx-auto w-full py-12 xs:py-20 px-4 sm:px-6 flex flex-col items-center"
      id="presentation"
    >
      <h1 className="max-w-3xl text-3xl xs:text-4xl md:text-5xl md:leading-14 font-bold tracking-tight mb-8 text-left w-full">
        <TranslatedText
          translationKey={"Taxes.Presentation.Title"}
          fallbackText={"Taxes"}
        />
      </h1>
      <div className="max-w-3xl text-left">
        {(
          t("Taxes.Presentation.Intro", { returnObjects: true }) as string[]
        ).map((text, idx) => (
          <p key={idx} className="mb-6 text-lg text-justify">
            {text}
          </p>
        ))}
        <div className="space-y-12">
          <section>
            <h2 className="text-xl xs:text-2xl md:text-2xl font-bold mb-6 md:leading-8 tracking-tight text-left">
              {t("Taxes.Presentation.ExpertiseTitle")}
            </h2>
          </section>
          <section>
            <h3 className="text-2xl font-semibold mb-4">
              {t("Taxes.Presentation.ReinventedTitle")}
            </h3>
            {(
              t("Taxes.Presentation.Reinvented", {
                returnObjects: true,
              }) as string[]
            ).map((text, idx) => (
              <p key={idx} className="mb-6 text-justify">
                {text}
              </p>
            ))}
            <StylishList
              items={
                t("Taxes.Presentation.ReinventedList", {
                  returnObjects: true,
                }) as string[]
              }
              Icon={CheckCircle}
              iconClass="text-primary"
              bulletBg="bg-primary/5"
              className="mt-3 mb-6"
            />
            <p className="mb-6 text-justify">
              <TranslatedText
                translationKey={"Taxes.Presentation.ReinventedOutro"}
                fallbackText={"Outro"}
              />
            </p>
          </section>
          <section>
            <h3 className="text-2xl font-semibold mb-4">
              {t("Taxes.Presentation.ServicesTitle")}
            </h3>
            <ul className="space-y-6 mt-4">
              {services.map((item, idx) => {
                const Icon = iconMap[idx] || CheckCircle;
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
      </div>
    </section>
  );
};

export default Presentation;
