import React from "react";
import { Routes, Route, Link } from "react-router-dom";
import Home from "./pages/Home";
import Team from "./pages/Team";
import ServicesElements from "./ServicesElements";
import ArkLogo from "./assets/arkfid--color.svg";
import NavBar from "@/NavigationMenu/Navbar";
import { ThemeProvider } from "@/components/ui/theme-provider";
import "./i18n.ts";

import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
  navigationMenuTriggerStyle,
} from "@/NavigationMenu/NavigationComponents";
import LangSwitch from "@/components/ui/LangSwitch";
import { CircleIcon } from "lucide-react";

function App() {
  return (
    <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
      <NavBar />
      {/* Page Content */}
      {/* The Routes component itself cannot be styled. Wrap it in a div or main tag. */}
      <main className="p-8">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/team" element={<Team />} />
          {/* Add more routes as needed */}
        </Routes>
      </main>
    </ThemeProvider>
  );
}

export default App;
