import { Separator } from "@/src/components/ui/separator";
import {
  DribbbleIcon,
  GithubIcon,
  TwitchIcon,
  TwitterIcon,
} from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import Logo from "/assets/arkfid--color.svg";
import LogoLight from "/assets/arkfid--light.svg";
import TranslatedText from "@/src/components/ui/translated-text";

// Replace '#' with real or placeholder URLs for SEO. Update as needed.
const footerSections = [
  {
    titleKey: "Footer.Product.Title",
    links: [
      { titleKey: "Footer.Product.Overview", href: "/overview" },
      { titleKey: "Footer.Product.Features", href: "/features" },
      { titleKey: "Footer.Product.Solutions", href: "/solutions" },
      { titleKey: "Footer.Product.Tutorials", href: "/tutorials" },
      { titleKey: "Footer.Product.Pricing", href: "/pricing" },
      { titleKey: "Footer.Product.Releases", href: "/releases" },
    ],
  },
  {
    titleKey: "Footer.Company.Title",
    links: [
      { titleKey: "Footer.Company.AboutUs", href: "/about" },
      { titleKey: "Footer.Company.Careers", href: "/careers" },
      { titleKey: "Footer.Company.Press", href: "/press" },
      { titleKey: "Footer.Company.News", href: "/news" },
      { titleKey: "Footer.Company.MediaKit", href: "/media-kit" },
      { titleKey: "Footer.Company.Contact", href: "/contact" },
    ],
  },
  {
    titleKey: "Footer.Resources.Title",
    links: [
      { titleKey: "Footer.Resources.Blog", href: "/blog" },
      { titleKey: "Footer.Resources.Newsletter", href: "/newsletter" },
      { titleKey: "Footer.Resources.Events", href: "/events" },
      { titleKey: "Footer.Resources.HelpCentre", href: "/help-centre" },
      { titleKey: "Footer.Resources.Tutorials", href: "/tutorials" },
      { titleKey: "Footer.Resources.Support", href: "/support" },
    ],
  },
  {
    titleKey: "Footer.Social.Title",
    links: [
      {
        titleKey: "Footer.Social.LinkedIn",
        href: "https://www.linkedin.com/company/arkfiduciaire/",
      },
    ],
  },
  {
    titleKey: "Footer.Legal.Title",
    links: [
      { titleKey: "Footer.Legal.Terms", href: "/terms" },
      { titleKey: "Footer.Legal.Privacy", href: "/privacy" },
      { titleKey: "Footer.Legal.Cookies", href: "/cookies" },
      { titleKey: "Footer.Legal.Licenses", href: "/licenses" },
      { titleKey: "Footer.Legal.Settings", href: "/settings" },
      { titleKey: "Footer.Legal.Contact", href: "/contact" },
    ],
  },
];

const Footer = () => {
  return (
    <footer
      className="mt-12 xs:mt-20 bg-background border-t"
      role="contentinfo"
    >
      <div className="max-w-screen-xl mx-auto py-12 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-7 gap-x-8 gap-y-10 px-6">
        <Link href={"/"} aria-label="Ark Fiduciaire homepage">
          <span>
            <Image
              className="light:hidden"
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
                translationKey={titleKey}
                fallbackText={titleKey}
              />
            </h6>
            <ul className="mt-6 space-y-4">
              {links.map(({ titleKey, href }) => (
                <li key={titleKey}>
                  {href.startsWith("http") ? (
                    <a
                      href={href}
                      className="text-muted-foreground hover:text-foreground"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <TranslatedText
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
      <div className="max-w-screen-xl mx-auto py-8 flex flex-col-reverse sm:flex-row items-center justify-between gap-x-2 gap-y-5 px-6">
        {/* Copyright */}
        <span className="text-muted-foreground text-center xs:text-start">
          &copy; {new Date().getFullYear()}{" "}
          <a href="/" className="hover:underline">
            Ark Fiduciaire
          </a>
          .{" "}
          <TranslatedText
            translationKey={"Footer.Copyright"}
            fallbackText={"All rights reserved"}
          />
          .
        </span>

        <div className="flex items-center gap-5 text-muted-foreground">
          <a
            href="https://twitter.com/"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Twitter"
          >
            <TwitterIcon className="h-5 w-5" />
          </a>
          <a
            href="https://dribbble.com/"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Dribbble"
          >
            <DribbbleIcon className="h-5 w-5" />
          </a>
          <a
            href="https://twitch.tv/"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Twitch"
          >
            <TwitchIcon className="h-5 w-5" />
          </a>
          <a
            href="https://github.com/"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="GitHub"
          >
            <GithubIcon className="h-5 w-5" />
          </a>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
