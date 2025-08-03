import {
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuTrigger,
} from "@/components/ui/navigation-menu";
import { Button } from "@/components/ui/button";
import React from "react";

export default function LangSwitch(): React.ReactElement {
  return (
    <NavigationMenuItem>
      <NavigationMenuTrigger>
        <GlobeIcon className="h-5 w-8" />
        <span>EN</span>
      </NavigationMenuTrigger>
      <NavigationMenuContent className="right-0 left-auto md:right-0 md:left-auto">
        <button className="flex w-full items-center justify-between px-3 py-2 text-left bg-accent rounded">
          <span>English</span>
          <CheckIcon className="h-5 w-8" />
        </button>
        <button className="flex w-full items-center justify-between px-3 py-2 text-left hover:bg-accent rounded">
          <span>Español</span>
        </button>
        <button className="flex w-full items-center justify-between px-3 py-2 text-left hover:bg-accent rounded">
          <span>Français</span>
        </button>
        <button className="flex w-full items-center justify-between px-3 py-2 text-left hover:bg-accent rounded">
          <span>Deutsch</span>
        </button>
      </NavigationMenuContent>
    </NavigationMenuItem>
  );
}

function CheckIcon(props: React.SVGProps<SVGSVGElement>) {
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
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

function ChevronDownIcon(props: React.SVGProps<SVGSVGElement>) {
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
      <path d="m6 9 6 6 6-6" />
    </svg>
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
