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
    badge: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
    accent: "bg-blue-500",
  },
  {
    badge:
      "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
    accent: "bg-emerald-500",
  },
  {
    badge:
      "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300",
    accent: "bg-violet-500",
  },
  {
    badge:
      "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
    accent: "bg-amber-500",
  },
  {
    badge: "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300",
    accent: "bg-rose-500",
  },
  {
    badge: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300",
    accent: "bg-cyan-500",
  },
];

interface ResourceCardProps {
  title: string;
  description: string;
  href: string;
  date?: string;
  author?: string;
  labels?: Labels;
  colorIndex?: number;
}

const ResourceCard: React.FC<ResourceCardProps> = ({
  title,
  description,
  href,
  date,
  author,
  labels,
  colorIndex = 0,
}) => {
  const colors = cardColors[colorIndex % cardColors.length];

  return (
    <Reveal delay={Math.min(colorIndex * 0.04, 0.24)} className="h-full">
    <a
      href={href}
      className="group relative flex h-full flex-col rounded-[24px] border border-border/70 bg-gradient-to-br from-muted/55 via-background to-muted/20 p-5 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md dark:border-white/[0.08] dark:hover:bg-white/[0.06]"
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        {date ? (
          <time
            dateTime={new Date(date).toISOString()}
            className={`inline-flex items-center rounded-full px-2.5 py-1 text-[0.7rem] font-semibold uppercase tracking-[0.16em] ${colors.badge}`}
          >
            {formatDateDeterministic(date)}
          </time>
        ) : (
          <span className={`inline-flex h-7 w-7 items-center justify-center rounded-full ${colors.badge}`}>
            <span className={`h-2 w-2 rounded-full ${colors.accent}`} />
          </span>
        )}
        {author ? (
          <span className="text-[0.72rem] font-medium uppercase tracking-[0.14em] text-muted-foreground">
            {author}
          </span>
        ) : null}
      </div>

      <h3 className="mb-3 text-lg font-semibold leading-snug tracking-tight text-foreground transition-colors duration-200 group-hover:text-primary">
        {title}
      </h3>

      <p className="mb-4 flex-1 text-sm leading-relaxed text-muted-foreground">
        {description}
      </p>

      <div className="flex items-center justify-between border-t border-border/60 pt-4">
        <span className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
          {(labels && labels.Published) || "Publié"}
        </span>
        <span className="inline-flex items-center gap-1.5 text-sm font-medium text-primary transition-all duration-200 group-hover:gap-2.5">
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

export default ResourceCard;

function formatDateDeterministic(date?: string) {
  if (!date) return "";
  try {
    // Use a fixed locale to produce consistent server/client output (day/month/year)
    return new Intl.DateTimeFormat("en-GB", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).format(new Date(date));
  } catch (e) {
    // Fallback to ISO date if formatting fails
    return new Date(date).toISOString().split("T")[0];
  }
}
