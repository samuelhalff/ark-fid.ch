"use client";

import { useTranslation } from "react-i18next";
import "@/src/i18n";

const About = () => {
  const { t } = useTranslation("home");

  const content = t("About.Content", {
    returnObjects: true,
  }) as string[];

  return (
    <section className="mx-auto w-full py-12 xs:py-20 px-6 flex flex-col items-center">
      <div className="w-full max-w-[1200px]">
        <h2 className="text-3xl xs:text-4xl md:text-5xl font-bold tracking-tight mb-8 text-center">
          {t("About.Title")}
        </h2>

        <div className="text-left w-full space-y-8">
          {content.map((paragraph: string, index: number) => (
            <p key={index}>{paragraph}</p>
          ))}

          <div className="grid md:grid-cols-2 gap-8 mt-12">
            <div className="space-y-4">
              <h3 className="text-2xl font-semibold">
                {t("About.Quality.Title")}
              </h3>
              <p>{t("About.Quality.Content")}</p>
            </div>

            <div className="space-y-4">
              <h3 className="text-2xl font-semibold">
                {t("About.Innovation.Title")}
              </h3>
              <p>{t("About.Innovation.Content")}</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default About;
