"use client";
import services from "@/app/[locale]/navigation";
import TranslatedText from "@/src/components/ui/translated-text";
import Link from "next/link";

interface ServicesMobileProps {
  onLinkClick?: () => void;
}

export default function ServicesMobile({
  onLinkClick,
  locale,
}: ServicesMobileProps & { locale?: string }) {
  const localePrefix = locale ? `/${locale}` : "/fr";

  return (
    <div>
      <div className="flex items-center gap-3 text-md px-2 py-2 rounded font-medium text-muted-foreground border-b rounded-none border-muted">
        <span>Services</span>
      </div>
      <div className="flex flex-col mt-1">
        {services.map((service) => (
          <Link
            key={service.href}
            href={`${localePrefix}${service.href}`}
            onClick={onLinkClick}
            className="flex items-center gap-4 text-md py-3 rounded hover:bg-accent transition-colors pl-6"
          >
            <span>
              <TranslatedText
                ns="servicesItems"
                translationKey={service.titleKey}
                fallbackText={service.titleKey}
              />
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
