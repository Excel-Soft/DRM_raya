import type { ReactNode } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { cn } from "@/lib/utils/cn";
import { drmFieldClass } from "@/modules/drm/drm-ui";

export { DrmSection, DrmFormActions, DrmInlineActions, drmFieldClass } from "@/modules/drm/drm-ui";

export const pdSelectTriggerClass = cn(drmFieldClass, "h-9 w-full text-sm");

export function PostingDataShell({
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
    <div className="space-y-4">
      <PageHeader eyebrow="Posting data" title={title} description={description} actions={actions} />
      {children}
    </div>
  );
}

export const pdDialogShellClass =
  "gap-0 overflow-hidden border-zinc-200 bg-white p-0 dark:border-zinc-800 dark:bg-zinc-900 sm:rounded-2xl";

export function PdFormGrid({ children, cols = 4 }: { children: ReactNode; cols?: 3 | 4 }) {
  const colClass = cols === 3 ? "md:grid-cols-2 lg:grid-cols-3" : "md:grid-cols-2 lg:grid-cols-4";
  return <div className={cn("grid grid-cols-1 gap-4", colClass)}>{children}</div>;
}

export function PdStatTile({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white px-4 py-4 dark:border-zinc-800 dark:bg-zinc-900">
      <p className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">{value}</p>
    </div>
  );
}
