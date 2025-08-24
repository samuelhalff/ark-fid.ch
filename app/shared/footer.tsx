import { Separator } from "@/src/components/ui/separator";
import {
  DribbbleIcon,
  GithubIcon,
  TwitchIcon,
  TwitterIcon,
} from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import TranslatedText from "@/src/components/ui/translated-text";

// Replace '#' with real or placeholder URLs for SEO. Update as needed.
const footerSections = [
  {
    titleKey: "Services.Title",
    links: [
      {
        titleKey: "Accounting.Title",
        href: "/services/accounting",
        ns: "servicesItems",
      },
      {
        titleKey: "TaxesCompanyPersonal.Title",
        href: "/services/taxes",
        ns: "servicesItems",
      },
      {
        titleKey: "PayrollHR.Title",
        href: "/services/payroll",
        ns: "servicesItems",
      },
      {
        titleKey: "OutsourcingServices.Title",
        href: "/services/outsourcing",
        ns: "servicesItems",
      },
      {
        titleKey: "CorporateServices.Title",
        href: "/services/corporate",
        ns: "servicesItems",
      },
      {
        titleKey: "OdooImplementation.Title",
        href: "/services/odoo",
        ns: "servicesItems",
      },
    ],
  },
  {
    titleKey: "Company.Title",
    links: [
      { titleKey: "About", href: "/about", ns: "navbar" },
      { titleKey: "Team", href: "/team", ns: "navbar" },
      { titleKey: "Our partners", href: "/partners", ns: "navbar" },
      { titleKey: "Contact", href: "/contact", ns: "navbar" },
    ],
  },
  {
    titleKey: "Social.Title",
    links: [
      {
        titleKey: "Social.LinkedIn",
        href: "https://www.linkedin.com/company/ark-fiduciaire/",
        ns: "footer",
      },
    ],
  },
  {
    titleKey: "Legal.Title",
    links: [
      { titleKey: "Legal.Terms", href: "/legal/terms", ns: "footer" },
      { titleKey: "Legal.Privacy", href: "/legal/privacy", ns: "footer" },
      { titleKey: "Legal.Cookies", href: "/legal/cookies", ns: "footer" },
    ],
  },
];

const Footer = () => {
  return (
    <footer
      className="mt-12 xs:mt-20 bg-background border-t"
      role="contentinfo"
    >
      <div className="max-w-[var(--breakpoint-xl)] mx-auto py-12 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-7 gap-x-8 gap-y-10 px-6">
        <Link href={"/"} aria-label="Ark Fiduciaire homepage">
          <span>
            <Image
              className="hidden dark:block"
              src="/assets/arkfid--light.svg"
              width={100}
              height={40}
              alt="Ark Fiduciaire Logo Light"
              priority
            />
            <Image
              className="dark:hidden"
              src="/assets/arkfid--color.svg"
              width={100}
              height={40}
              alt="Ark Fiduciaire Logo"
              priority
            />
          </span>
        </Link>

        {footerSections.map(({ titleKey, links }) => (
          <nav
            key={titleKey}
            aria-label={titleKey}
            className="xl:justify-self-end"
          >
            <h6 className="font-semibold text-foreground">
              <TranslatedText
                ns="footer"
                translationKey={titleKey}
                fallbackText={titleKey}
              />
            </h6>
            <ul className="mt-6 space-y-4">
              {links.map(({ titleKey, href, ns }) => (
                <li key={titleKey}>
                  {href.startsWith("http") ? (
                    <a
                      href={href}
                      className="text-muted-foreground hover:text-foreground"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <TranslatedText
                        ns={ns || "footer"}
                        translationKey={titleKey}
                        fallbackText={titleKey}
                      />
                    </a>
                  ) : (
                    <Link
                      href={href}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <TranslatedText
                        ns={ns || "footer"}
                        translationKey={titleKey}
                        fallbackText={titleKey}
                      />
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
      <Separator />
      <div className="max-w-[var(--breakpoint-xl)] mx-auto py-8 flex flex-col-reverse sm:flex-row items-center justify-between gap-x-2 gap-y-5 px-6">
        {/* Copyright */}
        <span className="w-full text-muted-foreground text-center xs:text-start">
          <TranslatedText
            ns="footer"
            translationKey={"Ark Fiduciaire SA"}
            fallbackText={"Ark Fiduciaire SA"}
          />{" "}
          -{" "}
          <TranslatedText
            ns="footer"
            translationKey={"Copyright"}
            fallbackText={"All rights reserved"}
          />{" "}
          - {new Date().getFullYear()} <br />
        </span>
      </div>
    </footer>
  );
};

export default Footer;
