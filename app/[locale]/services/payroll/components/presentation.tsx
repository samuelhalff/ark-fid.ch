const Check = (props: any) => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M9 12l2 2 4-4" />
    <circle cx="12" cy="12" r="9" />
  </svg>
);
import { getTranslations, getCurrentLocale, type Locale } from "@/src/lib/i18n";
import { tidyTitle } from "@/src/lib/typography";
import ServicesListServer from "@/src/components/ui/services-list-server";


const PayrollPresentation = async () => {
  const locale: Locale = getCurrentLocale();
  const t = await getTranslations(locale, "payroll");
  const title = (t("Presentation.Title") as string) || "Payroll Presentation";
  const subtitle = (t("Presentation.Subtitle") as string) || "Professional Payroll services";
  const intro = (t("Presentation.Intro") as unknown as string[]) || [
    "We provide comprehensive payroll services to ensure your employees are paid accurately and on time.",
    "Our expert team handles all aspects of payroll processing, from salary calculations to tax deductions and compliance reporting.",
  ];
  const strengths = (t("Presentation.Strengths") as unknown as Array<{ Title: string; Desc: string }>) || [
    { Title: "Accuracy and reliability", Desc: "Precise calculations and timely payroll processing." },
    { Title: "Compliance expertise", Desc: "Full adherence to Swiss employment and tax laws." },
    { Title: "Confidential handling", Desc: "Secure and confidential management of sensitive data." },
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
                    <Check className="text-blue-400 mt-1 min-w-[20px]" />
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
              <ServicesListServer ns="payroll" translationKey="Presentation.Services" fallbackText={services} className="space-y-6" locale={locale} />
            </section>
          </div>
        </div>
      </div>
    </section>
  );
};

export default PayrollPresentation;
