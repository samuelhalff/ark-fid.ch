"use client";

import Link from "next/link";
import { useState, useCallback, type FocusEvent } from "react";

import type { NavData } from "@/src/components/navigation/types";

type ServicesDropdownProps = {
  locale?: string;
  localePrefix: string;
  navData: NavData;
  isActive: boolean;
};

export default function ServicesDropdown({
  locale,
  localePrefix,
  navData,
  isActive,
}: ServicesDropdownProps) {
  const [open, setOpen] = useState(false);

  const close = useCallback(() => {
    setOpen(false);
  }, []);

  const handleBlur = useCallback((event: FocusEvent<HTMLLIElement>) => {
    if (!event.currentTarget.contains(event.relatedTarget)) {
      setOpen(false);
    }
  }, []);

  return (
    <li
      className="relative"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={close}
      onFocusCapture={() => setOpen(true)}
      onBlur={handleBlur}
    >
      <Link
        href={`${localePrefix}/services`}
        prefetch={false}
        locale={locale}
        aria-expanded={open}
        className={`px-3 py-2 rounded-md min-w-[100px] text-center inline-flex items-center gap-1 critical-nav__link hover:bg-accent ${
          isActive ? "bg-accent text-accent-foreground" : ""
        }`}
        onClick={close}
      >
        {navData.labels.services}
        <svg
          className={`relative top-px ml-1 size-3 transition duration-300 ${
            open ? "rotate-180" : ""
          }`}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </Link>
      <div
        className={`absolute left-0 top-full pt-2 w-[min(92vw,720px)] bg-background border rounded-md shadow-xl z-50 transition-opacity duration-150 ${
          open ? "opacity-100 visible" : "opacity-0 invisible"
        }`}
      >
        <div className="p-3">
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {navData.services.map((item) => (
              <li key={item.href} className="min-w-0">
                <Link
                  href={`${localePrefix}${item.href}`}
                  prefetch={false}
                  locale={locale}
                  className="block rounded-md p-3 hover:bg-accent focus:bg-accent focus:outline-none focus:ring-2 focus:ring-primary"
                  onClick={close}
                >
                  <div className="text-left text-sm font-medium leading-none truncate">
                    {item.title}
                  </div>
                  <p className="mt-1 text-left text-sm text-muted-foreground leading-snug line-clamp-2">
                    {item.description}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
          <div className="mt-2 text-right">
            <Link
              href={`${localePrefix}/services`}
              prefetch={false}
              locale={locale}
              className="text-sm text-primary underline hover:no-underline"
              onClick={close}
            >
              {navData.labels.services} →
            </Link>
          </div>
        </div>
      </div>
    </li>
  );
}
