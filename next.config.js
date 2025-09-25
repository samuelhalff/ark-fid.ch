const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
  openAnalyzer: false,
});

/** @type {import('next').NextConfig} */
const baseConfig = {
  trailingSlash: true,
  productionBrowserSourceMaps: true,
  experimental: {
    optimizePackageImports: ['lucide-react', 'react-hook-form', 'sonner']
  },
  output: 'standalone',
  images: {
    unoptimized: false,
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [360, 414, 640, 768, 1024, 1280, 1536],
    imageSizes: [16, 24, 32, 48, 64, 96, 128, 256, 384],
  },
  swcMinify: true,
};

module.exports = withBundleAnalyzer(baseConfig);
