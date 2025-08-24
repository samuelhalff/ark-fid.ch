import { Moon, Sun } from "lucide-react";
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
      <a className="text-md cursor-pointer py-3 px-4">{children}</a>
    </NavigationMenuLink>
  );
}

export default function ThemeToggle() {
  const { setTheme } = useTheme();

  return (
    <NavigationMenuItem>
      <NavigationMenuTrigger className="flex items-center gap-1 px-2">
        <Sun className="h-4 w-4 dark:hidden" />
        <Moon className="h-4 w-4 light:hidden" />
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
