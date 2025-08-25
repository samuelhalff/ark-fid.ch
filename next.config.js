/** @type {import('next').NextConfig} */
const nextConfig = {
  trailingSlash: true,
  images: {
    unoptimized: false,
  },
  swcMinify: true,
};

module.exports = nextConfig;
