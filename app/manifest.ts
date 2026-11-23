import type { MetadataRoute } from "next";

// /manifest.webmanifest: name, colours and icon of the site for browsers.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Ark Fiduciaire SA",
    short_name: "Ark Fiduciaire",
    description:
      "Fiduciaire à Genève pour PME, entrepreneurs, familles et sociétés internationales : comptabilité, fiscalité, salaires, domiciliation, corporate et Odoo.",
    start_url: "/fr/",
    scope: "/",
    display: "browser",
    background_color: "#ffffff",
    theme_color: "#0a0a0a",
    lang: "fr-CH",
    icons: [
      { src: "/favicon.png", sizes: "50x50", type: "image/png" },
      { src: "/favicon.ico", sizes: "any" },
    ],
  };
}
