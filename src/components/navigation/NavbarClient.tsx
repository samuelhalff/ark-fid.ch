"use client";

import Link from "next/link";
import Image from "next/image";
import dynamic from "next/dynamic";
import Defer from "@/src/components/Defer";
import { usePathname } from "next/navigation";
import ServicesDropdown from "@/src/components/navigation/ServicesDropdown";
import type { NavData } from "@/src/components/navigation/types";

const HeaderControls = dynamic(
  () => import("@/src/components/navigation/HeaderControls"),
  { ssr: false, loading: () => null },
);
const MobileMenuIsland = dynamic(
  () => import("@/src/components/navigation/MobileMenuIsland"),
  { ssr: false, loading: () => null },
);

export default function NavbarClient({
  locale,
  navData,
}: {
  locale?: string;
  navData: NavData;
}) {
  const pathname = usePathname();
  const localePrefix = locale ? `/${locale}` : "/fr";

  const normalize = (p: string) => {
    if (!p) return "/";
    return p.length > 1 && p.endsWith("/") ? p.slice(0, -1) : p;
  };
  const isActive = (href: string) => normalize(pathname) === normalize(href);
  const isSection = (href: string) => {
    const cur = normalize(pathname);
    const base = normalize(href);
    return cur === base || cur.startsWith(base + "/");
  };
  const linkBase =
    "inline-flex items-center justify-center px-3 py-2 rounded-lg font-medium text-[0.95rem] text-center min-w-[92px] transition-colors duration-160 ease-in-out hover:bg-accent hover:text-accent-foreground";
  const activeClasses = "bg-accent text-accent-foreground";

  return (
    <div className="fixed top-0 left-0 right-0 z-50 w-full max-w-screen">
      <nav className="site-header backdrop-blur-[14px] bg-white border-b dark:bg-black h-16 flex items-center">
        <div className="site-header-inner flex items-center justify-between gap-4 h-full mx-auto max-w-[1200px] px-4 w-full sm:px-6">
          <Link
            href={`/${locale || 'fr'}/`}
            prefetch={false}
            locale={locale}
            aria-label={navData.labels.home}
          >
            <span className="site-logo flex items-center w-[100px] h-[32px]">
              <Image
                className="hidden dark:block"
                src="/assets/arkfid--light.svg"
                width={100}
                height={32}
                alt="Ark Fiduciaire"
                sizes="(max-width: 768px) 88px, 100px"
                decoding="async"
              />
              <Image
                className="dark:hidden"
                src="/assets/arkfid--color.svg"
                width={100}
                height={32}
                alt="Ark Fiduciaire"
                sizes="(max-width: 768px) 88px, 100px"
                decoding="async"
              />
            </span>
          </Link>

          {/* Desktop primary navigation (server-rendered) */}
          <div className="hidden md:block">
            <nav aria-label="Primary">
              <ul className="flex items-center gap-1">
                <li>
                  <Link
                    href={`${localePrefix}/`}
                    prefetch={false}
                    locale={locale}
                    aria-current={
                      isActive(`${localePrefix}`) ? "page" : undefined
                    }
                    className={`${linkBase} ${
                      isActive(`${localePrefix}`) ? activeClasses : ""
                    }`}
                  >
                    {navData.labels.home}
                  </Link>
                </li>
                <li>
                  <Link
                    href={`${localePrefix}/agent/`}
                    prefetch={false}
                    locale={locale}
                    aria-current={
                      isSection(`${localePrefix}/agent`) ? "page" : undefined
                    }
                    className={`${linkBase} min-w-[96px] ${
                      isSection(`${localePrefix}/agent`) ? activeClasses : ""
                    }`}
                  >
                    {navData.labels.agent}
                  </Link>
                </li>
                <li>
                  <Link
                    href={`${localePrefix}/team/`}
                    prefetch={false}
                    locale={locale}
                    aria-current={
                      isSection(`${localePrefix}/team`) ? "page" : undefined
                    }
                    className={`${linkBase} ${
                      isSection(`${localePrefix}/team`) ? activeClasses : ""
                    }`}
                  >
                    {navData.labels.team}
                  </Link>
                </li>
                <ServicesDropdown
                  locale={locale}
                  localePrefix={localePrefix}
                  navData={navData}
                  isActive={isSection(`${localePrefix}/services`)}
                />
                <li>
                  <Link
                    href={`${localePrefix}/ressources/`}
                    prefetch={false}
                    locale={locale}
                    aria-current={
                      isSection(`${localePrefix}/ressources`)
                        ? "page"
                        : undefined
                    }
                    className={`${linkBase} min-w-[112px] ${
                      isSection(`${localePrefix}/ressources`)
                        ? activeClasses
                        : ""
                    }`}
                  >
                    {navData.labels.ressources}
                  </Link>
                </li>
                <li>
                  <Link
                    href={`${localePrefix}/about/`}
                    prefetch={false}
                    locale={locale}
                    aria-current={
                      isSection(`${localePrefix}/about`) ? "page" : undefined
                    }
                    className={`${linkBase} ${
                      isSection(`${localePrefix}/about`) ? activeClasses : ""
                    }`}
                  >
                    {navData.labels.about}
                  </Link>
                </li>
                <li>
                  <Link
                    href={`${localePrefix}/contact/`}
                    prefetch={false}
                    locale={locale}
                    aria-current={
                      isSection(`${localePrefix}/contact`) ? "page" : undefined
                    }
                    className={`${linkBase} min-w-[96px] ${
                      isSection(`${localePrefix}/contact`) ? activeClasses : ""
                    }`}
                  >
                    {navData.labels.contact}
                  </Link>
                </li>
                <li className="site-header-controls ml-1">
                  <HeaderControls />
                </li>
              </ul>
            </nav>
          </div>

          {/* Mobile menu (client-only, deferred with safety maxDelay) */}
          <div className="flex md:hidden">
            <Defer
              rootMargin="100px"
              idle={150}
              maxDelay={1800}
              placeholder={null}
            >
              <MobileMenuIsland locale={locale} navData={navData} />
            </Defer>
          </div>
        </div>
      </nav>
    </div>
  );
}
