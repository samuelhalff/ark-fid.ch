import Logo from "@/assets/arkfid--color.svg";
import LogoLight from "@/assets/arkfid--light.svg";
import NavMenu from "@/NavigationMenu/NavMenu";
import { NavigationSheet } from "@/NavigationMenu/NavigationSheet";
import ThemeToggle from "@/NavigationMenu/ThemeToggle";
import LangSwitch from "@/NavigationMenu/LangSwitch";
import { useTheme } from "@/components/ui/theme-provider";
import { Link } from "react-router-dom";

const Navbar = () => {
  const { theme } = useTheme();
  return (
    <nav className="h-16 bg-background border-b border-accent">
      <div className="h-full flex items-center justify-between max-w-screen-xl mx-auto px-4 sm:px-6">
        <Link to={"/"}>
          <img src={theme == "dark" ? LogoLight : Logo} width={100} />
        </Link>
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
