"use client";
import { useTranslation } from "react-i18next";
import TranslatedText from "@/src/components/ui/translated-text";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

const LANGS = [
  { code: "en", label: "EN" },
  { code: "fr", label: "FR" },
  { code: "de", label: "DE" },
  { code: "es", label: "ES" },
  { code: "pt", label: "PT" },
];

interface LangSwitchMobileProps {
  onLocaleChange?: () => void;
}

export default function LangSwitchMobile({
  onLocaleChange,
}: LangSwitchMobileProps) {
  const { i18n } = useTranslation();
  // normalize current language to 2-letter code in case of regional tags
  const current = (i18n.language || "fr").slice(0, 2);
  const router = useRouter();
  const pathname = usePathname() || "/";
  const searchParams = useSearchParams();

  function buildHref(targetLocale: string) {
    const parts = pathname.replace(/^\/+|\/+$/g, "").split("/");
    const valid = ["en", "fr", "de", "es", "pt"];
    if (valid.includes(parts[0])) parts[0] = targetLocale;
    else parts.unshift(targetLocale);
    const qs = searchParams?.toString();
    return `/${parts.join("/")}${qs ? `?${qs}` : ""}`;
  }

  return (
    <div className="flex items-center">
      <span className="flex items-center gap-3 p-2">
        <TranslatedText
          ns="navbar"
          translationKey="Language"
          fallbackText="Language"
        />
      </span>
      <div className="flex gap-3 text-md p-1 ml-auto">
        {LANGS.filter((l) => l.code !== current).map((lang) => {
          const href = buildHref(lang.code);
          return (
            <Link
              key={lang.code}
              href={href}
              prefetch={false}
              hrefLang={lang.code}
              rel="alternate"
              aria-label={lang.label}
              onClick={() => onLocaleChange && onLocaleChange()}
              className={`p-3.5 rounded text-sm font-medium ${
                current === lang.code ? "bg-accent" : ""
              }`}
            >
              {lang.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
