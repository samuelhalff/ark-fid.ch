import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'export', // Enable static export
  trailingSlash: true, // Recommended for static sites
  images: {
    unoptimized: true, // Required for static export
  },
  // Note: i18n is not compatible with output: 'export' in App Router
  // We'll handle i18n manually with our metadata system
  swcMinify: true,
};

export default nextConfig;
