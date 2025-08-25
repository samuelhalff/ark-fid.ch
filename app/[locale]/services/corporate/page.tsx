import { Metadata } from "next";
import Hero from "./components/hero";
import Presentation from "./components/presentation";
import { generateMetadataForPage } from "@/src/lib/metadata";

export async function generateMetadata(): Promise<Metadata> {
  return await generateMetadataForPage("/services/corporate");
}

const Corporate = ({ params }: { params: { locale: string } }) => (
  <main>
    <Hero locale={params.locale} />
    <Presentation />
  </main>
);

export default Corporate;
