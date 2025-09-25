import localFont from 'next/font/local';

// Self-hosted Inter (variable, normal + italic, full weight range).
// Place files at app/(assets)/fonts/Inter-Variable*.woff2
export const inter = localFont({
  src: [
    { path: './(assets)/fonts/Inter-Variable.woff2', style: 'normal', weight: '100 900' },
    { path: './(assets)/fonts/Inter-Variable-Italic.woff2', style: 'italic', weight: '100 900' },
  ],
  variable: '--font-inter',
  display: 'swap',
  fallback: ['system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'Arial', 'sans-serif'],
});
