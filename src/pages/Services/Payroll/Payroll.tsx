import Hero from "./components/hero";
import FAQ from "@/components/ui/faq";
import React from "react";
import Presentation from "./components/presentation";
import ContactForm from "@/pages/ContactForm";

const Home: React.FC = () => {
  return (
    <div style={{ padding: "2rem", textAlign: "center" }}>
      <div>
        <title>Payroll & HR | Ark Fiduciaire</title>
      </div>
      <Hero />
      <Presentation />
      <FAQ />
      <ContactForm />
    </div>
  );
};

export default Home;
