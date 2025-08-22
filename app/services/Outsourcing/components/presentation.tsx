import { useTranslation } from "react-i18next";
import { CheckCircle } from "lucide-react";
import { StylishList } from "@/src/components/ui/stylish-list";
import TranslatedText from "@/src/components/ui/translated-text";

const OutsourcingPresentation = () => {
  const { t } = useTranslation();
  return (
    <section
      className="max-w-(--breakpoint-xl) mx-auto w-full py-12 xs:py-20 px-4 sm:px-6 flex flex-col items-center"
      id="presentation"
    >
      <h1 className="max-w-3xl text-3xl xs:text-4xl md:text-5xl md:leading-14 font-bold tracking-tight mb-8 text-left w-full">
        <TranslatedText
          translationKey={"Outsourcing.Presentation.Title"}
          fallbackText={"Outsourcing"}
        />
      </h1>
      <h2 className="text-xl xs:text-2xl md:text-2xl font-bold mb-8 md:leading-8 tracking-tight">
        <TranslatedText
          translationKey={"Outsourcing.Presentation.Subtitle"}
          fallbackText={"Subtitle"}
        />
      </h2>
      {(
        t("Outsourcing.Presentation.Intro", { returnObjects: true }) as string[]
      ).map((text, idx) => (
        <p key={idx} className="mb-8 text-lg text-justify">
          {text}
        </p>
      ))}
      <StylishList
        items={
          t("Outsourcing.Presentation.List", {
            returnObjects: true,
          }) as string[]
        }
        Icon={CheckCircle}
        iconClass="text-primary"
        bulletBg="bg-primary/5"
        className="mt-3 mb-8"
      />
      <h3 className="text-2xl font-semibold mb-6">
        <TranslatedText
          translationKey={"Outsourcing.Presentation.StrengthsTitle"}
          fallbackText={"Strengths"}
        />
      </h3>
      {(
        t("Outsourcing.Presentation.Strengths", {
          returnObjects: true,
        }) as Array<{ Title: string; Desc: string }>
      ).map((item, idx) => (
        <div key={idx} className="mb-6">
          <div className="font-semibold text-lg text-gray-900 dark:text-gray-100 mb-1">
            {item.Title}
          </div>
          <div className="text-lg text-gray-700 dark:text-gray-300">
            {item.Desc}
          </div>
        </div>
      ))}
    </section>
  );
};

export default OutsourcingPresentation;
