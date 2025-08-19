import { CheckCircle } from "lucide-react";
import React from "react";

interface StylishListProps {
  items: string[];
  Icon?: React.ElementType;
  iconClass?: string;
  bulletBg?: string;
  className?: string;
}

export const StylishList: React.FC<StylishListProps> = ({
  items,
  Icon = CheckCircle,
  iconClass = "text-primary",
  bulletBg = "bg-primary/10",
  className = "",
}) => (
  <ul className={`space-y-3 ${className}`}>
    {items.map((text, i) => (
      <li key={i} className="flex items-center gap-3 group">
        <span
          className={`flex items-center justify-center rounded-full h-7 w-7 ${bulletBg} group-hover:scale-110 transition-all duration-150`}
        >
          <Icon className={iconClass + " w-4 h-4"} aria-hidden />
          <span className="sr-only">✔</span>
        </span>
        <span className="text-base md:text-lg font-medium text-gray-800 dark:text-gray-200">
          {text}
        </span>
      </li>
    ))}
  </ul>
);
