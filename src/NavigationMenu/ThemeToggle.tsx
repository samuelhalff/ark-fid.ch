import { Moon, Sun } from "lucide-react";
import {
  NavigationMenuItem,
  NavigationMenuContent,
  NavigationMenuTrigger,
  NavigationMenuLink,
} from "@/NavigationMenu/NavigationComponents";
import { useTheme } from "@/components/ui/theme-provider";

function ListItem({
  children,
  onClick,
}: {
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <li onClick={onClick}>
      <NavigationMenuLink asChild>
        <a className="text-md cursor-pointer py-3 px-4">{children}</a>
      </NavigationMenuLink>
    </li>
  );
}

export default function ThemeToggle({ mobile }: { mobile?: boolean } = {}) {
  const { setTheme } = useTheme();

  if (mobile) {
    // Only render the dropdown content for mobile collapse
    return (
      <ul className="flex flex-col gap-1">
        <ListItem onClick={() => setTheme("light")}>Light</ListItem>
        <ListItem onClick={() => setTheme("dark")}>Dark</ListItem>
        <ListItem onClick={() => setTheme("system")}>System</ListItem>
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
