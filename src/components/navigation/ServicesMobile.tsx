"use client";
import ServicesElements from "@/app/[locale]/navigation";
import Link from "next/link";

interface ServicesMobileProps {
  onLinkClick?: () => void;
}

export default function ServicesMobile({
  onLinkClick,
  locale,
  services,
  label,
}: ServicesMobileProps & {
  locale?: string;
  services?: Array<{ href: string; title: string }>;
  label?: string;
}) {
  const localePrefix = locale ? `/${locale}` : "/fr";
  const items = (
    services && services.length
      ? services
      : ServicesElements.map((s) => ({ href: s.href, title: s.titleKey }))
  ) as Array<{
    href: string;
    title: string;
  }>;

  return (
    <div>
      <div className="flex items-center gap-3 text-md px-2 py-2 rounded font-medium border-b rounded-none border-muted">
        <span>{label || "Services"}</span>
      </div>
      <div className="flex flex-col mt-1">
        {items.map((service) => (
          <Link
            key={service.href}
            href={`${localePrefix}${service.href}`}
            prefetch={false}
            onClick={onLinkClick}
            locale={locale}
            className="flex items-center gap-4 text-md py-3 rounded hover:bg-accent transition-colors pl-6"
          >
            <span>{service.title}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
