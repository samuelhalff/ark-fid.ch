import React from "react";
import { ExternalLink, FileText, LinkIcon } from "lucide-react";
import Link from "next/link";

interface ItemCardProps {
  title: string | React.ReactNode;
  description: string | React.ReactNode;
  link?: string;
  type?: "external" | "internal" | "file" | "partner";
  icon?: React.ReactNode;
  className?: string;
  linkText?: string;
}

const ItemCard: React.FC<ItemCardProps> = ({
  title,
  description,
  link,
  type = "external",
  icon,
  className = "",
  linkText,
}) => {
  const getIcon = () => {
    if (icon) return icon;

    switch (type) {
      case "file":
        return <FileText className="w-6 h-6 text-primary" />;
      case "partner":
        return <LinkIcon className="w-6 h-6 text-primary" />;
      default:
        return <ExternalLink className="w-4 h-4 text-primary" />;
    }
  };

  const getDefaultLinkText = () => {
    switch (type) {
      case "file":
        return "Download";
      case "partner":
        return "Visit Website";
      case "internal":
        return "Learn More";
      default:
        return "Visit Link";
    }
  };

  const cardContent = (
    <div
      className={`bg-white dark:bg-gray-800 rounded-xl shadow-md hover:shadow-lg transition-all duration-300 hover:scale-[1.02] p-6 h-full ${className}`}
    >
      <div className="flex items-start gap-3 mb-4">
        <div className="flex-shrink-0 mt-1">{getIcon()}</div>
        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-semibold leading-tight">{title}</h3>
        </div>
      </div>
      <div className="flex flex-col h-full">
        <p className="text-muted-foreground leading-relaxed flex-1 mb-4">
          {description}
        </p>

        {link && (
          <div className="mt-auto">
            <span className="inline-flex items-center gap-2 text-sm text-primary hover:underline font-medium">
              {linkText || getDefaultLinkText()}
              {type === "external" && <ExternalLink className="w-3 h-3" />}
            </span>
          </div>
        )}
      </div>
    </div>
  );

  if (!link) {
    return cardContent;
  }

  if (type === "internal") {
    return (
      <Link href={link} className="block">
        {cardContent}
      </Link>
    );
  }

  if (type === "file") {
    return (
      <a href={link} download className="block">
        {cardContent}
      </a>
    );
  }

  // External links
  return (
    <a href={link} target="_blank" rel="noopener noreferrer" className="block">
      {cardContent}
    </a>
  );
};

export default ItemCard;
