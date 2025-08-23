import { Button } from "@/src/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/src/components/ui/sheet";
import { Menu, X } from "lucide-react";
import LangSwitchMobile from "@/src/components/navigation/LangSwitchMobile";
import ThemeToggleMobile from "@/src/components/navigation/ThemeToggleMobile";
import ServicesMobile from "@/src/components/navigation/ServicesMobile";
import Image from "next/image";

const MobileMenu = () => {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="ghost" className="w-auto px-2 py-1 rounded-md">
          <Menu className="size-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full max-w-[100vw] p-0" hideClose>
        <SheetTitle className="hidden">Mobile Navigation</SheetTitle>
        <div className="flex items-center px-4 pt-4 border-b pb-4">
          <div className="flex-1 flex justify-start">
            <Image
              className="hidden dark:block"
              src="/assets/arkfid--light.svg"
              width={100}
              height={32}
              alt="Logo Light"
              priority
            />
            <Image
              className="dark:hidden"
              src="/assets/arkfid--color.svg"
              width={100}
              height={32}
              alt="Logo Dark"
              priority
            />
          </div>
          <SheetTrigger asChild>
            <button
              className="ml-2 p-2 rounded border hover:bg-accent transition-colors"
              aria-label="Close menu"
            >
              <X className="w-6 h-6" />
            </button>
          </SheetTrigger>
        </div>
        <div className=" max-h-[100vh] overflow-y-auto">
          <nav className="flex flex-col gap-3 px-4 mt-3 pb-10 mb-20 pt-2">
            <ThemeToggleMobile />
            <LangSwitchMobile />
            <div className="mt-3 mb-3">
              <a
                href="/contact"
                className="block w-full text-center font-semibold text-lg py-3 rounded-xl border border-accent bg-transparent hover:bg-accent/30 transition-colors"
                style={{ letterSpacing: 0.5 }}
              >
                Contact
              </a>
            </div>
            <div>
              <a
                href="/"
                className="flex items-center gap-3 text-md px-2 py-2 rounded hover:bg-accent transition-colors"
              >
                <span>Home</span>
              </a>
            </div>
            <div>
              <a
                href="/team"
                className="flex items-center gap-3 text-md px-2 py-2 rounded hover:bg-accent transition-colors"
              >
                <span>Team</span>
              </a>
            </div>
            <ServicesMobile />
            <div>
              <a
                href="/ressources"
                className="flex items-center gap-3 text-md px-2 py-2 rounded hover:bg-accent transition-colors"
              >
                <span>Ressources</span>
              </a>
            </div>
          </nav>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default MobileMenu;
