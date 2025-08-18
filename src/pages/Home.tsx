import Hero from "@/components/ui/hero";
import Services from "@/components/ui/services";
import FAQ from "@/components/ui/faq";
import Testimonials from "@/components/ui/testimonials";
import React from "react";
import ContactForm from "./ContactForm";

const Home: React.FC = () => {
  return (
    <div style={{ padding: "2rem", textAlign: "center" }}>
      <Hero />
      <Services />
      <FAQ />
      <Testimonials />
      <ContactForm />
    </div>
  );
};

export default Home;
