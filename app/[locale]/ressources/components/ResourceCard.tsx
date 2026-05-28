import React from "react";
import Reveal from "@/src/components/motion/reveal";

interface Labels {
  ReadArticle?: string;
  By?: string;
  Published?: string;
}

// Color palette for visual variety
const cardColors = [
  {
    badge:
      "bg-brand-soft text-brand-hover dark:bg-brand/15 dark:text-brand",
  },
  {
    badge:
      "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  },
  {
    badge:
      "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300",
  },
  {
    badge:
      "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  },
  {
    badge: "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300",
  },
  {
    badge:
      "bg-stone-100 text-stone-700 dark:bg-stone-800 dark:text-stone-200",
  },
];

interface ResourceCardProps {
  title: string;
  description: string;
  href: string;
  date?: string;
  author?: string;
  category?: string;
  locale?: string;
  labels?: Labels;
  colorIndex?: number;
}

const ResourceCard: React.FC<ResourceCardProps> = ({
  title,
  description,
  href,
  date,
  category,
  locale,
  labels,
  colorIndex = 0,
}) => {
  const colors = cardColors[colorIndex % cardColors.length];
  const formattedDate = formatResourceDate(date, locale);

  return (
    <Reveal delay={Math.min(colorIndex * 0.04, 0.24)} className="h-full">
    <a
      href={href}
      className="group relative flex h-full flex-col rounded-[18px] bg-card p-5 shadow-sm transition-colors duration-200 hover:bg-surface-warm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand dark:hover:bg-surface-warm"
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        {category ? (
          <span className={`w-fit rounded-full px-2.5 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.16em] ${colors.badge}`}>
            {category}
          </span>
        ) : (
          <span />
        )}
        {formattedDate ? (
          <span className="text-[0.68rem] font-medium uppercase tracking-[0.14em] text-muted-foreground/75">
            {formattedDate}
          </span>
        ) : null}
      </div>

      <h3 className="mb-3 text-lg font-semibold leading-snug tracking-tight text-foreground">
        {title}
      </h3>

      <p className="mb-4 flex-1 text-sm leading-relaxed text-muted-foreground">
        {description}
      </p>

      <div className="flex items-center justify-end pt-4">
        <span className="inline-flex items-center gap-1.5 text-sm font-medium text-primary transition-colors duration-200 group-hover:text-brand-hover">
          {(labels && labels.ReadArticle) || "Read"}
          <svg
            className="w-4 h-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M13 7l5 5m0 0l-5 5m5-5H6"
            />
          </svg>
        </span>
      </div>
    </a>
    </Reveal>
  );
};

function formatResourceDate(date?: string, locale = "fr") {
  if (!date) return null;
  const parsed = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return date;
  return new Intl.DateTimeFormat(locale, {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(parsed);
}

export default ResourceCard;
