"use client";

// You'll want a global CSS file for base styles and Tailwind imports
import "./global.css";
import "@/src/i18n";

import NavBar from "@/src/components/navigation/Navbar";
import Footer from "@/app/shared/footer";

import { Providers } from "@/src/components/providers"; // Import your new client provider

// import { Inter } from "next/font/google";

// const inter = Inter({ subsets: ["latin"] });

// Here we define the STATIC metadata for the entire site
// This is the baseline, and can be overridden by individual pages

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <Providers>
          <NavBar />
          <main className="p-4 abstract-background text-foreground pt-15">
            {children}
          </main>
          <Footer />
        </Providers>
      </body>
    </html>
  );
}
