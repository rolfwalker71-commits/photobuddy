"use client";

import { ThemeProvider } from "next-themes";
import { RegisterSw } from "@/components/pwa/register-sw";
import { UploadQueueIndicator } from "@/components/upload-queue-indicator";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <RegisterSw />
      {children}
      <UploadQueueIndicator />
    </ThemeProvider>
  );
}
