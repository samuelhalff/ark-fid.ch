import React from "react";
import { FileText, FileSpreadsheet, File } from "lucide-react";
import Link from "next/link";
import TranslatedText from "@/src/components/ui/translated-text";

// Map file extensions to Lucide icons (fallback to FileText for Word/PDF)
const iconMap: Record<string, React.ReactNode> = {
  pdf: <FileText className="text-red-500" size={32} />,
  doc: <FileText className="text-blue-500" size={32} />,
  docx: <FileText className="text-blue-500" size={32} />,
  xls: <FileSpreadsheet className="text-green-500" size={32} />,
  xlsx: <FileSpreadsheet className="text-green-500" size={32} />,
  txt: <FileText className="text-gray-500" size={32} />,
};

interface Labels {
  ReadArticle?: string;
  Download?: string;
  By?: string;
  Published?: string;
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
}) => {
  const icon =
    type === "file" && extension ? (
      iconMap[extension] || <File className="text-gray-400" size={32} />
    ) : (
      <FileText className="text-primary" size={32} />
    );
  const cardContent = (
    <div className="flex flex-col border rounded-xl overflow-hidden shadow-none h-full cursor-pointer hover:shadow-lg transition-shadow bg-white dark:bg-muted p-5 group-hover:shadow-lg">
      <div className="flex items-center gap-3 mb-3">
        {icon}
        <h3 className="text-lg font-semibold flex-1">{title}</h3>
      </div>
      <p className="text-muted-foreground mb-4 flex-1">{description}</p>

      {/* Date and Author info */}
      {(date || author) && (
        <div className="text-xs text-muted-foreground mb-3">
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
      )}

      <div className="mt-auto text-blue-600 hover:underline font-medium">
        {type === "file"
          ? (labels && labels.Download) || "Download"
          : (labels && labels.ReadArticle) || "Read Article"}
      </div>
    </div>
  );
  if (type === "file") {
    return (
      <a
        href={href}
        download
        className="block h-full group transition-transform hover:scale-105"
      >
        {cardContent}
      </a>
    );
  } else {
    return (
      <Link
        href={href}
        target="_blank"
        className="block h-full group transition-transform hover:scale-105"
      >
        {cardContent}
      </Link>
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
