import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";
import { PageEmpty, PageError } from "./page-states";
import { TableSkeleton } from "./skeleton";

export type DataTableColumn<T> = {
  id: string;
  header: ReactNode;
  cell: (row: T) => ReactNode;
  className?: string;
  headerClassName?: string;
};

export function DataTable<T>({
  caption,
  columns,
  rows,
  rowKey,
  loading,
  error,
  onRetry,
  emptyMessage = "No data to display.",
  className,
}: {
  caption?: string;
  columns: DataTableColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  emptyMessage?: string;
  className?: string;
}) {
  if (loading) {
    return (
      <div role="status" aria-live="polite" aria-label="Loading table">
        <span className="sr-only">Loading table…</span>
        <TableSkeleton columns={Math.min(columns.length, 6) || 4} className={className} />
      </div>
    );
  }
  if (error) {
    return <PageError message={error} onRetry={onRetry} />;
  }
  if (rows.length === 0) {
    return <PageEmpty message={emptyMessage} />;
  }

  return (
    <div className={cn("overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800", className)}>
      <table className="min-w-full divide-y divide-zinc-200 text-sm dark:divide-zinc-800">
        {caption ? <caption className="sr-only">{caption}</caption> : null}
        <thead className="bg-zinc-50 dark:bg-zinc-950/80">
          <tr>
            {columns.map((col) => (
              <th
                key={col.id}
                scope="col"
                className={cn(
                  "px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-zinc-600 dark:text-zinc-400",
                  col.headerClassName,
                )}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100 bg-white dark:divide-zinc-800 dark:bg-zinc-900">
          {rows.map((row) => (
            <tr key={rowKey(row)} className="hover:bg-zinc-50/80 dark:hover:bg-zinc-800/40">
              {columns.map((col) => (
                <td key={col.id} className={cn("px-3 py-2 align-top text-zinc-800 dark:text-zinc-200", col.className)}>
                  {col.cell(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
