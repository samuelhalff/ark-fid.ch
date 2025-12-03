import React from "react";

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
    <a
      href={href}
      className="group relative flex flex-col h-full rounded-2xl p-6 bg-white dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800 transition-all duration-300 hover:border-slate-200 dark:hover:border-slate-700 hover:shadow-md hover:shadow-slate-200/50 dark:hover:shadow-slate-900/50"
    >
      {/* Subtle top accent line on hover */}
      <div
        className={`absolute top-0 left-6 right-6 h-0.5 ${colors.accent} rounded-full opacity-0 group-hover:opacity-60 transition-opacity duration-300`}
      />

      {/* Date badge with color */}
      {date && (
        <div className="mb-4">
          <time
            dateTime={new Date(date).toISOString()}
            className={`inline-flex items-center px-2.5 py-1 text-xs font-medium rounded-md ${colors.badge}`}
          >
            {formatDateDeterministic(date)}
          </time>
        </div>
      )}

      {/* Title */}
      <h3 className="text-lg font-semibold leading-snug tracking-tight text-foreground group-hover:text-primary transition-colors duration-200 mb-3">
        {title}
      </h3>

      {/* Description */}
      <p className="flex-1 text-sm text-muted-foreground leading-relaxed mb-4">
        {description}
      </p>

      {/* Footer with author and read more */}
      <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-slate-800">
        {author && (
          <p className="text-xs text-muted-foreground">
            <span className="text-foreground/70 font-medium">{author}</span>
          </p>
        )}
        <span className="inline-flex items-center gap-1.5 text-sm font-medium text-primary group-hover:gap-2.5 transition-all duration-200">
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
