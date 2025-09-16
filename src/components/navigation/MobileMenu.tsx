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
// no usePathname needed; compute pathname from window when required

type NavData = {
  labels: {
    home: string;
    team: string;
    services: string;
    ressources: string;
    about: string;
    contact: string;
    mobileNavigation: string;
  };
  services: Array<{
    href: string;
    title: string;
    description: string;
  }>;
};

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
          variant="ghost"
          className="w-auto px-2 py-1 rounded-md"
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-controls="mobile-menu-panel"
          aria-label="Open menu"
        >
          {/* Animated hamburger to X */}
          <span className="relative block w-6 h-5">
            <span
              className={
                "absolute left-0 top-0 block h-0.5 w-6 bg-current transition-transform duration-200 " +
                (open ? "translate-y-2.5 rotate-45" : "translate-y-0 rotate-0")
              }
            />
            <span
              className={
                "absolute left-0 top-2.5 block h-0.5 w-6 bg-current transition-opacity duration-200 " +
                (open ? "opacity-0" : "opacity-100")
              }
            />
            <span
              className={
                "absolute left-0 bottom-0 block h-0.5 w-6 bg-current transition-transform duration-200 " +
                (open
                  ? "-translate-y-2.5 -rotate-45"
                  : "translate-y-0 rotate-0")
              }
            />
          </span>
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
        <div className="flex items-center h-16 px-4 border-b">
          <div className="flex-1 flex justify-start">
            <Image
              className="hidden dark:block"
              src="/assets/arkfid--light.svg"
              width={100}
              height={32}
              alt=""
              loading="lazy"
              decoding="async"
              sizes="100px"
            />
            <Image
              className="dark:hidden"
              src="/assets/arkfid--color.svg"
              width={100}
              height={32}
              alt=""
              loading="lazy"
              decoding="async"
              sizes="100px"
            />
          </div>
          <SheetTrigger asChild>
            <button
              className="ml-2 p-2 rounded border hover:bg-accent transition-colors"
              aria-label="Close menu"
            >
              {/* Same animated icon reflects open state */}
              <span className="relative block w-6 h-5">
                <span className="absolute left-0 top-0 block h-0.5 w-6 bg-current translate-y-2.5 rotate-45" />
                <span className="absolute left-0 top-2.5 block h-0.5 w-6 bg-current opacity-0" />
                <span className="absolute left-0 bottom-0 block h-0.5 w-6 bg-current -translate-y-2.5 -rotate-45" />
              </span>
            </button>
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
                href={`${localePrefix}/contact`}
                onClick={handleLinkClick}
                prefetch={false}
                locale={locale}
                className="block w-full text-center font-semibold text-lg py-3 rounded-xl border border-accent bg-transparent hover:bg-accent/30 active:scale-[0.99] transition-all"
                style={{ letterSpacing: 0.5 }}
              >
                {navData.labels.contact}
              </Link>
            </div>
            <div>
              <Link
                href={`${localePrefix}/`}
                onClick={handleLinkClick}
                prefetch={false}
                locale={locale}
                className="flex items-center gap-3 text-md px-2 py-2 rounded hover:bg-accent active:scale-[0.99] transition-all font-bold"
              >
                <span>{navData.labels.home}</span>
              </Link>
            </div>
            <div>
              <Link
                href={`${localePrefix}/team`}
                onClick={handleLinkClick}
                prefetch={false}
                locale={locale}
                className="flex items-center gap-3 text-md px-2 py-2 rounded hover:bg-accent active:scale-[0.99] transition-all font-bold"
              >
                <span>{navData.labels.team}</span>
              </Link>
            </div>
            <div>
              <Link
                href={`${localePrefix}/about`}
                onClick={handleLinkClick}
                prefetch={false}
                locale={locale}
                className="flex items-center gap-3 text-md px-2 py-2 rounded hover:bg-accent active:scale-[0.99] transition-all font-bold"
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
                href={`${localePrefix}/ressources`}
                onClick={handleLinkClick}
                prefetch={false}
                locale={locale}
                className="flex items-center gap-3 text-md px-2 py-2 rounded hover:bg-accent active:scale-[0.99] transition-all font-bold"
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
