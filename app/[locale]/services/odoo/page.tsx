import { Metadata } from "next";
import Hero from "./components/hero";
import Presentation from "./components/presentation";
import { generateMetadataForPage } from "@/src/lib/metadata";

export async function generateMetadata(): Promise<Metadata> {
  return await generateMetadataForPage("/services/odoo");
}

const Odoo = () => (
  <main>
    <Hero />
    <Presentation />
  </main>
);

export default Odoo;
