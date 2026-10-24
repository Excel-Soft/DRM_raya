"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { PageHeader } from "@/components/ui/page-header";
import { cn } from "@/lib/utils/cn";
import { DrmSection, drmFieldClass } from "@/modules/drm/drm-ui";

export { DrmSection, drmFieldClass };

const HeaderActionsContext = createContext<{
  actions: ReactNode;
  setHeaderActions: (node: ReactNode) => void;
} | null>(null);

export function UserReportsHeaderActionsProvider({ children }: { children: ReactNode }) {
  const [actions, setActions] = useState<ReactNode>(null);
  const setHeaderActions = useCallback((node: ReactNode) => {
    setActions(node);
  }, []);
  const value = useMemo(() => ({ actions, setHeaderActions }), [actions, setHeaderActions]);
  return <HeaderActionsContext.Provider value={value}>{children}</HeaderActionsContext.Provider>;
}

export function useUserReportsHeaderActions() {
  const ctx = useContext(HeaderActionsContext);
  if (!ctx) {
    throw new Error("useUserReportsHeaderActions must be used within UserReportsHeaderActionsProvider");
  }
  return ctx.setHeaderActions;
}

export function UserReportsShell({
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
  const ctx = useContext(HeaderActionsContext);
  return (
    <div className="mx-auto w-full max-w-[1600px] space-y-5 pb-8">
      <PageHeader
        eyebrow="User reports"
        title={title}
        description={description}
        actions={
          <div className="flex flex-wrap items-center justify-end gap-2">
            {ctx?.actions}
            {actions}
          </div>
        }
      />
      <div className="space-y-5">{children}</div>
    </div>
  );
}

/** @deprecated Prefer DrmSection — kept for loan sub-panels */
export const urCardClass =
  "rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950";

export const urCardHeaderClass =
  "border-b border-zinc-100 px-4 py-3 dark:border-zinc-800";

export const urSectionTitleClass = "text-sm font-semibold text-zinc-900 dark:text-zinc-100";

export const urMutedLabelClass = "text-xs font-medium text-zinc-500 dark:text-zinc-400";

export const urTableHeaderClass = "bg-emerald-50/90 dark:bg-zinc-900";

export const urTableHeadClass =
  "text-xs font-semibold uppercase tracking-wide text-zinc-600 dark:text-zinc-400";

export function urSelectTriggerClass(): string {
  return cn(drmFieldClass, "h-9 w-full text-sm");
}

export function UrExportButtonBar({
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
