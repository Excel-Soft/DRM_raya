"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NOTICE_BOARD, NOTICE_POLICIES } from "@/lib/navigation/notice-routes";
import { cn } from "@/lib/utils/cn";

const TABS = [
  { href: NOTICE_BOARD, label: "Notice board" },
  { href: NOTICE_POLICIES, label: "DRM policies" },
] as const;

export function NoticeNavTabs() {
  const pathname = usePathname();
  return (
    <nav
      className="inline-flex rounded-lg border border-zinc-200 bg-zinc-50/80 p-0.5 dark:border-zinc-800 dark:bg-zinc-900/50"
      aria-label="Notice module"
    >
      {TABS.map((tab) => {
        const active = pathname === tab.href || pathname.startsWith(`${tab.href}/`);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              "rounded-md px-3 py-1.5 text-xs font-semibold transition",
              active
                ? "bg-white text-emerald-700 shadow-sm dark:bg-zinc-800 dark:text-emerald-400"
                : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200",
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
