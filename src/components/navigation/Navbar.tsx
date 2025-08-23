"use client";
import NavMenu from "@/src/components/navigation/NavMenu";
import MobileMenu from "@/src/components/navigation/MobileMenu";
import Link from "next/link";
import { useEffect, useState } from "react";
import Image from "next/image";

const Navbar = () => {
  const [scrollTop, setScrollTop] = useState(0);
  useEffect(() => {
    const onScroll = (e: any) => {
      setScrollTop(e.target.documentElement.scrollTop);
    };
    window.addEventListener("scroll", onScroll);

    return () => window.removeEventListener("scroll", onScroll);
  }, [scrollTop]);

  return (
    <div className="fixed top-0 w-full max-w-[100vw] z-50">
      <nav
        className={
          "h-16 bg-background border-b border-accent " +
          (scrollTop > 100 ? "shadow-2xl" : "")
        }
      >
        <div className="h-full flex items-center max-w-[100vw] justify-between px-4 sm:px-6">
          <Link href={"/"}>
            <span>
              <Image
                className="hidden dark:block"
                src="/assets/arkfid--light.svg"
                width={100}
                height={32}
                alt="Ark Fiduciaire"
                priority
              />
              <Image
                className="dark:hidden"
                src="/assets/arkfid--color.svg"
                width={100}
                height={32}
                alt="Ark Fiduciaire"
                priority
              />
            </span>
          </Link>
          <div className="hidden md:block">
            <NavMenu />
          </div>
          <div className="md:hidden pb-30">
            <MobileMenu />
          </div>
        </div>
      </nav>
    </div>
  );
};

export default Navbar;
