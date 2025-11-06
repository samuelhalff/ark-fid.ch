const withBundleAnalyzer = require("@next/bundle-analyzer")({
  enabled: process.env.ANALYZE === "true",
  openAnalyzer: false,
});

/** @type {import('next').NextConfig} */
const baseConfig = {
  trailingSlash: true,
  // Disable source maps on CI by default. Enable explicitly with BUILD_SOURCEMAPS=true
  productionBrowserSourceMaps: process.env.BUILD_SOURCEMAPS === "true",
  experimental: {
    optimizePackageImports: ["lucide-react", "react-hook-form", "sonner"],
    optimizeCss: true,
    nextScriptWorkers: true,
    // Ensure runtime access to JSON translation files in standalone/serverless outputs
    outputFileTracingIncludes: {
      "/**/*": ["src/translations/**/*"],
    },
    swcPlugins: [
      // Configure SWC to skip polyfills for modern browsers
    ],
    esmExternals: true, // prefer native ESM deps
  },
  output: "standalone",
  images: {
    unoptimized: false,
    formats: ["image/avif", "image/webp"],
    deviceSizes: [360, 640, 768, 1024, 1280, 1920],
    imageSizes: [16, 24, 32, 48, 64, 96, 128, 256, 384],
    minimumCacheTTL: 31536000, // 1 year for static assets
  },
  swcMinify: true,
  compiler: {
    removeConsole:
      process.env.NODE_ENV === "production"
        ? { exclude: ["error", "warn"] }
        : false,
    reactRemoveProperties: true,
  },
  async redirects() {
    // Redirect old FR English-slugged URLs to localized French slugs
    return [
      {
        source: "/fr/services/accounting",
        destination: "/fr/services/comptabilite",
        permanent: true,
      },
      {
        source: "/fr/services/accounting/",
        destination: "/fr/services/comptabilite/",
        permanent: true,
      },
      {
        source: "/fr/services/taxes",
        destination: "/fr/services/fiscalite",
        permanent: true,
      },
      {
        source: "/fr/services/taxes/",
        destination: "/fr/services/fiscalite/",
        permanent: true,
      },
      {
        source: "/fr/services/payroll",
        destination: "/fr/services/paie",
        permanent: true,
      },
      {
        source: "/fr/services/payroll/",
        destination: "/fr/services/paie/",
        permanent: true,
      },
      {
        source: "/fr/services/outsourcing",
        destination: "/fr/services/externalisation",
        permanent: true,
      },
      {
        source: "/fr/services/outsourcing/",
        destination: "/fr/services/externalisation/",
        permanent: true,
      },
      {
        source: "/fr/services/mergers-acquisitions",
        destination: "/fr/services/fusions-acquisitions",
        permanent: true,
      },
      {
        source: "/fr/services/mergers-acquisitions/",
        destination: "/fr/services/fusions-acquisitions/",
        permanent: true,
      },
      {
        source: "/fr/services/corporate",
        destination: "/fr/services/services-corporatifs",
        permanent: true,
      },
      {
        source: "/fr/services/corporate/",
        destination: "/fr/services/services-corporatifs/",
        permanent: true,
      },
      {
        source: "/fr/services/incorporation",
        destination: "/fr/services/constitution-entreprise",
        permanent: true,
      },
      {
        source: "/fr/services/incorporation/",
        destination: "/fr/services/constitution-entreprise/",
        permanent: true,
      },
    ];
  },
  async rewrites() {
    // Map localized French slugs to existing English-slug routes for rendering
    return [
      {
        source: "/fr/services/comptabilite",
        destination: "/fr/services/accounting",
      },
      {
        source: "/fr/services/comptabilite/",
        destination: "/fr/services/accounting/",
      },
      { source: "/fr/services/fiscalite", destination: "/fr/services/taxes" },
      { source: "/fr/services/fiscalite/", destination: "/fr/services/taxes/" },
      { source: "/fr/services/paie", destination: "/fr/services/payroll" },
      { source: "/fr/services/paie/", destination: "/fr/services/payroll/" },
      {
        source: "/fr/services/externalisation",
        destination: "/fr/services/outsourcing",
      },
      {
        source: "/fr/services/externalisation/",
        destination: "/fr/services/outsourcing/",
      },
      {
        source: "/fr/services/fusions-acquisitions",
        destination: "/fr/services/mergers-acquisitions",
      },
      {
        source: "/fr/services/fusions-acquisitions/",
        destination: "/fr/services/mergers-acquisitions/",
      },
      {
        source: "/fr/services/services-corporatifs",
        destination: "/fr/services/corporate",
      },
      {
        source: "/fr/services/services-corporatifs/",
        destination: "/fr/services/corporate/",
      },
      {
        source: "/fr/services/constitution-entreprise",
        destination: "/fr/services/incorporation",
      },
      {
        source: "/fr/services/constitution-entreprise/",
        destination: "/fr/services/incorporation/",
      },
    ];
  },
  async headers() {
    return [
      // Cache Next.js static files aggressively
      {
        source: "/_next/static/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
      // Cache public assets (images, svgs, css, js) with long TTL
      {
        source: "/assets/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
      // Favicons and icons
      {
        source:
          "/:icon(favicon\\.ico|favicon\\.png|favicon\\.svg|apple-touch-icon\\.png)",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
      // Self-hosted fonts in /public/fonts
      {
        source: "/fonts/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
      // Web manifests change rarely but validate on each request
      {
        source: "/:manifest(site\\.webmanifest|manifest\\.webmanifest)",
        headers: [
          { key: "Cache-Control", value: "public, max-age=0, must-revalidate" },
        ],
      },
      // Robots and sitemaps (revalidate each request)
      {
        source: "/:file(robots\\.txt|sitemap\\.xml|sitemap_index\\.xml)",
        headers: [
          { key: "Cache-Control", value: "public, max-age=0, must-revalidate" },
        ],
      },
    ];
  },
};

module.exports = withBundleAnalyzer(baseConfig);
