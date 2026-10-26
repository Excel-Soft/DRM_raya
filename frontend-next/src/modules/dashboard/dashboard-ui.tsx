"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import {
  BarChart3,
  Bell,
  CalendarCheck,
  ClipboardList,
  LayoutGrid,
  Shield,
  Users,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import {
  DASHBOARD_NOTICE_BOARD,
  DASHBOARD_POLICIES,
  DASHBOARD_TRAINING,
} from "@/lib/navigation/dashboard-routes";
import { ATTENDANCE_MAIN } from "@/lib/navigation/attendance-routes";
import { LEAD_LEAD_POOL } from "@/lib/navigation/lead-routes";
import { cn } from "@/lib/utils/cn";

export const dashboardPanelClass =
  "rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950";

export function DashboardShell({
  title = "Dashboard",
  description = "Team performance, queue, follow-ups, and quick actions.",
  actions,
  children,
}: {
  title?: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Card className="overflow-hidden !p-0">
      <div className="border-b border-zinc-200 px-4 py-4 sm:px-5 dark:border-zinc-800">
        <PageHeader eyebrow="Home" title={title} description={description} actions={actions} className="mb-0" />
      </div>
      <div className="min-w-0 p-4 sm:p-5">{children}</div>
    </Card>
  );
}

/** Main column: KPIs and wide tables (left, primary width). */
export function DashboardMain({ children }: { children: ReactNode }) {
  return <div className="min-w-0 space-y-4">{children}</div>;
}

export const dashboardSidebarHeader =
  "border-b border-zinc-100 px-4 py-3 dark:border-zinc-800";

export const dashboardSidebarContent = "px-4 pb-4 pt-3 sm:pb-5";

/** Right rail: widgets stack full height (page scroll, no inner clip). */
export function DashboardAside({ children }: { children: ReactNode }) {
  return (
    <aside className="flex min-w-0 w-full flex-col gap-4 lg:gap-5">{children}</aside>
  );
}

const BANNER_LINKS = [
  { href: DASHBOARD_NOTICE_BOARD, label: "Notice", icon: Bell },
  { href: DASHBOARD_POLICIES, label: "Policies", icon: Shield },
  { href: DASHBOARD_TRAINING, label: "Training", icon: ClipboardList },
  { href: LEAD_LEAD_POOL, label: "Lead pool", icon: Users },
  { href: ATTENDANCE_MAIN, label: "Attendance", icon: CalendarCheck },
  { href: "/dashboard/reports/bv", label: "BV report", icon: BarChart3 },
] as const;

export function DashboardIconBanner() {
  return (
    <div
      className={cn(
        dashboardPanelClass,
        "overflow-hidden bg-gradient-to-br from-emerald-600 to-emerald-800 p-4 pb-5 text-white shadow-md",
      )}
    >
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white/15 backdrop-blur-sm">
          <LayoutGrid className="h-5 w-5" aria-hidden />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold tracking-tight">Workspace</p>
          <p className="mt-0.5 text-xs text-emerald-100/90">Shortcuts & live updates</p>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-1.5">
        {BANNER_LINKS.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className="flex items-center gap-2 rounded-lg bg-white/10 px-2 py-2 text-[11px] font-medium leading-tight transition hover:bg-white/20"
          >
            <Icon className="h-3.5 w-3.5 shrink-0 opacity-95" aria-hidden />
            <span className="min-w-0 truncate">{label}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}

export function DashboardSectionHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
      <div>
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{title}</h2>
        {description ? (
          <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">{description}</p>
        ) : null}
      </div>
      {actions}
    </div>
  );
}
