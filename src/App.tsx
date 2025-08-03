import React from "react";
import { Routes, Route, Link } from "react-router-dom";
import Home from "./pages/Home";
import Team from "./pages/Team";
import ServicesElements from "./ServicesElements";
import ArkLogo from "./assets/arkfid--color.svg";

import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
  navigationMenuTriggerStyle,
} from "@/components/ui/navigation-menu";
import LangSwitch from "@/components/ui/LangSwitch";
import { CircleIcon } from "lucide-react";

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
          <div className="flex gap-1 items-center text-sm font-medium leading-none">
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

function App() {
  return (
    <>
      {/* Header Section */}
      <header className="flex">
        {/* 
          - flex, items-center: Aligns logo and navigation vertically.
          - justify-between: Pushes logo to the left and nav to the right.
          - w-full, max-w-[1800px], mx-auto: Standard container styling.
          - h-16, px-8: Defines height and horizontal padding. (h-16 is 4rem, more standard for a navbar)
        */}
        <div className="flex items-center justify-between w-full max-w-[1800px] mx-auto h-16 px-8">
          {/* Logo */}
          <div className="w-[100px] mr-4 flex-shrink-0">
            <img
              src={ArkLogo}
              alt="Ark Fiduciaire"
              className="block w-full h-auto"
            />
          </div>

          {/* Navigation */}
          <div className="flex">
            <NavigationMenu viewport={false} style={{ height: 30 }}>
              <NavigationMenuList>
                <NavigationMenuItem>
                  <NavigationMenuLink
                    asChild
                    className={navigationMenuTriggerStyle()}
                  >
                    <Link to="/">Home</Link>
                  </NavigationMenuLink>
                </NavigationMenuItem>
                <NavigationMenuItem>
                  <NavigationMenuTrigger>Services</NavigationMenuTrigger>
                  <NavigationMenuContent className="right-0 left-auto md:right-0 md:left-auto">
                    <ul className="grid w-[400px] gap-2 md:w-[500px] md:grid-cols-2 lg:w-[600px]">
                      {ServicesElements.map((component) => (
                        <ListItem
                          key={component.title}
                          title={component.title}
                          href={component.href}
                          icon={component.icon}
                        >
                          {component.description}
                        </ListItem>
                      ))}
                    </ul>
                  </NavigationMenuContent>
                </NavigationMenuItem>
                <NavigationMenuItem>
                  <NavigationMenuLink
                    asChild
                    className={navigationMenuTriggerStyle()}
                  >
                    <Link to="/team">Team</Link>
                  </NavigationMenuLink>
                </NavigationMenuItem>
                <NavigationMenuItem>|</NavigationMenuItem>
                <LangSwitch />
              </NavigationMenuList>
            </NavigationMenu>
          </div>
        </div>
      </header>

      {/* Page Content */}
      {/* The Routes component itself cannot be styled. Wrap it in a div or main tag. */}
      <main className="p-8">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/team" element={<Team />} />
          {/* Add more routes as needed */}
        </Routes>
      </main>
    </>
  );
}

export default App;
