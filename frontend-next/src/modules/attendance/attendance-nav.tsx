"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ATTENDANCE_LEAVE,
  ATTENDANCE_LOAN,
  ATTENDANCE_MAIN,
  ATTENDANCE_OVERTIME,
  ATTENDANCE_TODO,
} from "@/lib/navigation/attendance-routes";
import { cn } from "@/lib/utils/cn";

const TABS = [
  { href: ATTENDANCE_MAIN, label: "Attendance" },
  { href: ATTENDANCE_TODO, label: "To do list" },
  { href: ATTENDANCE_LEAVE, label: "Leave request" },
  { href: ATTENDANCE_OVERTIME, label: "Overtime" },
  { href: ATTENDANCE_LOAN, label: "Loan / advance" },
] as const;

export function AttendanceNavTabs({ className }: { className?: string }) {
  const pathname = usePathname();
  return (
    <nav
      className={cn(
        "flex flex-wrap gap-1 rounded-xl border border-zinc-200 bg-zinc-50/90 p-1 dark:border-zinc-800 dark:bg-zinc-900/60",
        className,
      )}
      aria-label="Attendance module"
    >
      {TABS.map((tab) => {
        const active =
          tab.href === ATTENDANCE_MAIN
            ? pathname === ATTENDANCE_MAIN
            : pathname === tab.href || pathname.startsWith(`${tab.href}/`);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              "rounded-lg px-2.5 py-1.5 text-xs font-semibold transition sm:px-3 sm:text-sm",
              active
                ? "bg-white text-emerald-700 shadow-sm dark:bg-zinc-800 dark:text-emerald-400"
                : "text-zinc-600 hover:bg-white/60 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800/50 dark:hover:text-zinc-200",
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
