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

export default function ThemeToggle({ mobile }: { mobile?: boolean } = {}) {
  const { setTheme } = useTheme();

  if (mobile) {
    // Only render the dropdown content for mobile collapse
    return (
      <ul className="flex flex-col gap-2 pl-5">
        <ListItem onClick={() => setTheme("light")} isMobile={mobile}>
          Light
        </ListItem>
        <ListItem onClick={() => setTheme("dark")} isMobile={mobile}>
          Dark
        </ListItem>
        <ListItem onClick={() => setTheme("system")} isMobile={mobile}>
          System
        </ListItem>
      </ul>
    );
  }

  return (
    <NavigationMenuItem>
      <NavigationMenuTrigger className="px-2">
        <Sun className="h-5 w-8 dark:hidden w-10" />
        <Moon className="h-5 w-8 light:hidden w-10" />
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
