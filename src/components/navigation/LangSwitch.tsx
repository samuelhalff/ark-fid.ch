"use client";
import {
  NavigationMenuItem,
  NavigationMenuContent,
  NavigationMenuTrigger,
  NavigationMenuLink,
} from "@/src/components/navigation/NavigationComponents";
import React, { useMemo } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import Link from "next/link";
import type { Locale } from "@/src/lib/i18n";

const VALID_LOCALES = ["en", "fr", "de", "es", "pt"] as const;

const isValidLocale = (value: string): value is Locale =>
  VALID_LOCALES.includes(value as Locale);

function ListItem({ children }: { children: React.ReactNode }) {
  return (
    <NavigationMenuLink asChild className="text-md">
      {children}
    </NavigationMenuLink>
  );
}

export default function LangSwitch(): React.ReactElement {
  const pathname = usePathname() || "/";
  const searchParams = useSearchParams();

  // Determine active locale from the URL to avoid hydration flashes
  const activeLang = useMemo<Locale>(() => {
    const seg0 = pathname.replace(/^\/+|\/+$|/g, "").split("/")[0];
    return seg0 && isValidLocale(seg0) ? seg0 : "fr";
  }, [pathname]);
  const options = useMemo(
    () =>
      [
        { code: "en", label: "English" },
        { code: "fr", label: "Français" },
        { code: "de", label: "Deutsch" },
        { code: "es", label: "Español" },
        { code: "pt", label: "Português" },
      ].filter((opt) => opt.code !== activeLang),
    [activeLang]
  );

  function buildHref(targetLocale: string) {
    const segments = pathname.replace(/^\/+|\/+$/g, "").split("/");
    let newSegments: string[];
    const firstSegment = segments[0];
    if (firstSegment && isValidLocale(firstSegment)) {
      segments[0] = targetLocale;
      newSegments = segments;
    } else {
      newSegments = [targetLocale, ...segments.filter(Boolean)];
    }
    const qs = searchParams?.toString();
    return `/${newSegments.join("/")}${qs ? `?${qs}` : ""}`;
  }

  return (
    <NavigationMenuItem className="md:ml-30">
      <NavigationMenuTrigger className="flex items-center gap-1 px-2 min-w-[56px] justify-center">
        <GlobeIcon className="h-4 w-4 mx-1" />
        <span className="inline-block w-8 text-center">
          {activeLang.toUpperCase()}
        </span>
      </NavigationMenuTrigger>
      <NavigationMenuContent>
        {options.map((opt) => {
          const href = buildHref(opt.code);
          return (
            <ListItem key={opt.code}>
              <Link
                href={href}
                prefetch={false}
                hrefLang={opt.code}
                rel="alternate"
                aria-label={`Switch language to ${opt.label}`}
                className="cursor-pointer block py-3 px-4 text-left w-full"
              >
                {opt.label}
              </Link>
            </ListItem>
          );
        })}
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
