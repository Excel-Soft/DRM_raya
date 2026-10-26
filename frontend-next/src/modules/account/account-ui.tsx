import type { ReactNode } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";
import { DrmSection, drmFieldClass } from "@/modules/drm/drm-ui";

export { DrmSection, drmFieldClass };

export const accountPanelClass =
  "rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900";

/** Large account workflow modals (installments, approvals). */
export const accountDialogShellClass =
  "flex h-[95vh] max-h-[95vh] w-[98vw] max-w-[98vw] flex-col gap-0 overflow-hidden border-zinc-200 bg-zinc-50 p-0 dark:border-zinc-800 dark:bg-zinc-950 sm:rounded-2xl";

export function AccountSummaryStrip({
  target,
  paid,
  remaining,
}: {
  target: number;
  paid: number;
  remaining: number;
}) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      <div className={cn(accountPanelClass, "px-4 py-3")}>
        <p className="text-[11px] font-bold uppercase tracking-wide text-zinc-500">Target</p>
        <p className="mt-1 text-lg font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
          ${Number(target || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </p>
      </div>
      <div className={cn(accountPanelClass, "px-4 py-3")}>
        <p className="text-[11px] font-bold uppercase tracking-wide text-emerald-700 dark:text-emerald-400">Paid</p>
        <p className="mt-1 text-lg font-semibold tabular-nums text-emerald-700 dark:text-emerald-400">
          ${Number(paid || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </p>
      </div>
      <div className={cn(accountPanelClass, "px-4 py-3")}>
        <p className="text-[11px] font-bold uppercase tracking-wide text-zinc-500">Remaining</p>
        <p
          className={cn(
            "mt-1 text-lg font-semibold tabular-nums",
            remaining > 0 ? "text-amber-700 dark:text-amber-400" : "text-emerald-700 dark:text-emerald-400",
          )}
        >
          ${Number(remaining || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </p>
      </div>
    </div>
  );
}

export function AccountShell({
  title,
  description,
  actions,
  children,
  className,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-4", className)}>
      <PageHeader eyebrow="Account" title={title} description={description} actions={actions} />
      {children}
    </div>
  );
}

export function AccountTextLink({
  children,
  onClick,
  active,
}: {
  children: ReactNode;
  onClick: () => void;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "text-sm font-semibold text-emerald-700 underline-offset-2 hover:underline dark:text-emerald-400",
        active && "underline",
      )}
    >
      {children}
    </button>
  );
}

export function AccountPrimaryButton({
  children,
  ...props
}: React.ComponentProps<typeof Button>) {
  return (
    <Button variant="primary" size="sm" {...props}>
      {children}
    </Button>
  );
}

export const accountTableWrapClass =
  "overflow-x-auto rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900";

/** Full-width table inside a flush `DrmSection` (no inner card border). */
export const accountTableFlushWrapClass = "w-full overflow-x-auto bg-white dark:bg-zinc-900";

export const accountTableClass = "min-w-full border-collapse text-xs sm:text-sm";

export const accountTableHeadRowClass =
  "border-b border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950/80";

export const accountTableHeadCellClass =
  "whitespace-nowrap px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-zinc-600 dark:text-zinc-400";

export const accountTableBodyRowClass =
  "border-b border-zinc-100 transition-colors hover:bg-zinc-50/90 dark:border-zinc-800 dark:hover:bg-zinc-800/40";

export function AccountFiltersCard({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        accountPanelClass,
        "flex flex-col gap-4 p-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function AccountFilterGroup({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <span className="text-[11px] font-bold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
        {label}
      </span>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

type FilterTone = "brand" | "danger" | "warn" | "neutral";

const filterToneActive: Record<FilterTone, string> = {
  brand: "border-emerald-600 bg-emerald-600 text-white shadow-sm",
  danger: "border-rose-600 bg-rose-600 text-white shadow-sm",
  warn: "border-amber-600 bg-amber-600 text-white shadow-sm",
  neutral: "border-zinc-700 bg-zinc-800 text-white shadow-sm dark:bg-zinc-700",
};

const filterToneIdle =
  "border-zinc-200 bg-white text-zinc-700 hover:border-emerald-300 hover:bg-emerald-50/80 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:border-emerald-700 dark:hover:bg-emerald-950/30";

export function AccountFilterChip({
  active,
  label,
  count,
  onClick,
  tone = "brand",
}: {
  active: boolean;
  label: string;
  count?: number;
  onClick: () => void;
  tone?: FilterTone;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors",
        active ? filterToneActive[tone] : filterToneIdle,
      )}
    >
      <span>{label}</span>
      {count !== undefined ? (
        <span
          className={cn(
            "min-w-[1.25rem] rounded-md px-1.5 py-0.5 text-center text-[10px] font-bold tabular-nums",
            active ? "bg-white/20 text-inherit" : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300",
          )}
        >
          {count}
        </span>
      ) : null}
    </button>
  );
}

export function AccountListToolbar({
  pageSize,
  pageSizeOptions,
  onPageSizeChange,
  search,
  onSearchChange,
  searchPlaceholder = "Search entries…",
}: {
  pageSize: number;
  pageSizeOptions: number[];
  onPageSizeChange: (n: number) => void;
  search: string;
  onSearchChange: (q: string) => void;
  searchPlaceholder?: string;
}) {
  return (
    <div className="flex flex-col gap-3 border-b border-zinc-200 px-4 py-3 sm:flex-row sm:items-center sm:justify-between dark:border-zinc-800">
      <label className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
        <span className="shrink-0">Show</span>
        <select
          value={pageSize}
          onChange={(e) => onPageSizeChange(Number(e.target.value))}
          className={cn(drmFieldClass, "h-9 w-20 text-sm")}
        >
          {pageSizeOptions.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
        <span className="shrink-0">entries</span>
      </label>
      <label className="flex w-full items-center gap-2 text-sm text-zinc-600 sm:max-w-xs dark:text-zinc-400">
        <span className="shrink-0">Search</span>
        <input
          type="search"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={searchPlaceholder}
          className={cn(drmFieldClass, "h-9 min-w-0 flex-1 text-sm")}
        />
      </label>
    </div>
  );
}
