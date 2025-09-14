import { useTheme } from "next-themes";

export function ThemeToggleMobile() {
  const { theme, setTheme } = useTheme();

  const isSystem = theme === "system";
  const isLight = theme === "light";
  const isDark = theme === "dark";

  return (
    <div className="flex items-center" role="group" aria-label="Appearance">
      <span className="flex items-center gap-3 p-2">Theme</span>
      <div className="flex gap-2 ml-auto">
        <button
          type="button"
          aria-label="System"
          aria-pressed={isSystem}
          title="System"
          onClick={() => setTheme("system")}
          className={`p-3 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
            isSystem ? "bg-accent" : ""
          }`}
        >
          {/* Laptop/System icon */}
          <svg
            className="w-5 h-5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <rect x="3" y="4" width="18" height="12" rx="2" ry="2" />
            <path d="M2 20h20" />
          </svg>
        </button>
        <button
          type="button"
          aria-label="Light"
          aria-pressed={isLight}
          title="Light"
          onClick={() => setTheme("light")}
          className={`p-3 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
            isLight ? "bg-accent" : ""
          }`}
        >
          {/* Sun icon */}
          <svg
            className="w-5 h-5"
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
        </button>
        <button
          type="button"
          aria-label="Dark"
          aria-pressed={isDark}
          title="Dark"
          onClick={() => setTheme("dark")}
          className={`p-3 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
            isDark ? "bg-accent" : ""
          }`}
        >
          {/* Moon icon */}
          <svg
            className="w-5 h-5"
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
        </button>
      </div>
    </div>
  );
}

export default ThemeToggleMobile;
