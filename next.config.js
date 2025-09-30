const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
  openAnalyzer: false,
});

/** @type {import('next').NextConfig} */
const baseConfig = {
  trailingSlash: true,
  // Disable source maps on CI by default. Enable explicitly with BUILD_SOURCEMAPS=true
  productionBrowserSourceMaps: process.env.BUILD_SOURCEMAPS === 'true',
  experimental: {
    optimizePackageImports: ['lucide-react', 'react-hook-form', 'sonner']
  },
  output: 'standalone',
  images: {
    unoptimized: false,
    formats: ['image/webp'],
    deviceSizes: [360, 640, 768],
    imageSizes: [16, 24, 32, 48, 64, 96, 128, 256, 384],
  },
  swcMinify: true,
  async headers() {
    return [
      // Cache Next.js static files aggressively
      {
        source: '/_next/static/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
      // Cache public assets (images, svgs, css, js) with long TTL
      {
        source: '/assets/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
      // Favicons and icons
      {
        source: '/:icon(favicon\\.ico|favicon\\.png|favicon\\.svg|apple-touch-icon\\.png)',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
      // Web manifests change rarely but validate on each request
      {
        source: '/:manifest(site\\.webmanifest|manifest\\.webmanifest)',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=0, must-revalidate' },
        ],
      },
      // Robots and sitemaps (revalidate each request)
      {
        source: '/:file(robots\\.txt|sitemap\\.xml|sitemap_index\\.xml)',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=0, must-revalidate' },
        ],
      },
    ];
  },
};

module.exports = withBundleAnalyzer(baseConfig);
