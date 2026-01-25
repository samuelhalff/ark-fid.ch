import { Separator } from "@/src/components/ui/separator";
import Link from "next/link";
import Image from "next/image";
import CookieSettingsLink from "@/src/components/CookieSettingsLink";
import { getTranslations, type Locale } from "@/src/lib/i18n";
import { buildInternalUrl } from "@/src/lib/paths";

// Replace '#' with real or placeholder URLs for SEO. Update as needed.
const footerSections = [
  {
    titleKey: "Services.Title",
    links: [
      {
        titleKey: "Accounting.Title",
        href: "/services/accounting/",
        ns: "servicesItems",
      },
      {
        titleKey: "TaxesCompanyPersonal.Title",
        href: "/services/taxes/",
        ns: "servicesItems",
      },
      {
        titleKey: "PayrollHR.Title",
        href: "/services/payroll/",
        ns: "servicesItems",
      },
      {
        titleKey: "OutsourcingServices.Title",
        href: "/services/outsourcing/",
        ns: "servicesItems",
      },
      {
        titleKey: "MAServices.Title",
        href: "/services/mergers-acquisitions/",
        ns: "servicesItems",
      },
      {
        titleKey: "CorporateServices.Title",
        href: "/services/corporate/",
        ns: "servicesItems",
      },
      {
        titleKey: "OdooImplementation.Title",
        href: "/services/odoo/",
        ns: "servicesItems",
      },
    ],
  },
  {
    titleKey: "Company.Title",
    links: [
      { titleKey: "About", href: "/about/", ns: "navbar" },
      { titleKey: "Team", href: "/team/", ns: "navbar" },
      { titleKey: "Our partners", href: "/partners/", ns: "navbar" },
      { titleKey: "Contact", href: "/contact/", ns: "navbar" },
    ],
  },
  {
    titleKey: "Resources.Title",
    links: [{ titleKey: "Ressources", href: "/ressources/", ns: "navbar" }],
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
      { titleKey: "Legal.Terms", href: "/legal/terms/", ns: "footer" },
      { titleKey: "Legal.Privacy", href: "/legal/privacy/", ns: "footer" },
      { titleKey: "Legal.Cookies", href: "/legal/cookies/", ns: "footer" },
      { titleKey: "Legal.Settings", href: "#cookie-settings", ns: "footer" },
    ],
  },
];

const Footer = async ({ locale }: { locale?: string }) => {
  const currentLocale = (locale as Locale) || ("fr" as Locale);
  const localePrefix = `/${currentLocale}`;
  const tFooter = await getTranslations(currentLocale, "footer");
  const tNavbar = await getTranslations(currentLocale, "navbar");
  const tItems = await getTranslations(currentLocale, "servicesItems");
  return (
    <footer
      className="mt-12 xs:mt-20 bg-background border-t text-foreground"
      role="contentinfo"
    >
      <div className="max-w-[var(--breakpoint-xl)] mx-auto py-12 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-7 gap-x-8 gap-y-10 px-6">
        <Link
          href={localePrefix}
          aria-label={tNavbar("Home")}
          locale={locale}
          prefetch={false}
        >
          <span>
            <Image
              className="hidden dark:block"
              src="/assets/arkfid--light.svg"
              width={100}
              height={40}
              alt="Logo Ark Fiduciaire"
              sizes="(max-width: 768px) 88px, 100px"
              loading="lazy"
              decoding="async"
            />
            <Image
              className="dark:hidden"
              src="/assets/arkfid--color.svg"
              width={100}
              height={40}
              alt="Logo Ark Fiduciaire"
              sizes="(max-width: 768px) 88px, 100px"
              loading="lazy"
              decoding="async"
            />
          </span>
        </Link>

        {/* Address / Location Block */}
        <div
          className="text-sm space-y-3"
          itemScope
          itemType="https://schema.org/PostalAddress"
        >
          <p className="font-semibold">Ark Fiduciaire SA</p>
          <p>
            <span itemProp="streetAddress">26 Boulevard Georges Favon</span>
            <br />
            <span itemProp="postalCode">1204</span>{" "}
            <span itemProp="addressLocality">Genève</span>,{" "}
            <span itemProp="addressCountry">CH</span>
          </p>
          <p>
            <a
              href="mailto:info@ark-fid.ch"
              className="text-blue-600 dark:text-blue-400 hover:underline"
              itemProp="email"
            >
              info@ark-fid.ch
            </a>
          </p>
          <p>
            <a
              href="tel:+41225125050"
              className="text-blue-600 dark:text-blue-400 hover:underline"
              itemProp="telephone"
              aria-label="Call Ark Fiduciaire at +41 22 512 50 50"
            >
              +41 22 512 50 50
            </a>
          </p>
          <p>
            <a
              href="https://maps.google.com/?cid=11595836239142935457"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 dark:text-blue-400 hover:underline"
            >
              Google Maps
            </a>
          </p>
        </div>

        {footerSections.map(({ titleKey, links }) => (
          <nav
            key={titleKey}
            aria-label={tFooter(titleKey)}
            className="xl:justify-self-end"
          >
            <p className="font-semibold text-foreground">{tFooter(titleKey)}</p>
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
                      {ns === "servicesItems"
                        ? tItems(titleKey)
                        : ns === "navbar"
                        ? tNavbar(titleKey)
                        : tFooter(titleKey)}
                    </a>
                  ) : href === "#cookie-settings" ? (
                    <CookieSettingsLink className="text-muted-foreground hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40">
                      {tFooter(titleKey)}
                    </CookieSettingsLink>
                  ) : (
                    <Link
                      href={`${localePrefix}${href}`}
                      className="text-muted-foreground hover:text-foreground"
                      locale={locale}
                      prefetch={false}
                    >
                      {ns === "servicesItems"
                        ? tItems(titleKey)
                        : ns === "navbar"
                        ? tNavbar(titleKey)
                        : tFooter(titleKey)}
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
        <span className="w-full text-center xs:text-start text-sm text-muted-foreground">
          {tFooter("Ark Fiduciaire SA")} - {tFooter("Copyright")} -{" "}
          <span suppressHydrationWarning>{new Date().getFullYear()}</span>{" "}
          <br />
        </span>
      </div>
    </footer>
  );
};

export default Footer;
