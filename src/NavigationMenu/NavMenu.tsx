import React from "react";
import { Link } from "react-router-dom";
import ServicesElements from "@/NavigationMenu/ServicesElements";
import { NavigationMenuProps } from "@radix-ui/react-navigation-menu";
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
  navigationMenuTriggerStyle,
} from "@/NavigationMenu/NavigationComponents";
import { useTranslation } from "react-i18next";

// ListItem has been updated to use Tailwind classes for a better hover effect,
// which is standard for shadcn/ui navigation menus.
function ListItem({
  title,
  children,
  href,
  icon,
}: {
  title: string;
  children: React.ReactNode;
  href: string;
  icon: React.ReactNode;
}) {
  return (
    <li>
      <NavigationMenuLink asChild>
        <Link
          to={href}
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

function NavMenu(props: NavigationMenuProps) {
  const { t } = useTranslation();
  return (
    <NavigationMenu
      viewport={false}
      style={{ height: 30, zIndex: 10 }}
      {...props}
    >
      <NavigationMenuList className="gap-6 space-x-0 data-[orientation=vertical]:flex-col data-[orientation=vertical]:items-start">
        <NavigationMenuItem>
          <NavigationMenuLink asChild className={navigationMenuTriggerStyle()}>
            <Link to="/">{t("NavBar.Home")}</Link>
          </NavigationMenuLink>
        </NavigationMenuItem>
        <NavigationMenuItem>
          <NavigationMenuTrigger>{t("NavBar.Services")}</NavigationMenuTrigger>
          <NavigationMenuContent>
            <ul className="grid w-[400px] gap-2 md:w-[500px] md:grid-cols-2 lg:w-[600px]">
              {ServicesElements.map((component) => (
                <ListItem
                  key={component.titleKey}
                  title={t(component.titleKey)}
                  href={component.href}
                  icon={component.icon}
                >
                  {t(component.descriptionKey)}
                </ListItem>
              ))}
            </ul>
          </NavigationMenuContent>
        </NavigationMenuItem>
        <NavigationMenuItem>
          <NavigationMenuLink asChild className={navigationMenuTriggerStyle()}>
            <Link to="/team">{t("NavBar.Team")}</Link>
          </NavigationMenuLink>
        </NavigationMenuItem>
        <NavigationMenuItem>
          <NavigationMenuLink asChild className={navigationMenuTriggerStyle()}>
            <Link to="/contact">{t("NavBar.Contact")}</Link>
          </NavigationMenuLink>
        </NavigationMenuItem>
      </NavigationMenuList>
    </NavigationMenu>
  );
}

export default NavMenu;
