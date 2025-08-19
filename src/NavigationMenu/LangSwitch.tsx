import {
  NavigationMenuItem,
  NavigationMenuContent,
  NavigationMenuTrigger,
  NavigationMenuLink,
} from "@/NavigationMenu/NavigationComponents";
import React from "react";
import { useTranslation } from "react-i18next";

function ListItem({
  children,
  onClick,
}: {
  children: React.ReactNode;
  onClick: () => {};
}) {
  return (
    <li onClick={onClick}>
      <NavigationMenuLink asChild>
        <a className="text-md cursor-pointer py-3 px-4">{children}</a>
      </NavigationMenuLink>
    </li>
  );
}

export default function LangSwitch({
  mobile,
}: { mobile?: boolean } = {}): React.ReactElement {
  const {
    i18n: { changeLanguage, language },
  } = useTranslation();

  if (mobile) {
    // Only render the dropdown content for mobile collapse
    return (
      <ul className="flex flex-col gap-1">
        <ListItem onClick={() => changeLanguage("en")}>English</ListItem>
        <ListItem onClick={() => changeLanguage("fr")}>Français</ListItem>
        <ListItem onClick={() => changeLanguage("de")}>Deutsch</ListItem>
        <ListItem onClick={() => changeLanguage("es")}>Español</ListItem>
      </ul>
    );
  }

  return (
    <NavigationMenuItem className="md:ml-30">
      <NavigationMenuTrigger className="px-2">
        <GlobeIcon className="h-5 w-8" />
        <span style={{ minWidth: 17 }}>{language}</span>
      </NavigationMenuTrigger>
      <NavigationMenuContent>
        <ListItem onClick={() => changeLanguage("en")}>English</ListItem>
        <ListItem onClick={() => changeLanguage("fr")}>Français</ListItem>
        <ListItem onClick={() => changeLanguage("de")}>Deutsch</ListItem>
        <ListItem onClick={() => changeLanguage("es")}>Español</ListItem>
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
