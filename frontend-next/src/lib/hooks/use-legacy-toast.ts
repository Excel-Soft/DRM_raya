"use client";

import { toast } from "@/lib/toast";

type ToastInput = {
  title: string;
  description?: string;
  variant?: "default" | "destructive";
};

/** Shim for legacy Vite pages ported from `useToast`. */
export function useToast() {
  return {
    toast: ({ title, description, variant }: ToastInput) => {
      const message = description ? `${title}: ${description}` : title;
      if (variant === "destructive") toast.error(message);
      else toast.success(message);
    },
  };
}
