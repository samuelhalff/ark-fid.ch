import { Metadata } from "next";
import { headers } from "next/headers";
import Hero from "./components/hero";
import Presentation from "./components/presentation";
import { generateMetadataForPage } from "@/src/lib/metadata";
import { type Locale } from "@/src/lib/i18n";

export async function generateMetadata({
  params: { locale },
}: {
  params: { locale: string };
}): Promise<Metadata> {
  return await generateMetadataForPage(
    locale as Locale,
    "/services/incorporation"
  );
}

const Incorporation = ({ params }: { params: { locale: string } }) => {
  const nonce = headers().get("x-nonce") || undefined;
  const howToJsonLd = {
    "@context": "https://schema.org",
    "@type": "HowTo",
    name: "Créer une société à Genève - Étapes",
    description:
      "Processus simplifié des principales étapes pour constituer une entreprise à Genève.",
    step: [
      {
        "@type": "HowToStep",
        position: 1,
        name: "Analyse de la forme juridique",
        text: "Choisir la forme (SA, Sàrl, entreprise individuelle) adaptée à l'activité et aux obligations fiscales.",
      },
      {
        "@type": "HowToStep",
        position: 2,
        name: "Capital et statuts",
        text: "Rédiger les statuts et déposer le capital requis auprès d'une banque ou d'un notaire.",
      },
      {
        "@type": "HowToStep",
        position: 3,
        name: "Dépôt notarial",
        text: "Signer l'acte constitutif et authentifier les statuts devant notaire.",
      },
      {
        "@type": "HowToStep",
        position: 4,
        name: "Registre du commerce",
        text: "Déposer le dossier complet (statuts, identification, attestations) au registre du commerce cantonal.",
      },
      {
        "@type": "HowToStep",
        position: 5,
        name: "Affiliations fiscales et sociales",
        text: "S'inscrire à la TVA si nécessaire et aux assurances sociales (AVS, LPP, LAA).",
      },
    ],
  } as const;

  return (
    <main>
      <script
        type="application/ld+json"
        nonce={nonce}
        dangerouslySetInnerHTML={{ __html: JSON.stringify(howToJsonLd) }}
      />
      <Hero locale={params.locale} />
      <Presentation />
    </main>
  );
};

export default Incorporation;
