import { useTranslation } from "react-i18next";
import { CheckCircle } from "lucide-react";
import { StylishList } from "@/src/components/ui/stylish-list";
import TranslatedText from "@/src/components/ui/translated-text";

const AccountingPresentation = () => {
  const { t } = useTranslation();
  return (
    <section
      className="max-w-screen-xl mx-auto w-full py-12 xs:py-20 px-4 sm:px-6 flex flex-col items-center"
      id="presentation"
    >
      <h1 className="max-w-3xl text-3xl xs:text-4xl md:text-5xl md:leading-[3.5rem] font-bold tracking-tight mb-8 text-left w-full">
        <TranslatedText
          translationKey={"Accounting.Presentation.Title"}
          fallbackText={"Accounting"}
        />
      </h1>
      <h2 className="text-xl xs:text-2xl md:text-2xl font-bold mb-8 md:leading-[2rem] tracking-tight">
        <TranslatedText
          translationKey={"Accounting.Presentation.Subtitle"}
          fallbackText={"Subtitle"}
        />
      </h2>
      {(
        t("Accounting.Presentation.Intro", { returnObjects: true }) as string[]
      ).map((text, idx) => (
        <p key={idx} className="mb-8 text-lg text-justify">
          {text}
        </p>
      ))}
      <StylishList
        items={
          t("Accounting.Presentation.General.List", {
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
          translationKey={"Accounting.Presentation.Experts.Title"}
          fallbackText={"Experts"}
        />
      </h3>
      <p className="mb-8 text-lg text-justify">
        <TranslatedText
          translationKey={"Accounting.Presentation.Experts.Desc"}
          fallbackText={"Description"}
        />
      </p>
    </section>
  );
};

export default AccountingPresentation;
