"use client";

import type { ReactNode } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DrmSection, drmFieldClass, DrmInlineActions } from "@/modules/drm/drm-ui";
import { AttendanceNavTabs } from "@/modules/attendance/attendance-nav";
import { cn } from "@/lib/utils/cn";

export { DrmSection, drmFieldClass, DrmInlineActions };

/** Legacy select triggers in ported forms — matches Customer / Reports fields. */
export function attSelectTriggerClass(extra?: string) {
  return cn(drmFieldClass, "h-9 w-full text-sm", extra);
}

export function AttendanceShell({
  title,
  description,
  actions,
  children,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Card className="overflow-hidden !p-0">
      <div className="space-y-4 border-b border-zinc-200 px-4 py-4 sm:px-5 dark:border-zinc-800">
        <PageHeader
          eyebrow="Attendance"
          title={title}
          description={description}
          actions={actions}
          className="mb-0"
        />
        <AttendanceNavTabs />
      </div>
      <div className="space-y-5 p-4 sm:p-5">{children}</div>
    </Card>
  );
}

export function AttendanceTable({
  children,
  minWidth = "640px",
}: {
  children: ReactNode;
  minWidth?: string;
}) {
  return (
    <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
      <table className="w-full border-collapse text-left" style={{ minWidth }}>
        {children}
      </table>
    </div>
  );
}

export function AttendanceExportBar({
  labels,
  onAction,
}: {
  labels: string[];
  onAction: (label: string) => void;
}) {
  return (
    <div
      className="inline-flex overflow-hidden rounded-lg border border-zinc-200 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900"
      role="toolbar"
      aria-label="Export"
    >
      {labels.map((label, i) => (
        <button
          key={label}
          type="button"
          onClick={() => onAction(label)}
          className={cn(
            "px-3 py-1.5 text-xs font-semibold text-zinc-700 transition hover:bg-emerald-50 hover:text-emerald-800 dark:text-zinc-300 dark:hover:bg-emerald-950/40 dark:hover:text-emerald-300",
            i < labels.length - 1 && "border-r border-zinc-200 dark:border-zinc-700",
          )}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

export function AttendanceToolbar({
  left,
  right,
}: {
  left?: ReactNode;
  right?: ReactNode;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      {left ? <div className="flex flex-wrap items-end gap-2">{left}</div> : <span />}
      {right ? <div className="flex flex-wrap items-end gap-2">{right}</div> : null}
    </div>
  );
}

/** Segmented tabs (Daily / Monthly / …) — emerald active pill. */
export function AttendanceTabBar({
  tabs,
  active,
  onChange,
  className,
}: {
  tabs: { id: string; label: ReactNode }[];
  active: string;
  onChange: (id: string) => void;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "grid gap-2 text-center sm:grid-cols-2 lg:grid-cols-4",
        className,
      )}
      role="tablist"
    >
      {tabs.map((tab) => {
        const isActive = tab.id === active;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(tab.id)}
            className={cn(
              "rounded-lg px-3 py-2.5 text-sm font-semibold transition-colors",
              isActive
                ? "bg-emerald-600 text-white shadow-sm"
                : "border border-zinc-200 bg-zinc-50 text-zinc-600 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800",
            )}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}

export const attTableHeadRowClass =
  "border-b border-zinc-200 bg-emerald-50/90 dark:border-zinc-800 dark:bg-zinc-900";

export const attTableHeadCellClass =
  "px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-zinc-700 dark:text-zinc-300";

export const attTableBodyRowClass =
  "border-b border-zinc-100 transition-colors hover:bg-zinc-50/80 dark:border-zinc-800 dark:hover:bg-zinc-900/60";

export const attTableBodyCellClass = "px-4 py-3 text-sm text-zinc-600 dark:text-zinc-400";

export function AttendanceStatCard({
  label,
  value,
  hint,
  icon,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  icon?: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">{label}</p>
        {icon}
      </div>
      <p className="mt-2 text-2xl font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
        {value}
      </p>
      {hint ? <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{hint}</p> : null}
    </div>
  );
}

export function AttendanceActionButton({
  children,
  onClick,
  disabled,
  variant = "primary",
  className,
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  variant?: "primary" | "secondary" | "warning";
  className?: string;
}) {
  const map = {
    primary: "primary" as const,
    secondary: "secondary" as const,
    warning: "danger" as const,
  };
  return (
    <Button
      type="button"
      variant={map[variant]}
      size="md"
      disabled={disabled}
      onClick={onClick}
      className={cn("gap-2", className)}
    >
      {children}
    </Button>
  );
}
