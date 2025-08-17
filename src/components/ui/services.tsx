import { Card, CardContent, CardHeader } from "@/components/ui/card";
import Service from "@/NavigationMenu/ServicesElements";
import { useTranslation } from "react-i18next";

const Services = () => {
  const { t } = useTranslation();
  return (
    <div
      id="services"
      className="max-w-screen-xl mx-auto w-full py-12 xs:py-20 px-6"
    >
      <h2 className="text-3xl xs:text-4xl md:text-5xl md:leading-[3.5rem] font-bold tracking-tight sm:max-w-xl sm:text-center sm:mx-auto">
        {t("Services.Title")}
      </h2>
      <div className="mt-8 xs:mt-14 w-full mx-auto grid md:grid-cols-2 lg:grid-cols-3 gap-x-10 gap-y-12">
        {Service.map((service) => (
          <Card
            key={service.titleKey}
            className="flex flex-col border rounded-xl overflow-hidden shadow-none"
          >
            <CardHeader style={{ padding: "1.5rem 1.5rem 0", minHeight: 190 }}>
              <div className="flex items-center gap-2 !mt-3 text-xl font-bold tracking-tight">
                {service.icon}
                <h4 className="text-left">{t(service.titleKey)}</h4>
              </div>
              <p className="mt-1 text-left text-muted-foreground text-sm xs:text-[17px]">
                {t(service.descriptionKey)}
              </p>
            </CardHeader>
            <CardContent className="px-0 pb-0">
              <div className="bg-muted h-55 ml-6 rounded-tl-xl">
                <img
                  src={service.image}
                  alt={t(service.titleKey)}
                  className="w-full h-full object-cover rounded-tl-xl"
                  style={{ objectFit: "cover", objectPosition: "0% 55%" }}
                />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default Services;
