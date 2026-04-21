import { getTranslations, type Locale } from "@/src/lib/i18n";
import React from "react";

interface ServicesListServerProps {
  ns: string;
  translationKey: string; // e.g. "Presentation.Services"
  fallbackText: string[]; // ["Title: Desc", ...]
  icons?: React.ReactNode[]; // Optional per-item inline SVGs
  className?: string;
  locale?: Locale;
}

export default async function ServicesListServer({
  ns,
  translationKey,
  fallbackText,
  icons,
  className = "space-y-6 mt-4",
  locale = "fr",
}: ServicesListServerProps) {
  const t = await getTranslations(locale, ns);
  const raw = t(translationKey) as unknown;
  const items = Array.isArray(raw) && raw.length > 0 ? (raw as string[]) : fallbackText;
  // Professional, neutral inline SVG icon set (no external lib, no emoji)
  const DefaultIcons: React.ReactNode[] = [
    // Briefcase
    (
      <svg key="briefcase" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M9 7V6a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v1"/>
        <rect x="3" y="7" width="18" height="12" rx="2"/>
        <path d="M3 12h18"/>
      </svg>
    ),
    // Users
    (
      <svg key="users" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
        <circle cx="9" cy="7" r="3"/>
        <path d="M22 21v-2a4 4 0 0 0-3-3.87"/>
        <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
      </svg>
    ),
    // File/Doc
    (
      <svg key="file" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
        <path d="M14 2v6h6"/>
        <path d="M16 13H8M16 17H8M10 9H8"/>
      </svg>
    ),
    // Shield
    (
      <svg key="shield" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
      </svg>
    ),
    // Cog
    (
      <svg key="cog" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <circle cx="12" cy="12" r="3"/>
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
      </svg>
    ),
    // Bar chart
    (
      <svg key="barchart" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M3 3v18h18"/>
        <rect x="7" y="9" width="3" height="7"/>
        <rect x="12" y="5" width="3" height="11"/>
        <rect x="17" y="12" width="3" height="4"/>
      </svg>
    ),
    // Clipboard
    (
      <svg key="clipboard" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <rect x="8" y="2" width="8" height="4" rx="1"/>
        <rect x="4" y="6" width="16" height="14" rx="2"/>
        <path d="M9 10h6M9 14h6"/>
      </svg>
    ),
  ];

  return (
    <div className={className}>
      {items.map((text, idx) => {
        const [title, ...rest] = String(text).split(":");
        const desc = rest.join(":").trim();
        const IconNode = icons && icons[idx % icons.length] ? icons[idx % icons.length] : DefaultIcons[idx % DefaultIcons.length];
        return (
          <div key={idx} className="flex items-center gap-5 sm:gap-6 px-6 sm:px-8 py-6 my-5 rounded-xl bg-card ring-1 ring-border/50 dark:bg-muted/50 dark:ring-0 shadow-sm hover:shadow-md transition-shadow overflow-hidden">
            <span className="ui-icon inline-flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground ring-1 ring-primary/20 dark:bg-primary/10 dark:text-primary shrink-0">
              {IconNode}
            </span>
            <div className="min-w-0">
              <span className="font-semibold text-base sm:text-lg text-foreground block mb-2 break-anywhere">{title}</span>
              {desc && <span className="text-sm sm:text-base text-muted-foreground break-anywhere leading-relaxed">{desc}</span>}
            </div>
          </div>
        );
      })}
    </div>
  );
}
