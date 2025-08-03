import React from "react";
import { Routes, Route, Link } from "react-router-dom";
import Home from "./pages/Home";
import About from "./pages/About";
import NavigationElements from "./NavigationElements";
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
import { CircleCheckIcon, CircleHelpIcon, CircleIcon } from "lucide-react";

// ListItem has been updated to use Tailwind classes for a better hover effect,
// which is standard for shadcn/ui navigation menus.
function ListItem({
  title,
  children,
  href,
}: {
  title: string;
  children: React.ReactNode;
  href: string;
}) {
  return (
    <li>
      <NavigationMenuLink asChild>
        <Link
          to={href}
          className="block select-none space-y-1 rounded-md p-3 leading-none no-underline outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground"
        >
          <div className="text-sm font-medium leading-none">{title}</div>
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
                  <NavigationMenuTrigger>Components</NavigationMenuTrigger>
                  <NavigationMenuContent className="right-0 left-auto md:right-0 md:left-auto">
                    <ul className="grid w-[400px] gap-2 md:w-[500px] md:grid-cols-2 lg:w-[600px]">
                      {NavigationElements.map((component) => (
                        <ListItem
                          key={component.title}
                          title={component.title}
                          href={component.href}
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
                    <Link to="/about">About</Link>
                  </NavigationMenuLink>
                </NavigationMenuItem>
                <NavigationMenuItem>
                  <NavigationMenuTrigger>With Icon</NavigationMenuTrigger>
                  <NavigationMenuContent className="right-0 left-auto md:right-0 md:left-auto">
                    <ul className="grid w-[200px] gap-4">
                      <li>
                        <NavigationMenuLink asChild>
                          <Link to="#" className="flex-row items-center gap-2">
                            <CircleHelpIcon />
                            Backlog
                          </Link>
                        </NavigationMenuLink>
                        <NavigationMenuLink asChild>
                          <Link to="#" className="flex-row items-center gap-2">
                            <CircleIcon />
                            To Do
                          </Link>
                        </NavigationMenuLink>
                        <NavigationMenuLink asChild>
                          <Link to="#" className="flex-row items-center gap-2">
                            <CircleCheckIcon />
                            Done
                          </Link>
                        </NavigationMenuLink>
                      </li>
                    </ul>
                  </NavigationMenuContent>
                </NavigationMenuItem>
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
          <Route path="/about" element={<About />} />
          {/* Add more routes as needed */}
        </Routes>
      </main>
    </>
  );
}

export default App;
