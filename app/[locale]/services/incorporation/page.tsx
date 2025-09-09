import { Metadata } from "next";
import Hero from "./components/hero";
import Presentation from "./components/presentation";
import { generateMetadataForPage } from "@/src/lib/metadata";
import { type Locale } from "@/src/lib/i18n";

export async function generateMetadata({
  params: { locale },
}: {
  params: { locale: string };
}): Promise<Metadata> {
  return await generateMetadataForPage(
    locale as Locale,
    "/services/incorporation"
  );
}

const Incorporation = ({ params }: { params: { locale: string } }) => (
  <main>
    <Hero locale={params.locale} />
    <Presentation />
  </main>
);

export default Incorporation;
