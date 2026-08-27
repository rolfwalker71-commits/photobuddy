"use client";

import { ThemeProvider } from "next-themes";
import { RegisterSw } from "@/components/pwa/register-sw";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <RegisterSw />
      {children}
    </ThemeProvider>
  );
}
