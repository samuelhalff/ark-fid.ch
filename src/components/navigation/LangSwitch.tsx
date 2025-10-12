"use client";
import React, { useMemo } from "react";
import { usePathname, useSearchParams } from "next/navigation";
// Use plain <a> for full document reload on language change
import type { Locale } from "@/src/lib/i18n";

const VALID_LOCALES = ["en", "fr", "de", "es", "pt"] as const;

const isValidLocale = (value: string): value is Locale =>
  VALID_LOCALES.includes(value as Locale);

export default function LangSwitch(): React.ReactElement {
  const pathname = usePathname() || "/";
  const searchParams = useSearchParams();

  // Determine active locale from the URL to avoid hydration flashes
  const activeLang = useMemo<Locale>(() => {
    const seg0 = pathname.replace(/^\/+|\/+$/g, "").split("/")[0];
    return seg0 && isValidLocale(seg0) ? seg0 : "fr";
  }, [pathname]);

  function buildHref(targetLocale: string) {
    const segments = pathname.replace(/^\/+|\/+$/g, "").split("/");
    let newSegments: string[];
    const firstSegment = segments[0];
    if (firstSegment && isValidLocale(firstSegment)) {
      segments[0] = targetLocale;
      newSegments = segments;
    } else {
      newSegments = [targetLocale, ...segments.filter(Boolean)];
    }
    const qs = searchParams?.toString();
    return `/${newSegments.join("/")}${qs ? `?${qs}` : ""}`;
  }

  const handleChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const targetLocale = event.target.value;
    window.location.href = buildHref(targetLocale);
  };

  return (
    <div className="md:ml-30">
      <select
        value={activeLang}
        onChange={handleChange}
        className="flex items-center gap-1 px-2 min-w-[56px] justify-center bg-transparent border-none cursor-pointer hover:bg-accent rounded-lg transition-colors"
        aria-label="Select language"
      >
        <option value="en">EN</option>
        <option value="fr">FR</option>
        <option value="de">DE</option>
        <option value="es">ES</option>
        <option value="pt">PT</option>
      </select>
    </div>
  );
}
