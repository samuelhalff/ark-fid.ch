import React from "react";
import { Metadata } from "next";
import Hero from "./components/hero";
import Presentation from "./components/presentation";
import { generateMetadataForPage } from "@/src/lib/metadata";

export const metadata: Metadata = generateMetadataForPage("/partners");

const PartnersPage = () => {
  return (
    <main>
      <Hero />
      <Presentation />
    </main>
  );
};

export default PartnersPage;
