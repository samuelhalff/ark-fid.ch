"use client";
import { useTranslation } from "react-i18next";
import TranslatedText from "@/src/components/ui/translated-text";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

const LANGS = [
  { code: "en", label: "EN" },
  { code: "fr", label: "FR" },
  { code: "de", label: "DE" },
  { code: "es", label: "ES" },
];

interface LangSwitchMobileProps {
  onLocaleChange?: () => void;
}

export default function LangSwitchMobile({
  onLocaleChange,
}: LangSwitchMobileProps) {
  const { i18n } = useTranslation();
  const current = i18n.language;
  const router = useRouter();
  const pathname = usePathname() || "/";
  const searchParams = useSearchParams();

  function navigateToLocale(targetLocale: string) {
    const parts = pathname.replace(/^\/+|\/+$/g, "").split("/");
    const valid = ["en", "fr", "de", "es", "pt"];
    if (valid.includes(parts[0])) parts[0] = targetLocale;
    else parts.unshift(targetLocale);
    const qs = searchParams?.toString();
    const newPath = `/${parts.join("/")}${qs ? `?${qs}` : ""}`;
    router.push(newPath);
    if (onLocaleChange) onLocaleChange();
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
        {LANGS.map((lang) => (
          <button
            key={lang.code}
            aria-label={lang.label}
            onClick={() => navigateToLocale(lang.code)}
            className={`p-3.5 rounded text-sm font-medium ${
              current === lang.code ? "bg-accent" : ""
            }`}
          >
            {lang.label}
          </button>
        ))}
      </div>
    </div>
  );
}
