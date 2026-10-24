"use client";

import { HiOutlineMoon, HiOutlineSun } from "react-icons/hi2";
import { useTheme } from "@/providers/theme-provider";
import { toast } from "@/lib/toast";

export function ThemeToggle() {
  const { toggleLightDark, resolved } = useTheme();
  const isDark = resolved === "dark";

  return (
    <button
      type="button"
      onClick={() => {
        const enablingDark = !isDark;
        toggleLightDark();
        toast.message(enablingDark ? "Dark theme enabled" : "Light theme enabled");
      }}
      className="inline-flex items-center gap-1.5 rounded-md border border-zinc-200 bg-white px-2.5 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
      aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
      title={isDark ? "Switch to light theme" : "Switch to dark theme"}
    >
      {isDark ? <HiOutlineSun className="h-4 w-4" aria-hidden /> : <HiOutlineMoon className="h-4 w-4" aria-hidden />}
      <span className="hidden sm:inline">{isDark ? "Light" : "Dark"}</span>
    </button>
  );
}
