import Link from "next/link";
import Image from "next/image";
import HeaderControls from "@/src/components/navigation/HeaderControls";
import MobileMenuIsland from "@/src/components/navigation/MobileMenuIsland";

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
    <div className="fixed top-0 w-full max-w-[100vw] z-50">
      <nav className="h-16 bg-background border-b border-accent">
        <div className="h-full flex items-center max-w-[1200px] mx-auto justify-between px-4 sm:px-6">
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

          {/* Desktop primary navigation (server-rendered) */}
          <div className="hidden md:block">
            <nav aria-label="Primary">
              <ul className="flex items-center gap-1">
                <li>
                  <Link
                    href={`${localePrefix}/`}
                    prefetch={false}
                    locale={locale}
                    className="px-3 py-2 rounded-md hover:bg-accent min-w-[92px] text-center"
                  >
                    {navData.labels.home}
                  </Link>
                </li>
                <li>
                  <Link
                    href={`${localePrefix}/team`}
                    prefetch={false}
                    locale={locale}
                    className="px-3 py-2 rounded-md hover:bg-accent min-w-[92px] text-center"
                  >
                    {navData.labels.team}
                  </Link>
                </li>
                <li className="relative group">
                  <Link
                    href={`${localePrefix}/services`}
                    prefetch={false}
                    locale={locale}
                    className="px-3 py-2 rounded-md hover:bg-accent min-w-[100px] text-center inline-flex items-center gap-1"
                  >
                    {navData.labels.services}
                    <span className="transition-transform duration-200 group-hover:rotate-180">
                      ▾
                    </span>
                  </Link>
                  {/* CSS-only dropdown: opens on hover and keyboard focus */}
                  <div className="invisible opacity-0 pointer-events-none group-hover:visible group-hover:opacity-100 group-hover:pointer-events-auto group-focus-within:visible group-focus-within:opacity-100 group-focus-within:pointer-events-auto transition-all duration-150 absolute left-0 top-full mt-2 w-[min(92vw,720px)] bg-background border rounded-md shadow-xl z-50">
                    <div className="p-3">
                      <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {navData.services.map((item) => (
                          <li key={item.href} className="min-w-0">
                            <Link
                              href={`${localePrefix}/services${item.href}`}
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
                    className="px-3 py-2 rounded-md hover:bg-accent min-w-[112px] text-center"
                  >
                    {navData.labels.ressources}
                  </Link>
                </li>
                <li>
                  <Link
                    href={`${localePrefix}/about`}
                    prefetch={false}
                    locale={locale}
                    className="px-3 py-2 rounded-md hover:bg-accent min-w-[92px] text-center"
                  >
                    {navData.labels.about}
                  </Link>
                </li>
                <li>
                  <Link
                    href={`${localePrefix}/contact`}
                    prefetch={false}
                    locale={locale}
                    className="px-3 py-2 rounded-md hover:bg-accent min-w-[96px] text-center"
                  >
                    {navData.labels.contact}
                  </Link>
                </li>
                {/* Client controls (Lang + Theme) wrapped in NavigationMenu context */}
                <li className="ml-1">
                  <HeaderControls />
                </li>
              </ul>
            </nav>
          </div>

          {/* Mobile menu (client) */}
          <div className="md:hidden pb-30">
            <MobileMenuIsland locale={locale} navData={navData} />
          </div>
        </div>
      </nav>
    </div>
  );
}
