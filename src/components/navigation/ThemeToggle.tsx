"use client";
import {
  NavigationMenuItem,
  NavigationMenuContent,
  NavigationMenuTrigger,
  NavigationMenuLink,
} from "@/src/components/navigation/NavigationComponents";
import { useTheme } from "next-themes";

function ListItem({
  children,
  onClick,
  isMobile,
}: {
  children: React.ReactNode;
  onClick: () => void;
  isMobile?: boolean;
}) {
  return (
    <NavigationMenuLink
      asChild
      className={isMobile ? "text-xl" : "text-md"}
      onClick={onClick}
    >
      <button className="text-md cursor-pointer py-3 px-4 text-left w-full">
        {children}
      </button>
    </NavigationMenuLink>
  );
}

export default function ThemeToggle() {
  const { setTheme } = useTheme();

  return (
    <NavigationMenuItem>
      <NavigationMenuTrigger className="flex items-center gap-1 px-2 min-w-[44px] justify-center">
        <svg
          className="h-4 w-4 dark:hidden"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32l1.41 1.41M2 12h2m16 0h2M4.93 19.07l1.41-1.41m11.32-11.32l1.41-1.41" />
        </svg>
        <svg
          className="h-4 w-4 hidden dark:block"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
        <span className="sr-only">Toggle theme</span>
      </NavigationMenuTrigger>
      <NavigationMenuContent>
        <ListItem onClick={() => setTheme("light")}>Light</ListItem>
        <ListItem onClick={() => setTheme("dark")}>Dark</ListItem>
        <ListItem onClick={() => setTheme("system")}>System</ListItem>
      </NavigationMenuContent>
    </NavigationMenuItem>
  );
}
