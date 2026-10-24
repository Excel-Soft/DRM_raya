import type { ReactNode } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { cn } from "@/lib/utils/cn";
import { drmFieldClass } from "@/modules/drm/drm-ui";

export { DrmSection, drmFieldClass } from "@/modules/drm/drm-ui";

export const PORTFOLIO_RESERVATION_LOCK_HOURS = 48;

export type PortfolioReservationLiveStatus = "active" | "confirmed" | "rejected" | "expired";

/** MD-21: lazy expiry — same rules as server portfolio-routes.ts */
export function computePortfolioReservationLiveStatus(r: {
  status: string;
  expiresAt: string;
}): PortfolioReservationLiveStatus {
  if (r.status === "active" && new Date(r.expiresAt).getTime() <= Date.now()) return "expired";
  return r.status as Exclude<PortfolioReservationLiveStatus, "expired">;
}

export function PortfolioShell({
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
    <div className="mx-auto w-full max-w-[1600px] space-y-5 pb-8">
      <PageHeader eyebrow="Portfolio" title={title} description={description} actions={actions} />
      <div className="space-y-5">{children}</div>
    </div>
  );
}

/** Toolbar row inside a section (search, view toggles, badges). */
export function PortfolioSectionToolbar({ leading, trailing }: { leading?: ReactNode; trailing?: ReactNode }) {
  return (
    <div className="mb-4 flex flex-col gap-3 border-b border-zinc-100 pb-4 dark:border-zinc-800/80 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 flex-wrap items-center gap-2">{leading}</div>
      <div className="flex flex-wrap items-center gap-2">{trailing}</div>
    </div>
  );
}

export function portfolioSelectTriggerClass(): string {
  return cn(drmFieldClass, "h-9 w-full text-sm");
}

export function fmtPortfolioDate(value?: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" });
}

export function PortfolioFileField({
  label,
  multiple,
  filesLabel,
  onChange,
}: {
  label: string;
  multiple?: boolean;
  filesLabel: string;
  onChange: (files: FileList | null) => void;
}) {
  return (
    <div className="space-y-1.5">
      <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">{label}</span>
      <div className="flex overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-800">
        <label className="flex cursor-pointer items-center justify-center border-r border-zinc-200 bg-zinc-50 px-4 py-2 text-xs font-medium text-zinc-600 transition hover:bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800">
          Choose {multiple ? "files" : "file"}
          <input
            type="file"
            className="hidden"
            multiple={multiple}
            accept="image/*"
            onChange={(e) => onChange(e.target.files)}
          />
        </label>
        <div className="flex min-h-9 flex-1 items-center truncate px-3 text-xs text-zinc-500 dark:text-zinc-400">{filesLabel}</div>
      </div>
    </div>
  );
}
