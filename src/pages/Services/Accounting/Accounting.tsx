import Hero from "./components/hero";
import FAQ from "@/components/ui/faq";
import React from "react";
import Presentation from "./components/presentation";

const Home: React.FC = () => {
  return (
    <div style={{ padding: "2rem", textAlign: "center" }}>
      <div>
        <title>Comptabilité & Conseil | Ark Fiduciaire</title>
      </div>
      <Hero />
      <Presentation />
      <FAQ />
    </div>
  );
};

export default Home;
