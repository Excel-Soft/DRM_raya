"use client";

import type { ReactNode } from "react";
import { AuthProvider } from "./auth-provider";
import { ThemeProvider } from "./theme-provider";
import { AppToaster } from "@/components/ui/toaster";

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
      <AuthProvider>
        {children}
        <AppToaster />
      </AuthProvider>
    </ThemeProvider>
  );
}
