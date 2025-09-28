import Link from "next/link";
import Image from "next/image";
import dynamic from "next/dynamic";
import Defer from "@/src/components/Defer";

const HeaderControls = dynamic(
  () => import("@/src/components/navigation/HeaderControls"),
  { ssr: false, loading: () => null }
);
const MobileMenuIsland = dynamic(
  () => import("@/src/components/navigation/MobileMenuIsland"),
  { ssr: false, loading: () => null }
);

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

export default function NavbarServer({
  locale,
  navData,
}: {
  locale?: string;
  navData: NavData;
}) {
  const localePrefix = locale ? `/${locale}` : "/fr";

  return (
    <div className="critical-nav__container critical-nav">
      <nav className="critical-nav__surface">
        <div className="critical-nav__inner">
          <Link
            href={`${localePrefix}/`}
            prefetch={false}
            locale={locale}
            aria-label={navData.labels.home}
          >
            <span className="critical-nav__logo">
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
          <div className="hidden md:block critical-nav__links">
            <nav aria-label="Primary">
              <ul className="flex items-center gap-1">
                <li>
                  <Link
                    href={`${localePrefix}/`}
                    prefetch={false}
                    locale={locale}
                    className="px-3 py-2 rounded-md hover:bg-accent min-w-[92px] text-center critical-nav__link"
                  >
                    {navData.labels.home}
                  </Link>
                </li>
                <li>
                  <Link
                    href={`${localePrefix}/team`}
                    prefetch={false}
                    locale={locale}
                    className="px-3 py-2 rounded-md hover:bg-accent min-w-[92px] text-center critical-nav__link"
                  >
                    {navData.labels.team}
                  </Link>
                </li>
                <li className="relative group">
                  {/* The main trigger link */}
                  <Link
                    href={`${localePrefix}/services`}
                    prefetch={false}
                    locale={locale}
                    className="px-3 py-2 rounded-md hover:bg-accent min-w-[100px] text-center inline-flex items-center gap-1 critical-nav__link"
                  >
                    {navData.labels.services}
                    <span className="transition-transform duration-200 group-hover:rotate-180">
                      ▾
                    </span>
                  </Link>

                  {/* 
    CSS-only dropdown menu.
    - The `pt-2` class is the key fix for the hover-out issue.
    - We have removed `group-focus-within` to ensure hover-out always closes it.
  */}
                  <div className="invisible opacity-0 pointer-events-none group-hover:visible group-hover:opacity-100 group-hover:pointer-events-auto transition-all duration-150 absolute left-0 top-full pt-2 w-[min(92vw,720px)] bg-background border rounded-md shadow-xl z-50">
                    <div className="p-3">
                      <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {navData.services.map((item) => (
                          <li key={item.href} className="min-w-0">
                            <Link
                              href={`${localePrefix}${item.href}`}
                              prefetch={false}
                              locale={locale}
                              className="block rounded-md p-3 hover:bg-accent focus:bg-accent focus:outline-none focus:ring-2 focus:ring-primary"
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
                        >
                          {navData.labels.services} →
                        </Link>
                      </div>
                    </div>
                  </div>
                </li>
                <li>
                  <Link
                    href={`${localePrefix}/ressources`}
                    prefetch={false}
                    locale={locale}
                    className="px-3 py-2 rounded-md hover:bg-accent min-w-[112px] text-center critical-nav__link"
                  >
                    {navData.labels.ressources}
                  </Link>
                </li>
                <li>
                  <Link
                    href={`${localePrefix}/about`}
                    prefetch={false}
                    locale={locale}
                    className="px-3 py-2 rounded-md hover:bg-accent min-w-[92px] text-center critical-nav__link"
                  >
                    {navData.labels.about}
                  </Link>
                </li>
                <li>
                  <Link
                    href={`${localePrefix}/contact`}
                    prefetch={false}
                    locale={locale}
                    className="px-3 py-2 rounded-md hover:bg-accent min-w-[96px] text-center critical-nav__link"
                  >
                    {navData.labels.contact}
                  </Link>
                </li>
                {/* Client controls (Lang + Theme) loaded client-only and deferred to reduce TBT */}
                <li className="ml-1">
                  <Defer rootMargin="100px" idle={100} placeholder={null}>
                    <HeaderControls />
                  </Defer>
                </li>
              </ul>
            </nav>
          </div>

          {/* Mobile menu (client-only, split into its own chunk and deferred) */}
          <div className="md:hidden pb-30 critical-nav__mobile">
            <Defer rootMargin="100px" idle={150} placeholder={null}>
              <MobileMenuIsland locale={locale} navData={navData} />
            </Defer>
          </div>
        </div>
      </nav>
    </div>
  );
}
