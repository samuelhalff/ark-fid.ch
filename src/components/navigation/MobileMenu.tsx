"use client";
import { Button } from "@/src/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/src/components/ui/sheet";
import { ListEnd, Menu, X } from "lucide-react";
import LangSwitchMobile from "@/src/components/navigation/LangSwitchMobile";
import ThemeToggleMobile from "@/src/components/navigation/ThemeToggleMobile";
import ServicesMobile from "@/src/components/navigation/ServicesMobile";
import TranslatedText from "@/src/components/ui/translated-text";
import Image from "next/image";
import Footer from "@/app/[locale]/shared/footer";
import { useState } from "react";
import Link from "next/link";
// no usePathname needed; compute pathname from window when required

const MobileMenu = ({ locale }: { locale?: string }) => {
  const [open, setOpen] = useState(false);

  const handleLinkClick = () => {
    setOpen(false);
  };
  const localePrefix = locale ? `/${locale}` : "/fr";

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" className="w-auto px-2 py-1 rounded-md">
          <Menu className="size-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full max-w-[100vw] p-0" hideClose>
        <SheetTitle className="hidden">
          <TranslatedText
            ns="navbar"
            translationKey="MobileNavigation"
            fallbackText="Mobile Navigation"
          />
        </SheetTitle>
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
        <div
          className=" max-h-[calc(100vh-70px)] overflow-y-auto [&::-webkit-scrollbar]:w-2
  [&::-webkit-scrollbar-track]:bg-gray-100
  [&::-webkit-scrollbar-thumb]:bg-gray-300
  dark:[&::-webkit-scrollbar-track]:bg-neutral-700
  dark:[&::-webkit-scrollbar-thumb]:bg-neutral-500"
        >
          <nav className="flex flex-col gap-3 px-4 mt-3 pb-10 pt-2">
            <ThemeToggleMobile />
            <LangSwitchMobile onLocaleChange={handleLinkClick} />
            <div className="mt-3 mb-3">
              <Link
                href={`${localePrefix}/contact`}
                onClick={handleLinkClick}
                className="block w-full text-center font-semibold text-lg py-3 rounded-xl border border-accent bg-transparent hover:bg-accent/30 transition-colors"
                style={{ letterSpacing: 0.5 }}
              >
                <TranslatedText
                  ns="navbar"
                  translationKey="Contact"
                  fallbackText="Contact"
                />
              </Link>
            </div>
            <div>
              <Link
                href={`${localePrefix}/`}
                onClick={handleLinkClick}
                className="flex items-center gap-3 text-md px-2 py-2 rounded hover:bg-accent transition-colors font-bold"
              >
                <span>
                  <TranslatedText
                    ns="navbar"
                    translationKey="Home"
                    fallbackText="Home"
                  />
                </span>
              </Link>
            </div>
            <div>
              <Link
                href={`${localePrefix}/team`}
                onClick={handleLinkClick}
                className="flex items-center gap-3 text-md px-2 py-2 rounded hover:bg-accent transition-colors font-bold"
              >
                <span>
                  <TranslatedText
                    ns="navbar"
                    translationKey="Team"
                    fallbackText="Team"
                  />
                </span>
              </Link>
            </div>
            <div>
              <Link
                href={`${localePrefix}/about`}
                onClick={handleLinkClick}
                className="flex items-center gap-3 text-md px-2 py-2 rounded hover:bg-accent transition-colors font-bold"
              >
                <span>
                  <TranslatedText
                    ns="navbar"
                    translationKey="About"
                    fallbackText="About"
                  />
                </span>
              </Link>
            </div>
            <ServicesMobile onLinkClick={handleLinkClick} />
            <div>
              <Link
                href={`${localePrefix}/ressources`}
                onClick={handleLinkClick}
                className="flex items-center gap-3 text-md px-2 py-2 rounded hover:bg-accent transition-colors font-bold"
              >
                <span>
                  <TranslatedText
                    ns="navbar"
                    translationKey="Ressources"
                    fallbackText="Ressources"
                  />
                </span>
              </Link>
            </div>
            <div onClick={handleLinkClick}>
              <Footer />
            </div>
          </nav>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default MobileMenu;
