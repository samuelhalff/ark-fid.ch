import React from "react";
import { FileText, FileSpreadsheet, File } from "lucide-react";

// Map file extensions to Lucide icons (fallback to FileText for Word/PDF)
const iconMap: Record<string, React.ReactNode> = {
  pdf: <FileText className="text-red-500" size={28} />,
  doc: <FileText className="text-blue-500" size={28} />,
  docx: <FileText className="text-blue-500" size={28} />,
  xls: <FileSpreadsheet className="text-green-500" size={28} />,
  xlsx: <FileSpreadsheet className="text-green-500" size={28} />,
  txt: <FileText className="text-gray-500" size={28} />,
};

interface Labels {
  ReadArticle?: string;
  Download?: string;
  By?: string;
  Published?: string;
  Source?: string;
}

interface ResourceCardProps {
  type: "file" | "article";
  title: string;
  description: string;
  href: string;
  extension?: string;
  date?: string;
  author?: string;
  labels?: Labels;
  source?: string;
}
const ResourceCard: React.FC<ResourceCardProps> = ({
  type,
  title,
  description,
  href,
  extension,
  date,
  author,
  labels,
  source,
}) => {
  const icon =
    type === "file" && extension ? (
      iconMap[extension] || <File className="text-gray-400" size={28} />
    ) : (
      <FileText className="text-primary" size={28} />
    );
  const cardContent = (
    <div className="flex flex-col border rounded-xl overflow-hidden shadow-sm h-full cursor-pointer hover:shadow-md transition-shadow bg-white dark:bg-muted p-5">
      <div className="flex items-start gap-3 mb-3">
        <div className="mt-0.5 flex-shrink-0">{icon}</div>
        <h3 className="text-lg font-semibold leading-snug tracking-tight flex-1 text-foreground">
          {title}
        </h3>
      </div>
      <p className="mb-4 flex-1 text-sm text-muted-foreground">{description}</p>

      {/* Date and Author info */}
      {(date || author) && (
        <>
          <div className="text-xs mb-2">
            {author && type === "article" && (
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
        {type === "file"
          ? (labels && labels.Download) || "Download"
          : (labels && labels.ReadArticle) || "Read Article"}
      </div>
      {type === "file" && source && (
        <div className="mt-1">
          <a
            href={source}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary underline-offset-2 hover:underline"
            aria-label={`${
              (labels && labels.Source) || "Source"
            }: ${formatDisplayUrl(source)}`}
          >
            {(labels && labels.Source) || "Source"}: {formatDisplayUrl(source)}
          </a>
        </div>
      )}
    </div>
  );
  if (type === "file") {
    // On the client, we can't check the filesystem; link to the local file path.
    // The CI job downloads PDFs into public/assets/downloads, so this should work in prod.
    const effectiveHref = href;
    return (
      <a
        href={effectiveHref}
        download
        className="block h-full group transition-transform hover:scale-105"
      >
        {cardContent}
      </a>
    );
  } else {
    return (
      <a
        href={href}
        target="_blank"
        className="block h-full group transition-transform hover:scale-105"
      >
        {cardContent}
      </a>
    );
  }
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

function formatDisplayUrl(url: string) {
  try {
    const { hostname, pathname } = new URL(url);
    // Show host and first path segment for brevity
    const cleanPath = pathname.replace(/\/$/, "");
    const parts = cleanPath.split("/").filter(Boolean);
    const first = parts[0] ? `/${parts[0]}` : "";
    return `${hostname}${first}`;
  } catch {
    return url;
  }
}
