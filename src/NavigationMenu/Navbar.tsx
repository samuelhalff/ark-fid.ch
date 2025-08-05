import { Button } from "@/components/ui/button";
import Logo from "@/assets/arkfid--color.svg";
import NavMenu from "@/NavigationMenu/NavMenu";
import { NavigationSheet } from "@/NavigationMenu/NavigationSheet";
import ThemeToggle from "@/NavigationMenu/ThemeToggle";
import LangSwitch from "@/NavigationMenu/LangSwitch";
import { NavigationMenu } from "@/NavigationMenu/NavigationComponents";

const Navbar = () => {
  return (
    <nav className="h-16 bg-background border-b border-accent">
      <div className="h-full flex items-center justify-between max-w-screen-xl mx-auto px-4 sm:px-6">
        <img src={Logo} width={100} />
        {/* Desktop Menu */}

        <NavMenu className="hidden md:block" />

        <div className="flex items-center gap-3">
          <LangSwitch />
          <ThemeToggle />

          {/* Mobile Menu */}
          <div className="md:hidden">
            <NavigationSheet />
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
