import { CheckCircle } from "lucide-react";
import { getTranslations, getCurrentLocale, type Locale } from "@/src/lib/i18n";
import { tidyTitle } from "@/src/lib/typography";
import ServicesListServer from "@/src/components/ui/services-list-server";


const OdooPresentation = async () => {
  const locale: Locale = getCurrentLocale();
  const t = await getTranslations(locale, "odoo");
  const title = (t("Presentation.Title") as string) || "Odoo Presentation";
  const subtitle = (t("Presentation.Subtitle") as string) || "Complete Business Management Solution";
  const intro = (t("Presentation.Intro") as unknown as string[]) || [
    "Odoo is a comprehensive business management suite that integrates all your business processes into one unified platform.",
    "From CRM and sales to accounting and inventory, we help you implement and optimize Odoo for your specific needs.",
  ];
  const strengths = (t("Presentation.Strengths") as unknown as Array<{ Title: string; Desc: string }>) || [
    { Title: "Implementation expertise", Desc: "Deep knowledge of Odoo modules and best practices." },
    { Title: "Custom solutions", Desc: "Tailored implementations to match your business processes." },
    { Title: "Ongoing support", Desc: "Continuous assistance and system optimization." },
  ];
  const services = (t("Presentation.Services") as unknown as string[]) || [
    "Service 1: Description",
    "Service 2: Description",
    "Service 3: Description",
    "Service 4: Description",
  ];
  return (
    <section className="mx-auto w-full py-12 xs:py-20 px-6 flex flex-col items-center pt-25">
      <div className="w-full max-w-[1200px]">
        <h1 className="text-3xl xs:text-4xl md:text-5xl md:leading-[3.5rem] font-bold tracking-tight mb-8 text-left w-full">
          {tidyTitle(title)}
        </h1>

          <h2 className="text-xl xs:text-2xl md:text-2xl font-bold mb-8 md:leading-[2rem] tracking-tight">
          {tidyTitle(subtitle)}
          </h2>

        <div className="text-left w-full">
          <div className="space-y-6 mb-12">
            {intro.map((text, idx) => (
              <p key={idx} className="mb-8 text-lg">{text}</p>
            ))}
          </div>

          <div className="space-y-16">
            <section>
              <h3 className="text-xl xs:text-2xl md:text-2xl font-bold mb-8 md:leading-[2rem] tracking-tight">{tidyTitle(((t("Presentation.StrengthsTitle") as string) || "Our Strengths"))}</h3>
              <div className="space-y-4 mb-8">
                {strengths.map((item, index) => (
                  <div key={index} className="flex items-start gap-4 px-6 py-4 rounded-lg bg-primary/5 mb-4">
                    <CheckCircle className="text-blue-400 mt-1 min-w-[20px]" size={20} />
                    <div>
                      <span className="font-semibold block text-lg mb-2">{item.Title}</span>
                      <span className="text-base leading-relaxed">{item.Desc}</span>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section>
              <h3 className="text-xl xs:text-2xl md:text-2xl font-bold mb-8 md:leading-[2rem] tracking-tight">{tidyTitle(((t("Presentation.ServicesTitle") as string) || "Services"))}</h3>
              <ServicesListServer ns="odoo" translationKey="Presentation.Services" fallbackText={services} className="space-y-6" locale={locale} />
            </section>
          </div>
        </div>
      </div>
    </section>
  );
};

export default OdooPresentation;
