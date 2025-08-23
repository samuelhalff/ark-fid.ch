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
}

const ResourceCard: React.FC<ResourceCardProps> = ({
  type,
  title,
  description,
  href,
  extension,
}) => {
  const icon =
    type === "file" && extension ? (
      iconMap[extension] || <File className="text-gray-400" size={32} />
    ) : (
      <FileText className="text-primary" size={32} />
    );
  return (
    <div className="bg-white dark:bg-muted rounded-xl shadow-md hover:shadow-lg transition-shadow p-5 flex flex-col h-full">
      <div className="flex items-center gap-3 mb-3">
        {icon}
        <h3 className="text-lg font-semibold flex-1">{title}</h3>
      </div>
      <p className="text-muted-foreground mb-4 flex-1">{description}</p>
      {type === "file" ? (
        <a
          href={href}
          download
          className="mt-auto text-blue-600 hover:underline font-medium"
        >
          <TranslatedText
            ns="ressources"
            translationKey="Download"
            fallbackText="Download"
          />
        </a>
      ) : (
        <Link
          href={href}
          className="mt-auto text-blue-600 hover:underline font-medium"
          target="_blank"
        >
          <TranslatedText
            ns="ressources"
            translationKey="ReadArticle"
            fallbackText="Read Article"
          />
        </Link>
      )}
    </div>
  );
};

export default ResourceCard;
