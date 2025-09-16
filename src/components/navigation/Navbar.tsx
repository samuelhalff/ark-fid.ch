"use client";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import Image from "next/image";
import NavMenu from "@/src/components/navigation/NavMenu";

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
    icon: ReactNode;
    title: string;
    description: string;
  }>;
};

const MobileMenuLazy = dynamic(
  () => import("@/src/components/navigation/MobileMenu"),
  { ssr: false }
);

// Desktop NavMenu is rendered eagerly to avoid two-step growth on hover.

const Navbar = ({ locale, navData }: { locale?: string; navData: NavData }) => {
  const localePrefix = locale ? `/${locale}` : "/fr";
  const [scrollTop, setScrollTop] = useState(0);
  // Track scroll to add shadow after scrolling a bit
  const [loadDesktopNav] = useState(true);
  // Augment Window with optional requestIdleCallback
  useEffect(() => {
    const isMobile =
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(max-width: 767px)").matches;
    if (!isMobile) return;
    const w = window as unknown as { requestIdleCallback?: unknown };
    const idle = (fn: () => void) =>
      typeof w.requestIdleCallback === "function"
        ? (w.requestIdleCallback as (cb: () => void) => number)(() => fn())
        : setTimeout(fn, 50);
    idle(() => {
      import("@/src/components/navigation/MobileMenu").catch(() => undefined);
    });
  }, []);
  useEffect(() => {
    let ticking = false;
    const onScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          setScrollTop(document.documentElement.scrollTop);
          ticking = false;
        });
        ticking = true;
      }
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Desktop NavMenu is rendered immediately; heavy dropdown content remains interaction-loaded inside NavMenu

  return (
    <div className="fixed top-0 w-full max-w-[100vw] z-50">
      <nav
        className={
          "h-16 bg-background border-b border-accent " +
          (scrollTop > 100 ? "shadow-2xl" : "")
        }
      >
        <div className="h-full flex items-center max-w-[1200px] mx-auto justify-between px-4 sm:px-6">
          {/* preserve current locale in the logo link */}
          <Link
            href={`${localePrefix}/`}
            prefetch={false}
            locale={locale}
            aria-label={navData.labels.home}
          >
            <span>
              <Image
                className="hidden dark:block"
                src="/assets/arkfid--light.svg"
                width={100}
                height={32}
                alt=""
                sizes="(max-width: 768px) 88px, 100px"
                decoding="async"
              />
              <Image
                className="dark:hidden"
                src="/assets/arkfid--color.svg"
                width={100}
                height={32}
                alt=""
                sizes="(max-width: 768px) 88px, 100px"
                decoding="async"
              />
            </span>
          </Link>
          <div className="hidden md:block">
            <NavMenu locale={locale} navData={navData} />
          </div>
          <div className="md:hidden pb-30">
            <MobileMenuLazy locale={locale} navData={navData} />
          </div>
        </div>
      </nav>
    </div>
  );
};

export default Navbar;
