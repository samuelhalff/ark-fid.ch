"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo } from "react";

interface Crumb {
  label: string;
  href: string;
}

interface BreadcrumbsProps {
  /** Label applied to first dynamic segment (e.g. Services, Resources) */
  baseLabel?: string;
  /** Optional label for the root (locale) landing page. Defaults to "Home". */
  rootLabel?: string;
  /** Optional override labels for specific path segments */
  segments?: { segment: string; label?: string }[];
  className?: string;
  /** When true, if first crumb label === rootLabel, the root link is hidden to avoid duplication. */
  hideRootWhenDuplicate?: boolean;
}

// Basic label fallback: capitalize + replace hyphens
function fallbackLabel(part: string) {
  return part
    .split("-")
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(" ");
}

export default function Breadcrumbs({
  baseLabel = "Home",
  rootLabel = "Home",
  segments,
  className,
  hideRootWhenDuplicate = true,
}: BreadcrumbsProps) {
  const pathname = usePathname();

  const crumbs: Crumb[] = useMemo(() => {
    if (!pathname) return [];
    const parts = pathname.split("/").filter(Boolean); // remove empty
    // Expect locale as first part
    if (parts.length === 0) return [];
    const locale = parts[0];
    const dynamicParts = parts.slice(1); // rest

    const acc: Crumb[] = [];
    let cumulative = `/${locale}`;

    if (dynamicParts.length === 0) {
      // root locale page => no breadcrumbs
      return [];
    }

    dynamicParts.forEach((part, idx) => {
      cumulative += `/${part}`;
      const override = segments?.find((s) => s.segment === part)?.label;
      acc.push({
        label:
          override ||
          (idx === 0 ? baseLabel || fallbackLabel(part) : fallbackLabel(part)),
        href: cumulative + "/",
      });
    });
    return acc;
  }, [pathname, segments, baseLabel]);

  if (crumbs.length === 0) return null;

  const localeFromFirst = crumbs[0].href.split("/")[1] || "";
  const rootHref = `/${localeFromFirst}/`;
  const showRoot = !hideRootWhenDuplicate || crumbs[0].label !== rootLabel;

  return (
    <nav aria-label="Breadcrumb" className={className}>
      <ol className="flex flex-wrap items-center gap-1 text-sm text-muted-foreground">
        {showRoot && (
          <li>
            <Link
              href={rootHref}
              className="hover:underline focus:outline-none focus:ring-2 focus:ring-primary rounded-sm"
            >
              {rootLabel}
            </Link>
          </li>
        )}
        {crumbs.map((c, i) => (
          <li key={c.href} className="flex items-center gap-1">
            {(showRoot || i > 0) && (
              <span className="text-muted-foreground/60">/</span>
            )}
            {i === crumbs.length - 1 ? (
              <span aria-current="page" className="font-medium text-foreground">
                {c.label}
              </span>
            ) : (
              <Link
                href={c.href}
                className="hover:underline focus:outline-none focus:ring-2 focus:ring-primary rounded-sm"
              >
                {c.label}
              </Link>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
