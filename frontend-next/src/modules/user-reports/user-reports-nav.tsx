"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  USER_REPORT_BV,
  USER_REPORT_GM,
  USER_REPORT_LOAN,
  USER_REPORT_VAS,
} from "@/lib/navigation/user-reports-routes";
import { cn } from "@/lib/utils/cn";

const TABS = [
  { href: USER_REPORT_LOAN, label: "Loan" },
  { href: USER_REPORT_VAS, label: "VAS" },
  { href: USER_REPORT_GM, label: "GM" },
  { href: USER_REPORT_BV, label: "BV" },
] as const;

export function UserReportsNavTabs() {
  const pathname = usePathname();
  return (
    <nav
      className="inline-flex flex-wrap rounded-lg border border-zinc-200 bg-zinc-50/80 p-0.5 dark:border-zinc-800 dark:bg-zinc-900/50"
      aria-label="User report types"
    >
      {TABS.map((tab) => {
        const active = pathname === tab.href || pathname.startsWith(`${tab.href}/`);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              "rounded-md px-2.5 py-1.5 text-xs font-semibold transition sm:px-3",
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
