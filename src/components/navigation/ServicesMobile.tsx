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

  function normalizeHref(href: string) {
    if (!href) return href;
    href = href.replace(/\/services\/services(\/|$)/, "/services/$1");
    href = href.replace(/([^:])\/+/g, "$1/");
    return href;
  }

  return (
    <div>
      <div className="flex items-center gap-3 text-md px-2 py-2 rounded font-medium border-b rounded-none border-muted">
        <span>{label || "Services"}</span>
      </div>
      <div className="flex flex-col mt-1 divide-y divide-muted/50 rounded-md overflow-hidden">
        {items.map((service) => (
          <Link
            key={service.href}
            href={`${localePrefix}${normalizeHref(service.href)}`}
            prefetch={false}
            onClick={onLinkClick}
            locale={locale}
            className="flex items-center justify-between gap-3 text-md px-4 py-3 hover:bg-accent focus:bg-accent focus:outline-none focus:ring-2 focus:ring-primary transition-colors"
          >
            <span className="block truncate" title={service.title}>
              {service.title}
            </span>
            <span aria-hidden className="text-muted-foreground">
              ›
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
