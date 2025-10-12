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
      className={`initials-tile ${className}`}
    >
      <div className="initials-tile__overlay">
        <div className="initials-tile__panel" />
      </div>
      <div className="initials-tile__center">
        <span>{initials}</span>
      </div>
    </div>
  );
}
