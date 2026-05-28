import React from "react";
const UsersIcon = (props: any) => (
  <svg
    viewBox="0 0 24 24"
    width="24"
    height="24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <path d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);
import Image from "next/image";

interface PartnerLogoProps {
  logo?: string;
  title: string;
}

const PartnerLogo = ({ logo, title }: PartnerLogoProps) => {
  if (!logo) {
    return (
      <div className="w-12 h-12 p-3 bg-white dark:bg-gray-900/50 rounded-lg flex items-center justify-center">
        <UsersIcon className="w-6 h-6 text-brand-hover dark:text-brand" />
      </div>
    );
  }

  const normalizedLogo = logo.toLowerCase();
  const isWide = normalizedLogo.endsWith(".svg");

  const baseSizeClass = isWide ? "min-w-[5rem] max-w-[9rem] px-3 py-2" : "p-3";
  const backgroundClass = "bg-white shadow-sm dark:bg-gray-100";

  return (
    <div
      className={`${baseSizeClass} ${backgroundClass} rounded-lg inline-flex items-center justify-center transition-colors overflow-hidden`}
    >
      <Image
        src={logo}
        alt={`${title} logo`}
        width={isWide ? 120 : 30}
        height={30}
        className="h-full w-auto max-w-full object-contain rounded"
        sizes={isWide ? "(max-width: 640px) 96px, 120px" : "30px"}
        loading="lazy"
        decoding="async"
      />
    </div>
  );
};

export default PartnerLogo;
