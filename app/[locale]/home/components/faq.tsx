import { getTranslations, getCurrentLocale, type Locale } from "@/src/lib/i18n";
import { tidyTitle } from "@/src/lib/typography";

// Inline Plus icon to eliminate lucide-react dependency
const PlusIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M5 12h14" />
    <path d="M12 5v14" />
  </svg>
);

const faq = Array.from({ length: 16 }).map((_, i) => ({
  questionKey: `Question${i + 1}`,
  answerKey: `Answer${i + 1}`,
}));

export default async function FAQ() {
  const locale: Locale = getCurrentLocale();
  const t = await getTranslations(locale, "faq");
  const title = (t("Title") as string) || "FAQ";
  const subtitle = (t("Subtitle") as string) || "";
  const lastUpdated = new Date();

  const items = faq
    .map(({ questionKey, answerKey }) => {
      const q = t(questionKey) as string;
      const a = t(answerKey) as string;
      return { questionKey, answerKey, q, a };
    })
    .filter(({ questionKey, answerKey, q, a }) => {
      const isMissingQ = !q || q === questionKey;
      const isMissingA = !a || a === answerKey;
      return !(isMissingQ || isMissingA);
    });

  return (
    <div
      id="faq"
      className="w-full max-w-[var(--breakpoint-xl)] mx-auto py-8 xs:py-16 px-6 mb-10"
    >
      {/* Hide default summary markers across browsers to avoid double icons */}
      <style>{`
        summary.faq-summary::-webkit-details-marker { display: none; }
        summary.faq-summary::marker { content: ""; }
        .faq-icon svg { width: 16px; height: 16px; }
      `}</style>
      <h2 className="text-center text-3xl xs:text-4xl md:text-5xl leading-[1.15]! font-bold tracking-tighter max-w-4xl mx-auto">
        {tidyTitle(title)}
      </h2>
      {subtitle && (
        <p className="mt-1.5 text-center xs:text-lg max-w-2xl mx-auto">{subtitle}</p>
      )}
      <p className="mt-1 text-center text-sm text-muted-foreground">
        <span>{(t("LastUpdated") as string) || "dernière mise à jour"}</span>{" "}
        <span suppressHydrationWarning>
          {new Intl.DateTimeFormat(undefined, {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
          }).format(lastUpdated)}
        </span>
      </p>

      {/* Use CSS columns to avoid the grid row-height coupling issue */}
      <div className="mt-8 columns-1 md:columns-2 gap-x-4">
        {items.map(({ q, a, questionKey }) => (
          <details
            key={questionKey}
            className="group bg-accent rounded-xl px-5 py-3 open:shadow-sm transition-shadow mb-4 break-inside-avoid"
          >
            <summary
              className="faq-summary flex items-center justify-between gap-4 cursor-pointer select-none py-1 pr-2"
            >
              <h3 className="font-semibold tracking-tight text-lg leading-snug">
                {q}
              </h3>
              <span className="faq-icon inline-flex h-7 w-7 items-center justify-center rounded-full bg-foreground/10 text-muted-foreground group-open:text-foreground/90 group-open:bg-foreground/15 transition-colors flex-none shrink-0">
                <PlusIcon className="transition-transform group-open:rotate-45" />
              </span>
            </summary>
            <div className="mt-2 pb-2 text-[15px] text-left text-muted-foreground">
              {a}
            </div>
          </details>
        ))}
      </div>
    </div>
  );
}
