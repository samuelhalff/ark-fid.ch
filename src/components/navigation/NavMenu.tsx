"use client";
import React from "react";
import Link from "next/link";
import ServicesElements from "@/app/[locale]/navigation";
import { NavigationMenuProps } from "@radix-ui/react-navigation-menu";
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
  navigationMenuTriggerStyle,
} from "@/src/components/navigation/NavigationComponents";
import ThemeToggle from "./ThemeToggle";
import LangSwitch from "./LangSwitch";
import TranslatedText from "../ui/translated-text";

function ListItem({
  title,
  children,
  href,
  icon,
  onClick,
}: {
  title: React.JSX.Element;
  children: React.ReactNode;
  href: string;
  icon: React.ReactNode;
  onClick?: () => void;
}) {
  return (
    <li>
      <NavigationMenuLink asChild>
        <Link
          href={href}
          onClick={onClick}
          className="block select-none space-y-1 rounded-md p-3 leading-none no-underline outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground"
        >
          <div className="flex gap-2 items-center text-sm font-medium leading-none">
            {icon && icon}
            {title}
          </div>
          <p className="line-clamp-2 text-sm leading-snug text-muted-foreground">
            {children}
          </p>
        </Link>
      </NavigationMenuLink>
    </li>
  );
}

function NavMenu({
  orientation,
  locale,
  ...props
}: NavigationMenuProps & { locale?: string }) {
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
            <Link href={`${localePrefix}/`}>
              <TranslatedText
                ns="navbar"
                translationKey="Home"
                fallbackText="Home"
              />
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
            <Link href={`${localePrefix}/team`}>
              <TranslatedText
                ns="navbar"
                translationKey="Team"
                fallbackText="Team"
              />
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
            <Link href={`${localePrefix}/about`}>
              <TranslatedText
                ns="navbar"
                translationKey="About"
                fallbackText="About"
              />
            </Link>
          </NavigationMenuLink>
        </NavigationMenuItem>
        <NavigationMenuItem>
          <NavigationMenuTrigger>
            <TranslatedText
              ns="navbar"
              translationKey="Services"
              fallbackText="Services"
            />
          </NavigationMenuTrigger>
          <NavigationMenuContent className="left-auto right-0">
            <ul className="grid w-[400px] gap-2 md:w-[350px] md:grid-cols-2 lg:w-[600px]">
              {ServicesElements.map((component) => (
                <ListItem
                  key={component.titleKey}
                  title={
                    <TranslatedText
                      ns="navbar"
                      translationKey={component.titleKey}
                      fallbackText={component.titleKey}
                    />
                  }
                  href={localePrefix + component.href}
                  icon={component.icon}
                >
                  <TranslatedText
                    ns="navbar"
                    translationKey={component.descriptionKey}
                    fallbackText={component.descriptionKey}
                  />
                </ListItem>
              ))}
            </ul>
          </NavigationMenuContent>
        </NavigationMenuItem>
        <NavigationMenuItem>
          <NavigationMenuLink
            asChild
            className={
              navigationMenuTriggerStyle() +
              (isActive("/ressources") ? " bg-accent" : "")
            }
          >
            <Link href={`${localePrefix}/ressources`}>
              <TranslatedText
                ns="navbar"
                translationKey="Ressources"
                fallbackText="Ressources"
              />
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
            <Link href={`${localePrefix}/contact`}>
              <TranslatedText
                ns="navbar"
                translationKey="Contact"
                fallbackText="Contact"
              />
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
