"use client";

import ServicesList from "@/src/components/ui/services-list";
import type { LucideIcon } from "lucide-react";
import * as React from "react";

// Lightweight inline icon component compatible with LucideIcon API
const InlineCheckIcon = (({
  className,
  size = 20,
  ...rest
}: React.SVGProps<SVGSVGElement> & { size?: number | string }) => (
  <svg
    width={size as number}
    height={size as number}
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    {...rest}
  >
    <path d="M9 12l2 2 4-4" />
    <circle cx="12" cy="12" r="9" />
  </svg>
)) as unknown as LucideIcon;

export default function ServicesListSection() {
  const iconMap: LucideIcon[] = [
    InlineCheckIcon,
    InlineCheckIcon,
    InlineCheckIcon,
    InlineCheckIcon,
    InlineCheckIcon,
  ];

  return (
    <div>
      <h3 className="text-xl xs:text-2xl md:text-2xl font-bold mb-8 md:leading-[2rem] tracking-tight">
        Services
      </h3>
      <ServicesList
        ns="accounting"
        translationKey="Presentation.Services"
        fallbackText={[
          "Service 1: Description",
          "Service 2: Description",
          "Service 3: Description",
          "Service 4: Description",
        ]}
        iconMap={iconMap}
        className="space-y-6"
      />
    </div>
  );
}
