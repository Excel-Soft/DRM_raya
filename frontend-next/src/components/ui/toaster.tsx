"use client";

import { Toaster } from "sonner";
import { useTheme } from "@/providers/theme-provider";

export function AppToaster() {
  const { resolved } = useTheme();
  return (
    <Toaster
      theme={resolved}
      richColors
      closeButton
      position="top-right"
      toastOptions={{
        classNames: {
          toast:
            "border border-zinc-200 bg-white text-zinc-900 shadow-lg dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100",
        },
      }}
    />
  );
}
