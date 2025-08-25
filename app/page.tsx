import { type Metadata } from "next";
import Hero from "@/app/home/components/hero";
import Services from "@/app/home/components/services";
import FAQ from "@/app/home/components/faq";
import Testimonials from "@/app/home/components/testimonials";
import Contact from "@/src/components/ui/contact-form";
import { generateMetadataForPage } from "@/src/lib/metadata";

export async function generateMetadata(): Promise<Metadata> {
  return await generateMetadataForPage("/");
}

export default function Home() {
  return (
    <main
      className="max-w-[var(--breakpoint-xl)] mx-auto w-full pb-4 xs:py-20 md:px-6"
      role="main"
    >
      <section id="hero">
        <Hero />
      </section>
      <section id="services">
        <Services />
      </section>
      <section id="faq">
        <FAQ />
      </section>
      {/* <section id="testimonials">
        <Testimonials />
      </section> */}
      <section id="contact">
        <Contact />
      </section>
    </main>
  );
}
