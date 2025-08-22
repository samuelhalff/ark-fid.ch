import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  i18n: {
    defaultLocale: "en",
    locales: ["en", "hi"],
  },
  swcMinify: true,
};

export default nextConfig;
