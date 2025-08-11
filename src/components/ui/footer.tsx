import { Separator } from "@/components/ui/separator";
import {
  DribbbleIcon,
  GithubIcon,
  TwitchIcon,
  TwitterIcon,
} from "lucide-react";
import { Link } from "react-router-dom";
import Logo from "@/assets/arkfid--color.svg";
import LogoLight from "@/assets/arkfid--light.svg";
import { useTheme } from "@/components/ui/theme-provider";
import { useTranslation } from "react-i18next";

const footerSections = [
  {
    titleKey: "Footer.Product.Title",
    links: [
      { titleKey: "Footer.Product.Overview", href: "#" },
      { titleKey: "Footer.Product.Features", href: "#" },
      { titleKey: "Footer.Product.Solutions", href: "#" },
      { titleKey: "Footer.Product.Tutorials", href: "#" },
      { titleKey: "Footer.Product.Pricing", href: "#" },
      { titleKey: "Footer.Product.Releases", href: "#" },
    ],
  },
  {
    titleKey: "Footer.Company.Title",
    links: [
      { titleKey: "Footer.Company.AboutUs", href: "#" },
      { titleKey: "Footer.Company.Careers", href: "#" },
      { titleKey: "Footer.Company.Press", href: "#" },
      { titleKey: "Footer.Company.News", href: "#" },
      { titleKey: "Footer.Company.MediaKit", href: "#" },
      { titleKey: "Footer.Company.Contact", href: "#" },
    ],
  },
  {
    titleKey: "Footer.Resources.Title",
    links: [
      { titleKey: "Footer.Resources.Blog", href: "#" },
      { titleKey: "Footer.Resources.Newsletter", href: "#" },
      { titleKey: "Footer.Resources.Events", href: "#" },
      { titleKey: "Footer.Resources.HelpCentre", href: "#" },
      { titleKey: "Footer.Resources.Tutorials", href: "#" },
      { titleKey: "Footer.Resources.Support", href: "#" },
    ],
  },
  {
    titleKey: "Footer.Social.Title",
    links: [{ titleKey: "Footer.Social.LinkedIn", href: "#" }],
  },
  {
    titleKey: "Footer.Legal.Title",
    links: [
      { titleKey: "Footer.Legal.Terms", href: "#" },
      { titleKey: "Footer.Legal.Privacy", href: "#" },
      { titleKey: "Footer.Legal.Cookies", href: "#" },
      { titleKey: "Footer.Legal.Licenses", href: "#" },
      { titleKey: "Footer.Legal.Settings", href: "#" },
      { titleKey: "Footer.Legal.Contact", href: "#" },
    ],
  },
];

const Footer = () => {
  const { theme } = useTheme();
  const { t } = useTranslation();
  return (
    <footer className="mt-12 xs:mt-20 bg-background border-t">
      <div className="max-w-screen-xl mx-auto py-12 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-7 gap-x-8 gap-y-10 px-6">
        <Link to={"/"}>
          <img src={theme == "dark" ? LogoLight : Logo} width={100} />
        </Link>

        {footerSections.map(({ titleKey, links }) => (
          <div key={titleKey} className="xl:justify-self-end">
            <h6 className="font-semibold text-foreground">{t(titleKey)}</h6>
            <ul className="mt-6 space-y-4">
              {links.map(({ titleKey, href }) => (
                <li key={titleKey}>
                  <Link
                    to={href}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    {t(titleKey)}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <Separator />
      <div className="max-w-screen-xl mx-auto py-8 flex flex-col-reverse sm:flex-row items-center justify-between gap-x-2 gap-y-5 px-6">
        {/* Copyright */}
        <span className="text-muted-foreground text-center xs:text-start">
          &copy; {new Date().getFullYear()} {t("Footer.Copyright")}.
        </span>

        <div className="flex items-center gap-5 text-muted-foreground">
          <Link to="#" target="_blank">
            <TwitterIcon className="h-5 w-5" />
          </Link>
          <Link to="#" target="_blank">
            <DribbbleIcon className="h-5 w-5" />
          </Link>
          <Link to="#" target="_blank">
            <TwitchIcon className="h-5 w-5" />
          </Link>
          <Link to="#" target="_blank">
            <GithubIcon className="h-5 w-5" />
          </Link>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
