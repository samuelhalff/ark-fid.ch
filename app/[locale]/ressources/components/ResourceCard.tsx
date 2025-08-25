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

interface ResourceCardProps {
  type: "file" | "article";
  title: string;
  description: string;
  href: string;
  extension?: string;
  date?: string;
  author?: string;
}

const ResourceCard: React.FC<ResourceCardProps> = ({
  type,
  title,
  description,
  href,
  extension,
  date,
  author,
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
              <TranslatedText
                ns="ressources"
                translationKey="By"
                fallbackText="By"
              />{" "}
              {author}
            </p>
          )}
          {date && (
            <p>
              <TranslatedText
                ns="ressources"
                translationKey="Published"
                fallbackText="Published on"
              />{" "}
              {new Date(date).toLocaleDateString()}
            </p>
          )}
        </div>
      )}

      <div className="mt-auto text-blue-600 hover:underline font-medium">
        {type === "file" ? (
          <TranslatedText
            ns="ressources"
            translationKey="Download"
            fallbackText="Download"
          />
        ) : (
          <TranslatedText
            ns="ressources"
            translationKey="ReadArticle"
            fallbackText="Read Article"
          />
        )}
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
