// This is the most important part: mark this component as a client component.
"use client";

import ThemeProvider from "@/src/components/ui/theme-provider";
import React from "react";

// This new component will wrap all your client-side providers.
export function Providers({ children }: { children: React.ReactNode }) {
  return <ThemeProvider>{children}</ThemeProvider>;
}
