"use client";
import {
  NavigationMenuItem,
  NavigationMenuContent,
  NavigationMenuTrigger,
  NavigationMenuLink,
} from "@/src/components/navigation/NavigationComponents";
import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
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
      <a className="cursor-pointer py-3 px-4">{children}</a>
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

  return (
    <NavigationMenuItem className="md:ml-30">
      <NavigationMenuTrigger className="px-2">
        <GlobeIcon className="h-5 w-8" />
        <span style={{ minWidth: 17 }}> {isClient ? language : ""}</span>
      </NavigationMenuTrigger>
      <NavigationMenuContent>
        <ListItem onClick={() => changeLanguage("en")}>
          <TranslatedText
            ns="home"
            translationKey="Lang.en"
            fallbackText="English"
          />
        </ListItem>
        <ListItem onClick={() => changeLanguage("fr")}>
          <TranslatedText
            ns="home"
            translationKey="Lang.fr"
            fallbackText="Français"
          />
        </ListItem>
        <ListItem onClick={() => changeLanguage("de")}>
          <TranslatedText
            ns="home"
            translationKey="Lang.de"
            fallbackText="Deutsch"
          />
        </ListItem>
        <ListItem onClick={() => changeLanguage("es")}>
          <TranslatedText
            ns="home"
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
