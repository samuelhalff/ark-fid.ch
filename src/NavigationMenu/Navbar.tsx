import Logo from "@/assets/arkfid--color.svg";
import LogoLight from "@/assets/arkfid--light.svg";
import NavMenu from "@/NavigationMenu/NavMenu";
import { NavigationSheet } from "@/NavigationMenu/NavigationSheet";
import { Link } from "react-router-dom";
import { useEffect, useState } from "react";

const Navbar = () => {
  const [scrollTop, setScrollTop] = useState(0);
  useEffect(() => {
    const onScroll = (e: any) => {
      setScrollTop(e.target.documentElement.scrollTop);
    };
    window.addEventListener("scroll", onScroll);

    return () => window.removeEventListener("scroll", onScroll);
  }, [scrollTop]);
  console.log(scrollTop);
  return (
    <div className="sticky top-0 w-full z-15">
      <nav
        className={
          "h-16 bg-background border-b border-accent " +
          (scrollTop > 100 ? "shadow-2xl" : "")
        }
      >
        <div className="h-full flex items-center justify-between max-w-screen-xl mx-auto px-4 sm:px-6">
          <Link to={"/"}>
            <img className="light:hidden" src={LogoLight} width={100} />
            <img className="dark:hidden" src={Logo} width={100} />
          </Link>
          <NavMenu className="hidden md:block" />
          <div className="md:hidden">
            <NavigationSheet />
          </div>
        </div>
      </nav>
    </div>
  );
};

export default Navbar;
