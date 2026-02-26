import { Metadata } from "next";
import dynamic from "next/dynamic";
import { generateMetadataForPage } from "@/src/lib/metadata";
import GoogleMap from "@/src/components/ui/GoogleMap";
import Defer from "@/src/components/Defer";
import { getTranslations, type Locale } from "@/src/lib/i18n";
import { headers } from "next/headers";

const ContactForm = dynamic(() => import("@/src/components/ui/contact-form"), {
  loading: () => (
    <div className="mx-auto w-full max-w-3xl">
      <div className="animate-pulse rounded-2xl border border-border/40 bg-muted/30 p-6 sm:p-8">
        <div className="h-6 w-48 rounded bg-foreground/10" />
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <div className="h-12 rounded bg-foreground/5" />
          <div className="h-12 rounded bg-foreground/5" />
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="h-12 rounded bg-foreground/5" />
          <div className="h-12 rounded bg-foreground/5" />
        </div>
        <div className="mt-4 h-28 rounded bg-foreground/5" />
        <div className="mt-6 h-11 w-40 rounded-full bg-foreground/10" />
      </div>
    </div>
  ),
});

export async function generateMetadata(
  props: {
    params: Promise<{ locale: string }>;
  }
): Promise<Metadata> {
  const params = await props.params;

  const {
    locale
  } = params;

  return await generateMetadataForPage(locale as Locale, "/contact");
}

export default async function ContactPage(
  props: {
    params: Promise<{ locale: string }>;
  }
) {
  const params = await props.params;
  const locale = (params?.locale as Locale) || ("fr" as Locale);
  const t = await getTranslations(locale, "contact");
  const tNav = await getTranslations(locale, "navbar");
  const nonce = (await headers()).get("x-nonce") || undefined;
  const baseUrl = "https://ark-fid.ch";
  const localePrefix = params?.locale ? `/${params.locale}` : "/fr";
  const placeJsonLd = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name: "Ark Fiduciaire SA",
    url: "https://ark-fid.ch",
    geo: {
      "@type": "GeoCoordinates",
      latitude: 46.2039844,
      longitude: 6.1426851,
    },
    hasMap: "https://maps.google.com/?cid=11150574028817027076",
    identifier: "11150574028817027076",
    telephone: "+41225125050",
    sameAs: [
      "https://www.google.com/maps/place/Ark+Fiduciaire+SA/",
      "https://maps.google.com/?cid=11150574028817027076",
    ],
    address: {
      "@type": "PostalAddress",
      streetAddress: "26 Boulevard Georges Favon",
      addressLocality: "Genève",
      postalCode: "1204",
      addressCountry: "CH",
    },
  } as const;
  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: (tNav("Home") as string) || "Home",
        item: `${baseUrl}${localePrefix}/`,
      },
      {
        "@type": "ListItem",
        position: 2,
        name: t("Title"),
        item: `${baseUrl}${localePrefix}/contact/`,
      },
    ],
  } as const;

  const strings = {
    title:
      typeof t("Title") === "string" ? (t("Title") as string) : "Get in Touch",
    subtitle:
      typeof t("Subtitle") === "string" ? (t("Subtitle") as string) : "",
    orContactUs: (t("OrContactUs") as string) || "or contact us",
    bookingButton: (t("BookingButton") as string) || "Book a call",
    labels: {
      name: (t("Form.Name") as string) || "Name",
      companyName:
        (t("Form.CompanyName") as string) || "Company Name (Optional)",
      phone: (t("Form.Phone") as string) || "Phone Number (Optional)",
      email: (t("Form.Email") as string) || "Email",
      message: (t("Form.Message") as string) || "Message",
      consent: (t("Form.Consent") as string) || "I consent to being contacted",
      submit: (t("Form.Submit") as string) || "Submit",
      sending: (t("Form.Sending") as string) || "Sending...",
    },
    placeholders: {
      name: (t("Form.Placeholders.Name") as string) || "Your name",
      companyName:
        (t("Form.Placeholders.CompanyName") as string) || "Company name",
      phone: (t("Form.Placeholders.Phone") as string) || "Phone number",
      email: (t("Form.Placeholders.Email") as string) || "email@example.com",
      message: (t("Form.Placeholders.Message") as string) || "How can we help?",
    },
    errors: {
      required: (t("Errors.Required") as string) || "This field is required",
      invalidEmail:
        (t("Errors.InvalidEmail") as string) || "Invalid email address",
      maxLength: (t("Errors.MaxLength") as string) || "Message is too long",
      consent: (t("Errors.Consent") as string) || "Please provide consent",
    },
    toasts: {
      success:
        (t("Form.Success") as string) || "Thanks! We'll get back to you soon.",
      error: (t("Form.Error") as string) || "Something went wrong.",
    },
  } as const;

  return (
    <div className="mx-auto w-full max-w-[var(--breakpoint-xl)] px-6 py-12 space-y-14">
      <script
        type="application/ld+json"
        nonce={nonce}
        dangerouslySetInnerHTML={{ __html: JSON.stringify(placeJsonLd) }}
      />
      <script
        type="application/ld+json"
        nonce={nonce}
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <h1 className="text-3xl xs:text-4xl sm:text-5xl lg:text-[2.75rem] xl:text-5xl font-bold leading-[1.2]! tracking-tight text-center">
        {strings.title}
      </h1>
      <nav aria-label="Breadcrumb" className="px-0 mt-2 mb-6">
        <ol className="flex items-center gap-1 text-sm text-muted-foreground justify-center">
          <li>
            <a href={`${localePrefix}/`} className="hover:underline">
              {(tNav("Home") as string) || "Home"}
            </a>
          </li>
          <li className="flex items-center gap-1">
            <span className="text-muted-foreground/60">/</span>
            <span aria-current="page" className="font-medium text-foreground">
              {strings.title}
            </span>
          </li>
        </ol>
      </nav>
      <div className="mt-6 flex justify-center">
        <a
          href="https://outlook.office.com/bookwithme/user/a21b46e2d9a540cca4c290a48c40119e@ark-fid.ch/meetingtype/GHNs6ESvEUWN2gUat7rePg2?anonymous&ismsaljsauthenabled&ep=mlink"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center rounded-full bg-blue-700 text-white px-6 py-3 text-base font-medium shadow hover:shadow-lg transition-all hover:scale-[1.03] focus-visible:scale-[1.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary"
        >
          {strings.bookingButton}
        </a>
      </div>
      <div className="mt-4 text-center">
        <p>
          {strings.orContactUs}
          {strings.subtitle && <br />}
          {strings.subtitle}
        </p>
        <div className="mt-3">
          <a
            href="tel:+41225125050"
            className="text-blue-700 dark:text-blue-400 hover:underline font-medium"
            aria-label="Call us at +41 22 512 50 50"
          >
            +41 22 512 50 50
          </a>
        </div>
      </div>

      <ContactForm
        showTitle={false}
        showSubtitle={false}
        strings={strings}
        redirectPath={`${localePrefix}/`}
      />
      <section className="mt-8 space-y-6">
        <Defer
          rootMargin="200px"
          idle={200}
          placeholder={
            <div className="h-[300px] w-full rounded-lg bg-muted/40" />
          }
        >
          <GoogleMap
            className="w-full"
            privacyMode={false}
            labels={{
              loadMap: t("MapLoadButton") as string,
              openInGoogle: t("MapOpenExternal") as string,
              placeholderNotice: t("MapPrivacyPlaceholder") as string,
            }}
          />
        </Defer>
      </section>
    </div>
  );
}
