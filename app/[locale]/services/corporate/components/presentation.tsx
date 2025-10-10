import { CheckCircle } from "lucide-react";
import { getTranslations, getCurrentLocale, type Locale } from "@/src/lib/i18n";
import ServicesListServer from "@/src/components/ui/services-list-server";
import { tidyTitle } from "@/src/lib/typography";

const CorporatePresentation = async () => {
  const locale: Locale = getCurrentLocale();
  const t = await getTranslations(locale, "corporate");
  const title = t("Presentation.Title") as string;
  const subtitle = t("Presentation.Subtitle") as string;
  const intro = (t("Presentation.Intro") as unknown as string[]) || [];
  const strengths = (t("Presentation.Strengths") as unknown as Array<{ Title: string; Desc: string }>) || [];
  const services = (t("Presentation.Services") as unknown as string[]) || [];

  return (
    <section className="mx-auto w-full py-12 xs:py-20 px-6 flex flex-col items-center pt-25">
      <div className="w-full max-w-[1200px]">
        <h1 className="text-3xl xs:text-4xl md:text-5xl md:leading-[3.5rem] font-bold tracking-tight mb-8 text-left w-full">
          {tidyTitle(title || "Corporate Services")}
        </h1>

          <h2 className="text-xl xs:text-2xl md:text-2xl font-bold mb-8 md:leading-[2rem] tracking-tight">
          {tidyTitle(subtitle || "Expert Corporate Services")}
          </h2>

        <div className="text-left w-full">
          <div className="space-y-6 mb-12">
            {(Array.isArray(intro) && intro.length > 0
              ? intro
              : [
                  "We provide comprehensive corporate services to help you manage your business structure and compliance effectively.",
                  "From company formation to ongoing corporate governance, we ensure your business operates smoothly and meets all regulatory requirements.",
                ]
            ).map((p, idx) => (
              <p key={idx} className="mb-6">
                {p}
              </p>
            ))}
          </div>

          <div className="space-y-16">
            <section>
              <h3 className="text-xl xs:text-2xl md:text-2xl font-bold mb-8 md:leading-[2rem] tracking-tight">
                {tidyTitle(((t("Presentation.StrengthsTitle") as string) || "Our Strengths"))}
              </h3>
              <div className="space-y-4 mb-8">
                {(Array.isArray(strengths) && strengths.length > 0
                  ? strengths
                  : [
                      {
                        Title: "Legal expertise",
                        Desc: "Deep knowledge of Swiss corporate law and regulations.",
                      },
                      {
                        Title: "Efficient processes",
                        Desc: "Streamlined procedures for quick and accurate results.",
                      },
                      {
                        Title: "Ongoing support",
                        Desc: "Continuous assistance for all your corporate needs.",
                      },
                    ]
                ).map((item, index) => (
                  <div
                    key={index}
                    className="flex items-start gap-4 px-6 py-4 rounded-lg bg-primary/5 mb-4"
                  >
                    <CheckCircle className="text-blue-400 mt-1 min-w-[20px]" size={20} />
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
                {tidyTitle(((t("Presentation.ServicesTitle") as string) || "Services"))}
              </h3>
              <ServicesListServer
                ns="corporate"
                translationKey="Presentation.Services"
                fallbackText={[
                  "Service 1: Description",
                  "Service 2: Description",
                  "Service 3: Description",
                  "Service 4: Description",
                ]}
                className="space-y-6"
                locale={locale}
              />
            </section>
          </div>
        </div>
      </div>
    </section>
  );
};

export default CorporatePresentation;
