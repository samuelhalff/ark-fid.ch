import { useTranslation } from "react-i18next";

const LANGS = [
  { code: "en", label: "EN" },
  { code: "fr", label: "FR" },
  { code: "de", label: "DE" },
  { code: "es", label: "ES" },
];

export default function LangSwitchMobile() {
  const { i18n } = useTranslation();
  const current = i18n.language;
  return (
    <div className="flex items-center">
      <span className="flex items-center gap-3 p-2 text-muted-foreground">
        Language
      </span>
      <div className="flex gap-3 text-md p-1 ml-auto">
        {LANGS.map((lang) => (
          <button
            key={lang.code}
            aria-label={lang.label}
            onClick={() => i18n.changeLanguage(lang.code)}
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
