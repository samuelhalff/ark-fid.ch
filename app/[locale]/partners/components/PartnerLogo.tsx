import React from "react";
import { Users as UsersIcon } from "@phosphor-icons/react/dist/ssr";
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
