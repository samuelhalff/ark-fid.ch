import { Metadata } from "next";
import ContactForm from "@/src/components/ui/contact-form";
import TranslatedText from "@/src/components/ui/translated-text";
import { generateMetadataForPage } from "@/src/lib/metadata";
import GoogleMap, { ARK_GOOGLE_CID } from "@/src/components/ui/GoogleMap";
import { type Locale } from "@/src/lib/i18n";
import { headers } from "next/headers";

export async function generateMetadata({
  params: { locale },
}: {
  params: { locale: string };
}): Promise<Metadata> {
  return await generateMetadataForPage(locale as Locale, "/contact");
}

export default function ContactPage() {
  const nonce = headers().get("x-nonce") || undefined;
  const placeJsonLd = {
    "@context": "https://schema.org",
    "@type": "Place",
    name: "Ark Fiduciaire",
    url: "https://ark-fid.ch",
    geo: {
      "@type": "GeoCoordinates",
      latitude: 46.2039844,
      longitude: 6.1426851,
    },
    hasMap: "https://maps.google.com/?cid=11595836239142935457",
    identifier: "11595836239142935457",
    address: {
      "@type": "PostalAddress",
      streetAddress: "26 Boulevard Georges Favon",
      addressLocality: "Genève",
      postalCode: "1204",
      addressCountry: "CH",
    },
  } as const;
  return (
    <div className="mx-auto w-full max-w-[var(--breakpoint-xl)] px-6 py-12 space-y-14">
      <script
        type="application/ld+json"
        nonce={nonce}
        dangerouslySetInnerHTML={{ __html: JSON.stringify(placeJsonLd) }}
      />
      <h1 className="text-3xl xs:text-4xl sm:text-5xl lg:text-[2.75rem] xl:text-5xl font-bold leading-[1.2]! tracking-tight text-center">
        <TranslatedText
          ns="contact"
          translationKey={"Title"}
          fallbackText="Get in Touch"
        />
      </h1>
      <section className="mt-8 space-y-6">
        <GoogleMap className="w-full" privacyMode={false} />
      </section>
      <div className="mt-4 text-center">
        <p>
          <TranslatedText
            ns="contact"
            translationKey={"Subtitle"}
            fallbackText={"Subtitle"}
          />
        </p>
      </div>
      <ContactForm showTitle={false} showSubtitle={false} />
    </div>
  );
}
