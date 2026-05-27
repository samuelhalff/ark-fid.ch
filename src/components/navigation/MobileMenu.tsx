"use client";
import { Button } from "@/src/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/src/components/ui/sheet";
import LangSwitchMobile from "@/src/components/navigation/LangSwitchMobile";
import { Suspense } from "react";
import ThemeToggleMobile from "@/src/components/navigation/ThemeToggleMobile";
import ServicesMobile from "@/src/components/navigation/ServicesMobile";
import Image from "next/image";
import { useState } from "react";
import Link from "next/link";
import { cn } from "@/src/lib/utils";
import { MessageIcon } from "@/src/components/icons/MessageIcon";
import type { NavData } from "@/src/components/navigation/types";

const MobileMenuToggleIcon = ({
  open,
  className,
}: {
  open: boolean;
  className?: string;
}) => (
  <span
    aria-hidden
    className={cn(
      "pointer-events-none relative flex h-4 w-6 items-center justify-center",
      className,
    )}
  >
    <span
      className={cn(
        "absolute block h-[2px] w-6 rounded-full bg-current transition-colors duration-300 ease-in-out",
        open ? "translate-y-0 rotate-45" : "-translate-y-[6px] rotate-0",
      )}
    />
    <span
      className={cn(
        "absolute block h-[2px] w-6 rounded-full bg-current transition-colors duration-200 ease-in-out",
        open ? "scale-x-0 opacity-0" : "scale-x-100 opacity-100",
      )}
    />
    <span
      className={cn(
        "absolute block h-[2px] w-6 rounded-full bg-current transition-colors duration-300 ease-in-out",
        open ? "translate-y-0 -rotate-45" : "translate-y-[6px] rotate-0",
      )}
    />
  </span>
);

const MobileMenu = ({
  locale,
  navData,
}: {
  locale?: string;
  navData: NavData;
}) => {
  const [open, setOpen] = useState(false);

  const handleLinkClick = () => {
    setOpen(false);
  };
  const localePrefix = locale ? `/${locale}` : "/fr";

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          className={cn(
            "p-2 text-foreground transition-colors",
            open ? "text-primary" : "hover:text-primary",
          )}
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-controls="mobile-menu-panel"
          aria-label={open ? "Close menu" : "Open menu"}
        >
          <MobileMenuToggleIcon open={open} />
        </Button>
      </SheetTrigger>
      <SheetContent
        side="right"
        className="w-full max-w-[100vw] h-[100svh] sm:h-full overflow-hidden p-0 data-[state=open]:animate-in data-[state=open]:slide-in-from-right data-[state=closed]:animate-out data-[state=closed]:slide-out-to-right"
        hideClose
        id="mobile-menu-panel"
        aria-label="Mobile navigation"
        role="dialog"
      >
        <SheetTitle className="sr-only">
          {navData.labels.mobileNavigation}
        </SheetTitle>
        <div className="flex h-16 items-center px-4 shadow-[0_10px_24px_rgba(20,16,14,0.05)] dark:shadow-[0_10px_24px_rgba(0,0,0,0.24)]">
          <div className="flex-1 flex justify-start">
            <Image
              className="hidden dark:block"
              src="/assets/arkfid--light.svg"
              width={100}
              height={32}
              alt="Ark Fiduciaire"
              loading="lazy"
              decoding="async"
              sizes="100px"
            />
            <Image
              className="dark:hidden"
              src="/assets/arkfid--color.svg"
              width={100}
              height={32}
              alt="Ark Fiduciaire"
              loading="lazy"
              decoding="async"
              sizes="100px"
            />
          </div>
          <SheetTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              className="ml-2 p-2 text-primary transition-colors hover:text-primary/90"
              aria-label="Close menu"
            >
              <MobileMenuToggleIcon open className="scale-90" />
            </Button>
          </SheetTrigger>
        </div>
        <div
          className="h-[calc(100svh-64px)] md:h-[calc(100vh-64px)] overflow-y-auto pb-24 [&::-webkit-scrollbar]:w-2
  [&::-webkit-scrollbar-track]:bg-gray-100
  [&::-webkit-scrollbar-thumb]:bg-gray-300
  dark:[&::-webkit-scrollbar-track]:bg-neutral-700
  dark:[&::-webkit-scrollbar-thumb]:bg-neutral-500"
          style={{ paddingBottom: "max(1.5rem, env(safe-area-inset-bottom))" }}
        >
          <nav className="flex flex-col gap-3 px-4 mt-3 pb-10 pt-2">
            <ThemeToggleMobile />
            <Suspense fallback={null}>
              <LangSwitchMobile onLocaleChange={handleLinkClick} />
            </Suspense>
            <div className="mt-3 mb-3">
              <Link
                href={`${localePrefix}/contact/`}
                onClick={handleLinkClick}
                prefetch={false}
                locale={locale}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-accent/30 py-3 text-center text-lg font-semibold shadow-sm transition-colors hover:bg-accent/40"
                style={{ letterSpacing: 0.5 }}
              >
                <MessageIcon size={20} className="opacity-80" />
                <span>{navData.labels.contact}</span>
              </Link>
            </div>
            <div>
              <Link
                href={`${localePrefix}/`}
                onClick={handleLinkClick}
                prefetch={false}
                locale={locale}
                className="flex items-center gap-3 text-md px-2 py-2 rounded hover:bg-accent transition-colors font-bold"
              >
                <span>{navData.labels.home}</span>
              </Link>
            </div>
            <div>
              <Link
                href={`${localePrefix}/agent/`}
                onClick={handleLinkClick}
                prefetch={false}
                locale={locale}
                className="flex items-center gap-3 text-md px-2 py-2 rounded hover:bg-accent transition-colors font-bold"
              >
                <span>{navData.labels.agent}</span>
              </Link>
            </div>
            <div>
              <Link
                href={`${localePrefix}/team/`}
                onClick={handleLinkClick}
                prefetch={false}
                locale={locale}
                className="flex items-center gap-3 text-md px-2 py-2 rounded hover:bg-accent transition-colors font-bold"
              >
                <span>{navData.labels.team}</span>
              </Link>
            </div>
            <div>
              <Link
                href={`${localePrefix}/about/`}
                onClick={handleLinkClick}
                prefetch={false}
                locale={locale}
                className="flex items-center gap-3 text-md px-2 py-2 rounded hover:bg-accent transition-colors font-bold"
              >
                <span>{navData.labels.about}</span>
              </Link>
            </div>
            <ServicesMobile
              locale={locale}
              onLinkClick={handleLinkClick}
              services={navData.services}
              label={navData.labels.services}
            />
            <div>
              <Link
                href={`${localePrefix}/ressources/`}
                onClick={handleLinkClick}
                prefetch={false}
                locale={locale}
                className="flex items-center gap-3 text-md px-2 py-2 rounded hover:bg-accent transition-colors font-bold"
              >
                <span>{navData.labels.ressources}</span>
              </Link>
            </div>
            {/* Footer is server-rendered in layout; omit here to keep client bundle light */}
          </nav>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default MobileMenu;
