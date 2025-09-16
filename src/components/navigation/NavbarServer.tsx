import Link from "next/link";
import Image from "next/image";
import LangSwitch from "@/src/components/navigation/LangSwitch";
import ThemeToggle from "@/src/components/navigation/ThemeToggle";
import MobileMenu from "@/src/components/navigation/MobileMenu";

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
                <li>
                  <Link
                    href={`${localePrefix}/services`}
                    prefetch={false}
                    locale={locale}
                    className="px-3 py-2 rounded-md hover:bg-accent min-w-[100px] text-center"
                  >
                    {navData.labels.services}
                  </Link>
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
                {/* Client islands for Lang + Theme */}
                <li className="ml-1">
                  <LangSwitch />
                </li>
                <li>
                  <ThemeToggle />
                </li>
              </ul>
            </nav>
          </div>

          {/* Mobile menu (client) */}
          <div className="md:hidden pb-30">
            <MobileMenu locale={locale} navData={navData} />
          </div>
        </div>
      </nav>
    </div>
  );
}
