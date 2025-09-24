"use client";
import React from "react";
import Link from "next/link";
import ServicesElements from "@/app/[locale]/navigation";
import type { NavigationMenuProps } from "@radix-ui/react-navigation-menu";
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
  navigationMenuTriggerStyle,
} from "@/src/components/navigation/NavigationComponents";
import dynamic from "next/dynamic";
import ThemeToggle from "./ThemeToggle";
import LangSwitch from "./LangSwitch";
// No client-side translation here; labels are provided by server

function ListItem({
  title,
  children,
  href,
  icon,
  onClick,
  locale,
}: {
  title: React.ReactNode;
  children: React.ReactNode;
  href: string;
  icon: React.ReactNode;
  onClick?: () => void;
  locale?: string;
}) {
  return (
    <li>
      <NavigationMenuLink asChild>
        <Link
          href={href}
          prefetch={false}
          onClick={onClick}
          locale={locale}
          className="block select-none space-y-1 rounded-md p-3 leading-none no-underline outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground"
        >
          <div className="flex gap-2 items-center text-sm font-medium leading-none">
            {icon && icon}
            {title}
          </div>
          <p className="line-clamp-2 text-sm leading-snug">{children}</p>
        </Link>
      </NavigationMenuLink>
    </li>
  );
}

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

function NavMenu({
  orientation,
  locale,
  navData,
  ...props
}: NavigationMenuProps & { locale?: string; navData: NavData }) {
  const ServicesContent = React.useMemo(
    () =>
      dynamic(
        () => import("@/src/components/navigation/ServicesDropdownContent"),
        { ssr: false }
      ),
    []
  );
  const [openServices, setOpenServices] = React.useState(false);
  const preloaded = React.useRef(false);

  const prewarmServices = React.useCallback(() => {
    if (preloaded.current) return;
    preloaded.current = true;
    // Fire and forget import to warm the chunk
    import("@/src/components/navigation/ServicesDropdownContent").catch(() => {
      // ignore
    });
  }, []);

  // Removed idle prefetch on desktop to reduce TBT spikes; load on interaction only
  const isActive = React.useCallback((path: string) => {
    // active state is best-effort in client; keep simple equality check against window.pathname
    try {
      return typeof window !== "undefined" && window.location.pathname === path;
    } catch {
      return false;
    }
  }, []);
  const localePrefix = locale ? `/${locale}` : "";

  return (
    <NavigationMenu
      viewport={false}
      style={{ zIndex: 10 }}
      orientation={orientation}
      {...props}
    >
      <NavigationMenuList className="pt-1 text-md gap-1 space-x-0">
        <NavigationMenuItem>
          <NavigationMenuLink
            asChild
            className={
              navigationMenuTriggerStyle() + (isActive("/") ? " bg-accent" : "")
            }
          >
            <Link
              href={`${localePrefix}/`}
              prefetch={false}
              locale={locale}
              aria-current={isActive(`${localePrefix}/`) ? "page" : undefined}
            >
              {navData.labels.home}
            </Link>
          </NavigationMenuLink>
        </NavigationMenuItem>
        <NavigationMenuItem>
          <NavigationMenuLink
            asChild
            className={
              navigationMenuTriggerStyle() +
              (isActive("/team") ? " bg-accent" : "")
            }
          >
            <Link
              href={`${localePrefix}/team`}
              prefetch={false}
              locale={locale}
              aria-current={
                isActive(`${localePrefix}/team`) ? "page" : undefined
              }
            >
              {navData.labels.team}
            </Link>
          </NavigationMenuLink>
        </NavigationMenuItem>

        <NavigationMenuItem>
          <NavigationMenuTrigger aria-haspopup="menu">
            {navData.labels.services}
          </NavigationMenuTrigger>
        </NavigationMenuItem>
        <NavigationMenuItem>
          <NavigationMenuLink
            asChild
            className={
              navigationMenuTriggerStyle() +
              (isActive("/ressources") ? " bg-accent" : "")
            }
          >
            <Link
              href={`${localePrefix}/ressources`}
              prefetch={false}
              locale={locale}
              aria-current={
                isActive(`${localePrefix}/ressources`) ? "page" : undefined
              }
            >
              {navData.labels.ressources}
            </Link>
          </NavigationMenuLink>
        </NavigationMenuItem>
        <NavigationMenuItem>
          <NavigationMenuLink
            asChild
            className={
              navigationMenuTriggerStyle() +
              (isActive("/about") ? " bg-accent" : "")
            }
          >
            <Link
              href={`${localePrefix}/about`}
              prefetch={false}
              locale={locale}
              aria-current={
                isActive(`${localePrefix}/about`) ? "page" : undefined
              }
            >
              {navData.labels.about}
            </Link>
          </NavigationMenuLink>
        </NavigationMenuItem>
        <NavigationMenuItem>
          <NavigationMenuLink
            asChild
            className={
              navigationMenuTriggerStyle() +
              (isActive("/contact") ? " bg-accent" : "")
            }
          >
            <Link
              href={`${localePrefix}/contact`}
              prefetch={false}
              locale={locale}
              aria-current={
                isActive(`${localePrefix}/contact`) ? "page" : undefined
              }
            >
              {navData.labels.contact}
            </Link>
          </NavigationMenuLink>
        </NavigationMenuItem>
        <LangSwitch />
        <ThemeToggle />
      </NavigationMenuList>
    </NavigationMenu>
  );
}

export default NavMenu;
