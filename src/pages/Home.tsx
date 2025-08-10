import Hero from "@/components/ui/hero";
import Services from "@/components/ui/services";
import FAQ from "@/components/ui/faq";
import React from "react";

const Home: React.FC = () => {
  return (
    <div style={{ padding: "2rem", textAlign: "center" }}>
      <Hero />
      <Services />
      <FAQ />
    </div>
  );
};

export default Home;
