"use client";
import {
  NavigationMenuItem,
  NavigationMenuContent,
  NavigationMenuTrigger,
  NavigationMenuLink,
} from "@/src/components/navigation/NavigationComponents";
import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useRouter } from "next/navigation";
import TranslatedText from "@/src/components/ui/translated-text";

function ListItem({
  children,
  onClick,
}: {
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <NavigationMenuLink asChild className="text-md" onClick={onClick}>
      <button className="cursor-pointer py-3 px-4 text-left w-full">
        {children}
      </button>
    </NavigationMenuLink>
  );
}

export default function LangSwitch(): React.ReactElement {
  const {
    i18n: { changeLanguage, language },
  } = useTranslation();

  // 2. Add the isClient state and useEffect hook
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  const router = useRouter();
  const pathname =
    typeof window !== "undefined" ? window.location.pathname : "/";

  function navigateToLocale(targetLocale: string) {
    const parts = pathname?.split("/") || [];
    const remainder = parts.length > 2 ? parts.slice(2).join("/") : "";
    const newPath = `/${targetLocale}${remainder ? `/${remainder}` : ""}`;
    router.push(newPath);
    try {
      changeLanguage(targetLocale);
    } catch (e) {}
  }

  return (
    <NavigationMenuItem className="md:ml-30">
      <NavigationMenuTrigger className="flex items-center gap-1 px-2">
        <GlobeIcon className="h-4 w-4 mx-1" />
        <span style={{ minWidth: 17 }}> {isClient ? language : ""}</span>
      </NavigationMenuTrigger>
      <NavigationMenuContent>
        <ListItem onClick={() => navigateToLocale("en")}>
          <TranslatedText
            ns="navbar"
            translationKey="Lang.en"
            fallbackText="English"
          />
        </ListItem>
        <ListItem onClick={() => navigateToLocale("fr")}>
          <TranslatedText
            ns="navbar"
            translationKey="Lang.fr"
            fallbackText="Français"
          />
        </ListItem>
        <ListItem onClick={() => navigateToLocale("de")}>
          <TranslatedText
            ns="navbar"
            translationKey="Lang.de"
            fallbackText="Deutsch"
          />
        </ListItem>
        <ListItem onClick={() => navigateToLocale("es")}>
          <TranslatedText
            ns="navbar"
            translationKey="Lang.es"
            fallbackText="Español"
          />
        </ListItem>
      </NavigationMenuContent>
    </NavigationMenuItem>
  );
}

function GlobeIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
      <path d="M2 12h20" />
    </svg>
  );
}
