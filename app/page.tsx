"use client";
import Hero from "@/app/home/components/hero";
import Services from "@/app/home/components/services";
import FAQ from "@/app/home/components/faq";
import Testimonials from "@/app/home/components/testimonials";
import React from "react";
import Contact from "@/app/contact/page";
import TranslatedText from "@/src/components/ui/translated-text";

export default function Home() {
  return (
    <>
      <span>
        <title>
          <TranslatedText
            translationKey="Home.Meta.Title"
            fallbackText="Ark Fiduciaire"
          />
        </title>
        <meta name="description" content="Ark Fiduciaire services" />
        <meta property="og:title" content="Ark Fiduciaire" />
        <meta property="og:description" content="Ark Fiduciaire services" />
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="Ark Fiduciaire" />
        <meta name="twitter:card" content="summary_large_image" />
      </span>
      <main
        className="max-w-screen-xl mx-auto w-full pb-4 xs:py-20 md:px-6"
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
        <section id="testimonials">
          <Testimonials />
        </section>
        <section id="contact">
          <Contact />
        </section>
      </main>
    </>
  );
}
