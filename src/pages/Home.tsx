import Hero from "@/components/ui/hero";
import Services from "@/components/ui/services";
import FAQ from "@/components/ui/faq";
import Testimonials from "@/components/ui/testimonials";
import React from "react";
import ContactForm from "./ContactForm";

const Home: React.FC = () => {
  return (
    <div className="max-w-screen-xl mx-auto w-full py-12 xs:py-20 px-6">
      <div>
        <title>Home | Ark Fiduciaire</title>
      </div>
      <Hero />
      <Services />
      <FAQ />
      <Testimonials />
      <ContactForm />
    </div>
  );
};

export default Home;
