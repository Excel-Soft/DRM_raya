"use client";

import Link from "next/link";
import {
  BarChart2,
  Briefcase,
  CalendarClock,
  ClipboardList,
  FileText,
  Settings,
  Users,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { ATTENDANCE_LOAN, ATTENDANCE_MAIN, ATTENDANCE_OVERTIME } from "@/lib/navigation/attendance-routes";
import { DRM_PMS_SETTING } from "@/lib/navigation/drm-routes";
import { QUICK_SALE_COMMISSION } from "@/lib/navigation/quick-link-routes";
import { legacyAppHref } from "@/lib/navigation/migrated-routes";
import { cn } from "@/lib/utils/cn";
import { dashboardPanelClass } from "@/modules/dashboard/dashboard-ui";

const LEGACY_PMS = [
  { label: "Running projects", href: "/pms/running-projects", icon: Briefcase },
  { label: "Project tasks", href: "/pms/tasks", icon: ClipboardList },
  { label: "Project report", href: "/pms/project-report", icon: BarChart2 },
  { label: "Project list", href: "/pms/status", icon: FileText },
] as const;

const NEXT_LINKS = [
  { label: "PMS setting", href: DRM_PMS_SETTING, icon: Settings },
  { label: "Attendance", href: ATTENDANCE_MAIN, icon: Users },
  { label: "Loan application", href: ATTENDANCE_LOAN, icon: FileText },
  { label: "Over time", href: ATTENDANCE_OVERTIME, icon: CalendarClock },
  { label: "Commission verification", href: QUICK_SALE_COMMISSION, icon: BarChart2 },
] as const;

function LinkTile({
  label,
  href,
  icon: Icon,
  external,
}: {
  label: string;
  href: string;
  icon: typeof Settings;
  external?: boolean;
}) {
  const className = cn(
    dashboardPanelClass,
    "flex items-center gap-3 px-4 py-3 text-sm font-medium transition hover:border-emerald-200 hover:bg-emerald-50/50 dark:hover:border-emerald-900 dark:hover:bg-emerald-950/30",
  );
  const inner = (
    <>
      <Icon className="h-4 w-4 shrink-0 text-emerald-600" aria-hidden />
      <span className="min-w-0 truncate">{label}</span>
    </>
  );
  if (external) {
    return (
      <a href={href} className={className} target="_blank" rel="noopener noreferrer">
        {inner}
      </a>
    );
  }
  return (
    <Link href={href} className={className}>
      {inner}
    </Link>
  );
}

export function DdManagerHubView() {
  const legacyOrigin = process.env.NEXT_PUBLIC_LEGACY_APP_ORIGIN;

  return (
    <Card className="overflow-hidden !p-0">
      <div className="border-b border-zinc-200 px-4 py-4 sm:px-5 dark:border-zinc-800">
        <PageHeader
          eyebrow="Dashboard"
          title="D&D Manager"
          description="Project hub shortcuts — Next modules and legacy PMS where needed."
          className="mb-0"
        />
      </div>
      <div className="space-y-6 p-4 sm:p-5">
        <section>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-zinc-500">Next app</h2>
          <div className="grid gap-2 sm:grid-cols-2">
            {NEXT_LINKS.map((item) => (
              <LinkTile key={item.href} {...item} />
            ))}
          </div>
        </section>
        <section>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-zinc-500">PMS (legacy)</h2>
          {!legacyOrigin ? (
            <p className="text-sm text-muted-foreground">
              Set <code className="text-xs">NEXT_PUBLIC_LEGACY_APP_ORIGIN</code> to open PMS screens in the Vite app.
            </p>
          ) : null}
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {LEGACY_PMS.map((item) => (
              <LinkTile
                key={item.href}
                label={item.label}
                href={legacyAppHref(item.href)}
                icon={item.icon}
                external={!!legacyOrigin}
              />
            ))}
          </div>
        </section>
      </div>
    </Card>
  );
}
