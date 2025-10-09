import React from "react";
import { Users } from "lucide-react";
import Image from "next/image";

interface PartnerLogoProps {
  logo?: string;
  title: string;
}

const PartnerLogo = ({ logo, title }: PartnerLogoProps) => {
  if (!logo) {
    return (
      <div className="w-12 h-12 p-3 bg-white dark:bg-gray-900/50 rounded-lg flex items-center justify-center">
        <Users className="w-6 h-6 text-blue-600 dark:text-blue-400" />
      </div>
    );
  }

  return (
    <div className="w-12 h-12 p-3 bg-white dark:bg-gray-900/50 rounded-lg flex items-center justify-center transition-colors overflow-hidden">
      <Image
        src={logo}
        alt={`${title} logo`}
        width={40}
        height={40}
        className="object-contain"
        loading="lazy"
        decoding="async"
      />
    </div>
  );
};

export default PartnerLogo;
