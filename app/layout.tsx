// You'll want a global CSS file for base styles and Tailwind imports
import "./globals.css";

// NavBar moved into locale layout so it can receive the current locale from params
import Footer from "@/app/[locale]/shared/footer";

import { Providers } from "@/src/components/providers"; // Import your new client provider
import { Metadata } from "next";

// import { Inter } from "next/font/google";

// const inter = Inter({ subsets: ["latin"] });

// Here we define the STATIC metadata for the entire site
// This is the baseline, and can be overridden by individual pages

export const metadata: Metadata = {
  title: {
    template: "%s - Ark Fiduciaire",
    default: "Ark Fiduciaire - Professional Fiduciary Services in Switzerland",
  },
  description:
    "Expert fiduciary, accounting, and tax services in Switzerland. Corporate services, payroll management, domiciliation, and comprehensive business solutions.",
  keywords:
    "fiduciary services, accounting, tax services, Switzerland, corporate services, payroll, domiciliation",
  authors: [{ name: "Ark Fiduciaire" }],
  creator: "Ark Fiduciaire",
  publisher: "Ark Fiduciaire",
  robots: {
    index: true,
    follow: true,
  },
  icons: {
    icon: [
      {
        url: "/favicon.ico",
        sizes: "any",
      },
      {
        url: "/favicon.png",
        type: "image/png",
      },
    ],
    apple: [
      {
        url: "/favicon.png",
        sizes: "180x180",
        type: "image/png",
      },
    ],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        {/* Inline script to set theme class before React hydrates to avoid flicker */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var theme=localStorage.getItem('theme');if(theme==='dark'||(!theme&&window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches)){document.documentElement.classList.add('dark');}else{document.documentElement.classList.remove('dark');}}catch(e){} })()`,
          }}
        />
        <Providers>
          <main className="pt-3 abstract-background text-foreground pt-15 mt-10">
            {children}
          </main>
          <Footer />
        </Providers>
      </body>
    </html>
  );
}
