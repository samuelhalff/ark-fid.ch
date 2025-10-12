import { Inter } from 'next/font/google';

// Inter, self-hosted via next/font with minimal payload and best practices:
// - Limit to used weights/styles
// - Keep swap to avoid FOIT
// - Adjust fallback metrics to reduce layout shift
// - Preload is handled automatically per route
export const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '600', '700'],
  style: ['normal'],
  variable: '--font-inter',
  display: 'swap',
  adjustFontFallback: true,
  preload: true,
  fallback: ['system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'Arial', 'sans-serif'],
});
