"use client";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useState } from "react";
import Image from "next/image";

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
    icon: React.ReactNode;
    title: string;
    description: string;
  }>;
};

const MobileMenuLazy = dynamic(
  () => import("@/src/components/navigation/MobileMenu"),
  { ssr: false }
);

const NavMenuLazy = dynamic(
  () => import("@/src/components/navigation/NavMenu"),
  { ssr: false, loading: () => null }
);

const Navbar = ({ locale, navData }: { locale?: string; navData: NavData }) => {
  const localePrefix = locale ? `/${locale}` : "/fr";
  const [scrollTop, setScrollTop] = useState(0);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [loadDesktopNav, setLoadDesktopNav] = useState(false);
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

  // Proactively load the desktop navigation on desktop devices to remove first-hover delay
  useEffect(() => {
    if (loadDesktopNav) return; // already loaded
    try {
      const isDesktop =
        window.matchMedia && window.matchMedia("(min-width: 768px)").matches;
      const finePointer =
        window.matchMedia && window.matchMedia("(pointer: fine)").matches;
      if (isDesktop && finePointer) {
        const idle = (cb: () => void) =>
          (window as any).requestIdleCallback
            ? (window as any).requestIdleCallback(cb)
            : setTimeout(cb, 200);
        idle(() => setLoadDesktopNav(true));
      }
    } catch {
      // no-op: SSR or older browsers
    }
  }, [loadDesktopNav]);

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
            aria-label="Ark Fiduciaire homepage"
          >
            <span>
              <Image
                className="hidden dark:block"
                src="/assets/arkfid--light.svg"
                width={100}
                height={32}
                alt="Ark Fiduciaire"
              />
              <Image
                className="dark:hidden"
                src="/assets/arkfid--color.svg"
                width={100}
                height={32}
                alt="Ark Fiduciaire"
              />
            </span>
          </Link>
          <div
            className="hidden md:block"
            onMouseEnter={() => setLoadDesktopNav(true)}
            onFocus={() => setLoadDesktopNav(true)}
          >
            {loadDesktopNav ? (
              <NavMenuLazy locale={locale} navData={navData} />
            ) : (
              <nav aria-label="Primary">
                <ul className="flex items-center gap-1">
                  <li>
                    <Link
                      href={`${localePrefix}/`}
                      prefetch={false}
                      locale={locale}
                      className="px-3 py-2 rounded-md hover:bg-accent"
                    >
                      {navData.labels.home}
                    </Link>
                  </li>
                  <li>
                    <Link
                      href={`${localePrefix}/team`}
                      prefetch={false}
                      locale={locale}
                      className="px-3 py-2 rounded-md hover:bg-accent"
                    >
                      {navData.labels.team}
                    </Link>
                  </li>
                  <li>
                    <Link
                      href={`${localePrefix}/services`}
                      prefetch={false}
                      locale={locale}
                      className="px-3 py-2 rounded-md hover:bg-accent"
                    >
                      {navData.labels.services}
                    </Link>
                  </li>
                  <li>
                    <Link
                      href={`${localePrefix}/ressources`}
                      prefetch={false}
                      locale={locale}
                      className="px-3 py-2 rounded-md hover:bg-accent"
                    >
                      {navData.labels.ressources}
                    </Link>
                  </li>
                  <li>
                    <Link
                      href={`${localePrefix}/about`}
                      prefetch={false}
                      locale={locale}
                      className="px-3 py-2 rounded-md hover:bg-accent"
                    >
                      {navData.labels.about}
                    </Link>
                  </li>
                  <li>
                    <Link
                      href={`${localePrefix}/contact`}
                      prefetch={false}
                      locale={locale}
                      className="px-3 py-2 rounded-md hover:bg-accent"
                    >
                      {navData.labels.contact}
                    </Link>
                  </li>
                </ul>
              </nav>
            )}
          </div>
          <div className="md:hidden pb-30">
            {showMobileMenu ? (
              <MobileMenuLazy locale={locale} navData={navData} />
            ) : (
              <button
                type="button"
                onClick={() => setShowMobileMenu(true)}
                className="w-auto px-2 py-1 rounded-md border hover:bg-accent transition-colors"
                aria-haspopup="dialog"
                aria-label={navData.labels.mobileNavigation || "Open menu"}
              >
                <span className="inline-flex items-center gap-2 text-sm">
                  {/* Simple hamburger icon (inline SVG) */}
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden
                    focusable="false"
                    className="-mt-0.5"
                  >
                    <line x1="3" y1="6" x2="21" y2="6" />
                    <line x1="3" y1="12" x2="21" y2="12" />
                    <line x1="3" y1="18" x2="21" y2="18" />
                  </svg>
                  <span>{navData.labels.mobileNavigation || "Menu"}</span>
                </span>
              </button>
            )}
          </div>
        </div>
      </nav>
    </div>
  );
};

export default Navbar;
