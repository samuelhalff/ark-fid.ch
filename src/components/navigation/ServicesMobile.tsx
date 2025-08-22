import services from "@/app/services/navigation";
import { useTranslation } from "react-i18next";
import TranslatedText from "@/src/components/ui/translated-text";

export default function ServicesMobile() {
  const { t } = useTranslation();
  return (
    <div>
      <div className="flex items-center gap-3 text-md px-2 py-2 rounded font-medium text-muted-foreground border-b rounded-none border-muted">
        <span>Services</span>
      </div>
      <div className="flex flex-col mt-1">
        {services.map((service) => (
          <a
            key={service.href}
            href={service.href}
            className="flex items-center gap-4 text-md py-3 rounded hover:bg-accent transition-colors pl-6"
          >
            <span>
              <TranslatedText
                translationKey={service.titleKey}
                fallbackText={service.titleKey.replace("NavBar.", "")}
              />
            </span>
          </a>
        ))}
      </div>
    </div>
  );
}
