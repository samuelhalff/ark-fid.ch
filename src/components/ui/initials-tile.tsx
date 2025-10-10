"use client";

import React from "react";

function getInitials(name: string) {
  if (!name) return "";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "";
  const first = parts[0]?.[0] || "";
  const last =
    parts.length > 1 ? parts[parts.length - 1][0] : parts[0]?.[1] || "";
  return (first + last).toUpperCase();
}

export default function InitialsTile({
  name,
  className = "",
}: {
  name: string;
  className?: string;
}) {
  const initials = getInitials(name);
  return (
    <div
      aria-label={`Avatar placeholder for ${name}`}
      className={
        "relative w-full h-full rounded-md overflow-hidden bg-muted/20 dark:bg-muted/50 border border-border/60 dark:border-transparent " +
        className
      }
    >
      {/* Gentle diagonal accent */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -inset-8 rotate-[-15deg] origin-bottom-left bg-muted/95 dark:bg-foreground/5" />
      </div>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-4xl sm:text-5xl font-semibold tracking-wide text-foreground/80">
          {initials}
        </span>
      </div>
    </div>
  );
}
