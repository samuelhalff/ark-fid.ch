import { Laptop, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

export function ThemeToggleMobile() {
  const { theme, setTheme } = useTheme();

  return (
    <div className="flex items-center">
      <span className="flex items-center gap-3 p-2 text-muted-foreground">
        Theme
      </span>
      <div className="flex gap-2 ml-auto">
        <button
          aria-label="System"
          onClick={() => setTheme("system")}
          className={`p-3 rounded ${theme === "system" ? "bg-accent" : ""}`}
        >
          <Laptop className="w-5 h-5" />
        </button>
        <button
          aria-label="Light"
          onClick={() => setTheme("light")}
          className={`p-3 rounded ${theme === "light" ? "bg-accent" : ""}`}
        >
          <Sun className="w-5 h-5" />
        </button>
        <button
          aria-label="Dark"
          onClick={() => setTheme("dark")}
          className={`p-3 rounded ${theme === "dark" ? "bg-accent" : ""}`}
        >
          <Moon className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}

export default ThemeToggleMobile;
