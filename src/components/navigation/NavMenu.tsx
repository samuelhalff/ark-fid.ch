"use client";
import React from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import ServicesElements from "@/app/services/navigation";
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

function NavMenu({ orientation, ...props }: NavigationMenuProps) {
  const pathname = usePathname();
  const isActive = React.useCallback(
    (path: string) => pathname === path,
    [pathname]
  );

  return (
    <NavigationMenu
      viewport={false}
      style={{ zIndex: 10 }}
      orientation={orientation}
      {...props}
    >
      <NavigationMenuList className="pt-3 text-md gap-8 space-x-0">
        <NavigationMenuItem>
          <NavigationMenuLink
            asChild
            className={
              navigationMenuTriggerStyle() + (isActive("/") ? " bg-accent" : "")
            }
          >
            <Link href="/">
              <TranslatedText
                translationKey="NavBar.Home"
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
            <Link href="/team">
              <TranslatedText
                translationKey="NavBar.Team"
                fallbackText="Team"
              />
            </Link>
          </NavigationMenuLink>
        </NavigationMenuItem>
        <NavigationMenuItem>
          <NavigationMenuTrigger>
            <TranslatedText
              translationKey="NavBar.Services"
              fallbackText="Services"
            />
          </NavigationMenuTrigger>
          <NavigationMenuContent>
            <ul className="grid w-[400px] gap-2 md:w-[350px] md:grid-cols-2 lg:w-[600px]">
              {ServicesElements.map((component) => (
                <ListItem
                  key={component.titleKey}
                  title={
                    <TranslatedText
                      translationKey={component.titleKey}
                      fallbackText={component.titleKey.replace("NavBar.", "")}
                    />
                  }
                  href={component.href}
                  icon={component.icon}
                >
                  <TranslatedText
                    translationKey={component.descriptionKey}
                    fallbackText={component.descriptionKey.replace(
                      "NavBar.",
                      ""
                    )}
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
            <Link href="/ressources">
              <TranslatedText
                translationKey="NavBar.Ressources"
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
            <Link href="/contact">
              <TranslatedText
                translationKey="NavBar.Contact"
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
