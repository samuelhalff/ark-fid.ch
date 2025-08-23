import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

import React from "react";
import { FileText, Briefcase, SearchCheck, Landmark } from "lucide-react";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const iconMap = [FileText, Briefcase, SearchCheck, Landmark];

export const convertRawToList = (
  raw: any[]
): { Title: string; Desc: string; icon: React.ReactNode }[] =>
  raw.map((item, index) => ({
    ...item,
    icon: iconMap[index] ? (
      <>
        {React.createElement(iconMap[index], {
          className: "text-primary min-w-[22px]",
          size: 22,
        })}
      </>
    ) : null,
  }));
