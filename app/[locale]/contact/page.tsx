import { Metadata } from "next";
import ContactForm from "@/src/components/ui/contact-form";
import TranslatedText from "@/src/components/ui/translated-text";
import { generateMetadataForPage } from "@/src/lib/metadata";
import { type Locale } from "@/src/lib/i18n";

export async function generateMetadata({
  params: { locale },
}: {
  params: { locale: string };
}): Promise<Metadata> {
  return await generateMetadataForPage(locale as Locale, "/contact");
}

export default function ContactPage() {
  return (
    <div className="mx-auto w-full max-w-[var(--breakpoint-xl)] px-6 py-12">
      <h1 className="text-3xl xs:text-4xl sm:text-5xl lg:text-[2.75rem] xl:text-5xl font-bold leading-[1.2]! tracking-tight text-center">
        <TranslatedText
          ns="contact"
          translationKey={"Title"}
          fallbackText="Get in Touch"
        />
      </h1>
      <p className="text-muted-foreground mt-2 w-full text-center">
        <TranslatedText
          ns="contact"
          translationKey={"Subtitle"}
          fallbackText={"Subtitle"}
        />
      </p>
      <ContactForm showTitle={false} showSubtitle={false} />
    </div>
  );
}
