import { Metadata } from "next";
import dynamic from "next/dynamic";
import { generateMetadataForPage } from "@/src/lib/metadata";
import GoogleMap from "@/src/components/ui/GoogleMap";
import Defer from "@/src/components/Defer";
import { CalendarIcon } from "@/src/components/icons/CalendarIcon";
import { PhoneIcon } from "@/src/components/icons/PhoneIcon";
import { WhatsAppIcon } from "@/src/components/icons/WhatsAppIcon";
import { getTranslations, type Locale } from "@/src/lib/i18n";
import {
  WHATSAPP_BADGE_FALLBACK,
  WHATSAPP_CTA_FALLBACK,
  WHATSAPP_NUMBER,
  WHATSAPP_PHONE_E164,
  WHATSAPP_URL,
} from "@/src/lib/whatsapp";
import { headers } from "next/headers";

const BOOKING_URL =
  "https://outlook.office.com/bookwithme/user/a21b46e2d9a540cca4c290a48c40119e@ark-fid.ch/meetingtype/GHNs6ESvEUWN2gUat7rePg2?anonymous&ismsaljsauthenabled&ep=mlink";

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
      latitude: 46.2021556,
      longitude: 6.1399595,
    },
    hasMap: "https://maps.google.com/?cid=14946625157719331801",
    identifier: "14946625157719331801",
    telephone: "+41225125050",
    sameAs: [
      "https://www.google.com/maps/place/Ark+Fiduciaire+SA/",
      "https://maps.google.com/?cid=14946625157719331801",
      WHATSAPP_URL,
    ],
    contactPoint: [
      {
        "@type": "ContactPoint",
        contactType: "customer service",
        telephone: WHATSAPP_PHONE_E164,
        url: WHATSAPP_URL,
        availableLanguage: ["English", "French", "German", "Spanish", "Portuguese"],
      },
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
    bookingDescription:
      (t("BookingDescription") as string) ||
      "Best for a planned discussion with our team.",
    orContactUs: (t("OrContactUs") as string) || "or contact us",
    bookingButton: (t("BookingButton") as string) || "Book a call",
    callLabel: (t("CallLabel") as string) || "Call us",
    callDescription:
      (t("CallDescription") as string) || "Speak directly with our team.",
    whatsapp: {
      badge: (t("WhatsApp.Badge") as string) || WHATSAPP_BADGE_FALLBACK,
      cta: (t("WhatsApp.Open") as string) || WHATSAPP_CTA_FALLBACK,
      description:
        (t("WhatsApp.Description") as string) ||
        "Quick questions, quick replies.",
    },
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
      {strings.subtitle ? (
        <p className="mx-auto -mt-8 max-w-2xl text-center text-base leading-7 text-muted-foreground sm:text-lg">
          {strings.subtitle}
        </p>
      ) : null}
      <section className="mx-auto max-w-5xl rounded-[28px] border border-border/60 bg-muted/30 p-4 shadow-sm sm:p-6 lg:p-7">
        <div className="grid gap-3 lg:grid-cols-3">
          <a
            href={BOOKING_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="group flex min-h-[180px] flex-col rounded-[22px] bg-blue-700 px-5 py-5 text-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:bg-blue-800 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 sm:min-h-[190px] sm:px-6 sm:py-6"
          >
            <span className="flex size-11 items-center justify-center rounded-full bg-white/14">
              <CalendarIcon className="size-5" />
            </span>
            <span className="mt-6 block">
              <span className="block text-base font-semibold sm:text-lg">
                {strings.bookingButton}
              </span>
              <span className="mt-2 block max-w-md text-sm leading-6 text-white/80">
                {strings.bookingDescription}
              </span>
            </span>
          </a>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
            <a
              href={WHATSAPP_URL}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`${strings.whatsapp.cta} ${WHATSAPP_NUMBER}`}
              className="group flex min-h-[180px] flex-col rounded-[22px] border border-border/60 bg-background/96 px-5 py-5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-[#25D366]/25 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#25D366]/40 focus-visible:ring-offset-2 sm:min-h-[190px]"
            >
              <span className="flex size-10 items-center justify-center rounded-full bg-[#25D366]/10 text-[#1f9d55]">
                <WhatsAppIcon className="size-5" />
              </span>
              <span className="mt-5 block">
                <span className="block text-sm font-semibold text-foreground">
                  {strings.whatsapp.badge}
                </span>
                <span className="mt-1 block text-sm leading-6 text-muted-foreground">
                  {strings.whatsapp.description}
                </span>
                <span className="mt-3 block text-sm font-medium text-foreground">
                  {WHATSAPP_NUMBER}
                </span>
              </span>
            </a>
            <div className="flex min-h-[180px] flex-col rounded-[22px] border border-border/60 bg-background/70 px-5 py-5 sm:min-h-[190px]">
              <span className="flex size-10 items-center justify-center rounded-full bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">
                <PhoneIcon className="size-5" />
              </span>
              <span className="mt-5 block">
                <span className="block text-sm font-semibold text-foreground">
                  {strings.callLabel}
                </span>
                <span className="mt-1 block text-sm leading-6 text-muted-foreground">
                  {strings.callDescription}
                </span>
                <a
                  href="tel:+41225125050"
                  className="mt-4 inline-flex items-center text-sm font-medium text-foreground underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
                  aria-label={`${strings.callLabel} +41 22 512 50 50`}
                >
                  +41 22 512 50 50
                </a>
              </span>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-3xl space-y-4">
        <div className="text-center">
          <p className="text-sm font-medium tracking-[0.16em] uppercase text-muted-foreground">
            {strings.orContactUs}
          </p>
        </div>
        <ContactForm
          showTitle={false}
          showSubtitle={false}
          strings={strings}
          redirectPath={`${localePrefix}/`}
        />
      </section>
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
