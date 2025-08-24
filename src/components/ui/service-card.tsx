"use client";

import { LucideIcon } from "lucide-react";

interface ServiceCardProps {
  text: string;
  index: number;
  iconMap: LucideIcon[];
  className?: string;
}

const ServiceCard = ({
  text,
  index,
  iconMap,
  className = "",
}: ServiceCardProps) => {
  const [title, ...descParts] = text.split(":");
  const desc = descParts.join(":").trim();
  const Icon = iconMap[index % iconMap.length];

  return (
    <div
      className={`flex items-start gap-6 px-6 py-6 my-6 rounded-xl bg-muted/50 shadow-sm hover:shadow-md transition-shadow ${className}`}
    >
      <span className="mt-1">
        <Icon className="text-primary min-w-[20px]" size={20} />
      </span>
      <div>
        <span className="font-semibold text-lg text-gray-900 dark:text-gray-100 block mb-2">
          {title}
        </span>
        {desc && (
          <span className="text-lg text-gray-700 dark:text-gray-300">
            {desc}
          </span>
        )}
      </div>
    </div>
  );
};

export default ServiceCard;
