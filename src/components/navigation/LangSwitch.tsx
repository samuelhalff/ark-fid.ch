"use client";
import {
  NavigationMenuItem,
  NavigationMenuContent,
  NavigationMenuTrigger,
  NavigationMenuLink,
} from "@/src/components/navigation/NavigationComponents";
import React, { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import TranslatedText from "@/src/components/ui/translated-text";

function ListItem({ children }: { children: React.ReactNode }) {
  return (
    <NavigationMenuLink asChild className="text-md">
      {children}
    </NavigationMenuLink>
  );
}

export default function LangSwitch(): React.ReactElement {
  const {
    i18n: { language },
  } = useTranslation();

  const router = useRouter();
  const pathname = usePathname() || "/";
  const searchParams = useSearchParams();

  const validLocales = ["en", "fr", "de", "es", "pt"] as const;
  const validLocalesArray: string[] = Array.from(validLocales);
  // Determine active locale from the URL to avoid hydration flashes
  const activeLang = useMemo(() => {
    const seg0 = pathname.replace(/^\/+|\/+$|/g, "").split("/")[0];
    return validLocalesArray.includes(seg0) ? seg0 : "fr";
  }, [pathname]);
  const options = useMemo(
    () =>
      [
        { code: "en", key: "Lang.en", label: "English" },
        { code: "fr", key: "Lang.fr", label: "Français" },
        { code: "de", key: "Lang.de", label: "Deutsch" },
        { code: "es", key: "Lang.es", label: "Español" },
        { code: "pt", key: "Lang.pt", label: "Português" },
      ].filter((opt) => opt.code !== activeLang),
    [activeLang]
  );

  function buildHref(targetLocale: string) {
    const segments = pathname.replace(/^\/+|\/+$/g, "").split("/");
    let newSegments: string[];
    if (validLocalesArray.includes(segments[0])) {
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
      <NavigationMenuTrigger className="flex items-center gap-1 px-2">
        <GlobeIcon className="h-4 w-4 mx-1" />
        <span style={{ minWidth: 17 }}> {activeLang.toUpperCase()}</span>
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
                <TranslatedText
                  ns="navbar"
                  translationKey={opt.key}
                  fallbackText={opt.label}
                />
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
