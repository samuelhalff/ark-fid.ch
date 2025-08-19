import React from "react";
import { Link, useLocation } from "react-router-dom";
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
import ThemeToggle from "./ThemeToggle";
import LangSwitch from "./LangSwitch";
import {
  ChevronDown,
  Home,
  Users,
  Mail,
  Briefcase,
  Globe,
  Moon,
} from "lucide-react";
import { SheetClose } from "@/components/ui/sheet";

// ListItem has been updated to use Tailwind classes for a better hover effect,
// which is standard for shadcn/ui navigation menus.
function ListItem({
  title,
  children,
  href,
  icon,
  onClick,
  isMobile,
}: {
  title: string;
  children: React.ReactNode;
  href: string;
  icon: React.ReactNode;
  onClick?: () => void;
  isMobile: boolean;
}) {
  return (
    <li>
      <NavigationMenuLink asChild>
        {isMobile ? (
          <SheetClose asChild>
            <Link
              to={href}
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
          </SheetClose>
        ) : (
          <Link
            to={href}
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
        )}
      </NavigationMenuLink>
    </li>
  );
}

function NavMenu({ orientation, ...props }: NavigationMenuProps) {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const isActive = React.useCallback(
    (path: string) => pathname === path,
    [pathname]
  );

  const isMobile = orientation == "vertical";
  const [servicesOpen, setServicesOpen] = React.useState(false);
  const [langOpen, setLangOpen] = React.useState(false);
  const [themeOpen, setThemeOpen] = React.useState(false);

  // Icon mapping for main items
  const iconClass =
    "mr-2 w-5 h-5 min-w-[20px] min-h-[20px] max-w-[20px] max-h-[20px] inline-block stroke-[1.5] text-muted-foreground flex-shrink-0";
  const mainIcons = {
    home: <Home className={iconClass} />,
    services: <Briefcase className={iconClass} />,
    team: <Users className={iconClass} />,
    contact: <Mail className={iconClass} />,
    theme: <Moon className={iconClass} />,
    language: <Globe className={iconClass} />,
  };

  // Helper to handle exclusive open for mobile collapsibles
  const handleMobileCollapse = (menu: "services" | "theme" | "lang") => {
    setServicesOpen(menu === "services" ? (prev) => !prev : false);
    setThemeOpen(menu === "theme" ? (prev) => !prev : false);
    setLangOpen(menu === "lang" ? (prev) => !prev : false);
  };

  return (
    <NavigationMenu
      viewport={false}
      style={{
        zIndex: 10,
        paddingTop: 15,
        paddingBottom: 15,
        overflowY: !isMobile ? undefined : "scroll",
      }}
      orientation={orientation}
      {...props}
    >
      <NavigationMenuList
        className={
          "gap-6 space-x-0 data-[orientation=vertical]:flex-col data-[orientation=vertical]:items-start" +
          (isMobile
            ? " overflow-y-auto max-h-[80vh] scrollbar-thin scrollbar-thumb-rounded scrollbar-thumb-neutral-300 scrollbar-track-transparent touch-pan-y"
            : "")
        }
        style={isMobile ? { WebkitOverflowScrolling: "touch" } : {}}
      >
        <NavigationMenuItem>
          <NavigationMenuLink
            asChild
            className={
              navigationMenuTriggerStyle() + (isActive("/") ? " bg-accent" : "")
            }
          >
            {isMobile ? (
              <SheetClose asChild>
                <Link to="/">
                  <span className="flex items-center">
                    {mainIcons.home}
                    {t("NavBar.Home")}
                  </span>
                </Link>
              </SheetClose>
            ) : (
              <Link to="/">{t("NavBar.Home")}</Link>
            )}
          </NavigationMenuLink>
        </NavigationMenuItem>
        <NavigationMenuItem>
          {isMobile ? (
            <>
              <button
                className={
                  navigationMenuTriggerStyle() +
                  (servicesOpen ? " bg-accent" : "") +
                  " w-full flex justify-between items-center"
                }
                onClick={() => handleMobileCollapse("services")}
                aria-expanded={servicesOpen}
                aria-controls="services-mobile-list"
                type="button"
              >
                <span className="flex items-center">
                  {mainIcons.services}
                  {t("NavBar.Services")}
                </span>
                <span
                  className={
                    "ml-2 transition-transform text-lg text-muted-foreground " +
                    (servicesOpen ? "rotate-180" : "rotate-0")
                  }
                >
                  <ChevronDown />
                </span>
              </button>
              {servicesOpen && (
                <ul id="services-mobile-list" className="w-full py-2 ml-7">
                  {ServicesElements.map((component) => (
                    <ListItem
                      key={component.titleKey}
                      title={t(component.titleKey)}
                      href={component.href}
                      icon={component.icon}
                      onClick={() => setServicesOpen(false)}
                      isMobile={true}
                    >
                      {/* {t(component.descriptionKey)} */}
                      <></>
                    </ListItem>
                  ))}
                </ul>
              )}
            </>
          ) : (
            <>
              <NavigationMenuTrigger>
                {t("NavBar.Services")}
              </NavigationMenuTrigger>
              <NavigationMenuContent>
                <ul className="grid w-[400px] gap-2 md:w-[350px] md:grid-cols-2 lg:w-[600px]">
                  {ServicesElements.map((component) => (
                    <ListItem
                      key={component.titleKey}
                      title={t(component.titleKey)}
                      href={component.href}
                      icon={component.icon}
                      isMobile={false}
                    >
                      {t(component.descriptionKey)}
                    </ListItem>
                  ))}
                </ul>
              </NavigationMenuContent>
            </>
          )}
        </NavigationMenuItem>
        <NavigationMenuItem>
          <NavigationMenuLink
            asChild
            className={
              navigationMenuTriggerStyle() +
              (isActive("/team") ? " bg-accent" : "")
            }
          >
            {isMobile ? (
              <SheetClose asChild>
                <Link to="/team">
                  <span className="flex items-center">
                    {mainIcons.team}
                    {t("NavBar.Team")}
                  </span>
                </Link>
              </SheetClose>
            ) : (
              <Link to="/team">{t("NavBar.Team")}</Link>
            )}
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
            {isMobile ? (
              <SheetClose asChild>
                <Link to="/contact">
                  <span className="flex items-center">
                    {mainIcons.contact}
                    {t("NavBar.Contact")}
                  </span>
                </Link>
              </SheetClose>
            ) : (
              <Link to="/contact">{t("NavBar.Contact")}</Link>
            )}
          </NavigationMenuLink>
        </NavigationMenuItem>
        {isMobile && (
          <>
            {/* ThemeToggle collapse */}
            <button
              className={
                navigationMenuTriggerStyle() +
                (themeOpen ? " bg-accent" : "") +
                " w-full flex justify-between items-center mt-2"
              }
              onClick={() => handleMobileCollapse("theme")}
              aria-expanded={themeOpen}
              aria-controls="theme-mobile-list"
              type="button"
            >
              <span className="flex items-center">
                {mainIcons.theme}
                {t("NavBar.Theme") || "Theme"}
              </span>
              <span
                className={
                  "ml-2 transition-transform text-lg text-muted-foreground " +
                  (themeOpen ? "rotate-180" : "rotate-0")
                }
              >
                <ChevronDown />
              </span>
            </button>
            {themeOpen && (
              <div id="theme-mobile-list" className="w-full py-2">
                <ThemeToggle mobile={true} />
              </div>
            )}
            <button
              className={
                navigationMenuTriggerStyle() +
                (langOpen ? " bg-accent" : "") +
                " w-full flex justify-between items-center mt-2"
              }
              onClick={() => handleMobileCollapse("lang")}
              aria-expanded={langOpen}
              aria-controls="lang-mobile-list"
              type="button"
            >
              <span className="flex items-center">
                {mainIcons.language}
                {t("NavBar.Language") || "Language"}
              </span>
              <span
                className={
                  "ml-2 transition-transform text-lg text-muted-foreground " +
                  (langOpen ? "rotate-180" : "rotate-0")
                }
              >
                <ChevronDown />
              </span>
            </button>
            {langOpen && (
              <div id="lang-mobile-list" className="w-full py-2">
                <LangSwitch mobile={true} />
              </div>
            )}
          </>
        )}
        {!isMobile && <LangSwitch />}
        {!isMobile && <ThemeToggle />}
      </NavigationMenuList>
    </NavigationMenu>
  );
}

export default NavMenu;
