import { Inter } from 'next/font/google';

// Google Fonts Inter (variable, normal + italic, full weight range).
export const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
  fallback: ['system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'Arial', 'sans-serif'],
});
