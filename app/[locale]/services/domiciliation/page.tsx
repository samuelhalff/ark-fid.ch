import { Metadata } from "next";
import Hero from "./components/hero";
import { headers } from "next/headers";
import Presentation from "./components/presentation";
import { generateMetadataForPage } from "@/src/lib/metadata";
import StructuredData from "@/src/components/seo/StructuredData";
import { buildBreadcrumbList, buildHowTo } from "@/src/lib/structuredData";
import { type Locale } from "@/src/lib/i18n";
import Breadcrumbs from "@/src/components/navigation/Breadcrumbs";

export const runtime = "nodejs";

export async function generateMetadata({
  params: { locale },
}: {
  params: { locale: string };
}): Promise<Metadata> {
  return await generateMetadataForPage(
    locale as Locale,
    "/services/domiciliation"
  );
}

const Domiciliation = ({ params }: { params: { locale: string } }) => {
  const nonce = headers().get("x-nonce") || undefined;
  const baseUrl = "https://ark-fid.ch";
  const localePrefix = params.locale ? `/${params.locale}` : "";
  const breadcrumbJsonLd = buildBreadcrumbList([
    { name: "Services", item: `${baseUrl}${localePrefix}/services/` },
    {
      name: "Domiciliation",
      item: `${baseUrl}${localePrefix}/services/domiciliation/`,
    },
  ]);
  const howToJsonLd = buildHowTo({
    name: "Domicilier son entreprise à Genève - Étapes",
    description:
      "Procédure pour obtenir une adresse de siège et mettre en place la domiciliation commerciale.",
    totalTime: "P14D",
    estimatedCost: {
      currency: "CHF",
      value: "2500",
      name: "Frais annuels estimés de domiciliation, y.c gestion du courrier",
    },
    tools: [
      "Contrat de domiciliation",
      "Gestion/redirect courrier",
      "Accès eGov (RC/Zefix)",
      "Scanner PDF",
    ],
    supplies: [
      "Pièces d'identité des dirigeants",
      "Justificatif d'adresse de siège (bail ou attestation)",
      "Statuts ou projet de statuts",
      "Attestation de jouissance des locaux (si applicable)",
    ],
    steps: [
      {
        name: "Choisir l'offre de domiciliation",
        text: "Déterminer le type de domiciliation (simple, avec gestion courrier, services additionnels).",
        estimatedTime: "PT1H",
      },
      {
        name: "Constituer le dossier",
        text: "Réunir pièces d'identité, justificatifs et informations légales nécessaires.",
        estimatedTime: "P1D",
      },
      {
        name: "Signer le contrat de domiciliation",
        text: "Signer le contrat et obtenir l'attestation de domiciliation fournissant l'adresse officielle.",
        estimatedTime: "P1D",
      },
      {
        name: "Mise à jour Registre du commerce",
        text: "Adapter statuts/adresse et déposer la modification auprès du RC cantonal.",
        estimatedTime: "P5D",
      },
      {
        name: "Activer le suivi du courrier",
        text: "Mettre en place la réception, numérisation et redirection selon vos préférences.",
        estimatedTime: "P3D",
      },
    ],
  });
  return (
    <main>
      <StructuredData nonce={nonce} data={[breadcrumbJsonLd, howToJsonLd]} />
      <Hero params={params} />
      <div className="max-w-[var(--breakpoint-xl)] mx-auto px-0 mt-4">
        <Breadcrumbs
          rootLabel="Home"
          baseLabel="Services"
          segments={[{ segment: "domiciliation", label: "Domiciliation" }]}
        />
      </div>
      <Presentation />
    </main>
  );
};

export default Domiciliation;
