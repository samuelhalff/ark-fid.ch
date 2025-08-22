/** @type {import('next').NextConfig} */
const nextConfig = {
  // reactStrictMode is a good default to keep.
  reactStrictMode: true,

  // Add your internationalization config here if you have one.
  // i18n: { ... },

  // WE ARE REMOVING:
  // - The conditional logic for production/development.
  // - `output: "export"` to re-enable the Next.js server.
  // - `distDir` to use the standard `.next` folder.
  // - `images: { unoptimized: true }` to re-enable powerful image optimization.
};

export default nextConfig;