import React from "react";

function ArticleIcon({
  className = "",
  size = 28,
}: {
  className?: string;
  size?: number;
}) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
      focusable="false"
    >
      <path d="M14 2H7a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="8" y1="13" x2="16" y2="13" />
      <line x1="8" y1="17" x2="16" y2="17" />
    </svg>
  );
}

interface Labels {
  ReadArticle?: string;
  By?: string;
  Published?: string;
}

interface ResourceCardProps {
  title: string;
  description: string;
  href: string;
  date?: string;
  author?: string;
  labels?: Labels;
}
const ResourceCard: React.FC<ResourceCardProps> = ({
  title,
  description,
  href,
  date,
  author,
  labels,
}) => {
  const cardContent = (
    <div className="flex flex-col border rounded-xl overflow-hidden shadow-sm h-full cursor-pointer hover:shadow-md transition-shadow bg-white dark:bg-muted p-5">
      <div className="flex items-start gap-3 mb-3">
        <div className="mt-0.5 flex-shrink-0">
          <ArticleIcon className="text-primary" size={28} />
        </div>
        <h3 className="text-lg font-semibold leading-snug tracking-tight flex-1 text-foreground">
          {title}
        </h3>
      </div>
      <p className="mb-4 flex-1 text-sm text-muted-foreground">{description}</p>

      {/* Date and Author info */}
      {(date || author) && (
        <>
          <div className="text-xs mb-2">
            {author && (
              <p>
                {(labels && labels.By) || "By"} {author}
              </p>
            )}
            {date && (
              <p>
                {(labels && labels.Published) || "Published on"}{" "}
                <time dateTime={new Date(date).toISOString()}>
                  {formatDateDeterministic(date)}
                </time>
              </p>
            )}
          </div>
          <div className="border-t border-border/20 dark:border-border/10 my-2" />
        </>
      )}
      <div className="mt-2 text-primary hover:underline font-medium">
        {(labels && labels.ReadArticle) || "Read Article"}
      </div>
    </div>
  );
  return (
    <a
      href={href}
      target="_blank"
      className="block h-full group transition-transform hover:scale-105"
    >
      {cardContent}
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
