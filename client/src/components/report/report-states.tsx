import { useState } from "react";
import { Loader2, AlertTriangle, Inbox, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { downloadReportExport, type ReportFilterValue } from "@/lib/reportApi";
import { DataTableStateRow } from "@/components/data-table-state";

/**
 * Patch 2 Stage 1 — shared, card-level report state components.
 *
 * These are the non-table-row counterparts to {@link DataTableStateRow}
 * (re-exported here for a single import surface). Use the row variant inside a
 * `<TableBody>`; use these block variants for card/list layouts. They exist so
 * report pages render REAL loading / empty / error / validation states instead
 * of swallowing failures or fabricating rows.
 */

export function ReportLoadingState({
  label = "Loading…",
  className,
}: {
  label?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-2 py-12 text-slate-500 dark:text-zinc-400",
        className,
      )}
      role="status"
      aria-live="polite"
    >
      <Loader2 className="h-6 w-6 animate-spin" />
      <span className="text-sm">{label}</span>
    </div>
  );
}

export function ReportEmptyState({
  label = "No records found.",
  hint,
  className,
}: {
  label?: string;
  hint?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-2 py-12 text-slate-500 dark:text-zinc-400",
        className,
      )}
    >
      <Inbox className="h-6 w-6 text-slate-300 dark:text-zinc-600" />
      <span className="text-sm font-medium">{label}</span>
      {hint && <span className="text-xs text-slate-400 dark:text-zinc-500">{hint}</span>}
    </div>
  );
}

export function ReportErrorState({
  label = "Failed to load the report.",
  description,
  onRetry,
  className,
}: {
  label?: string;
  description?: string;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-2 py-12 text-rose-600 dark:text-rose-400",
        className,
      )}
      role="alert"
    >
      <AlertTriangle className="h-6 w-6" />
      <span className="text-sm font-semibold">{label}</span>
      {description && (
        <span className="text-xs text-rose-500/80 dark:text-rose-400/80">{description}</span>
      )}
      {onRetry && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="mt-2"
          onClick={onRetry}
        >
          Retry
        </Button>
      )}
    </div>
  );
}

export function ReportValidationMessage({
  message,
  className,
}: {
  message?: string | null;
  className?: string;
}) {
  if (!message) return null;
  return (
    <p
      className={cn("text-xs font-medium text-rose-600 dark:text-rose-400", className)}
      role="alert"
    >
      {message}
    </p>
  );
}

export function ReportToolbar({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-end gap-3", className)}>{children}</div>
  );
}

export function ReportPagination({
  page,
  pageCount,
  total,
  onPrev,
  onNext,
  className,
}: {
  page: number;
  pageCount: number;
  total?: number;
  onPrev?: () => void;
  onNext?: () => void;
  className?: string;
}) {
  const safeCount = Math.max(pageCount, 1);
  return (
    <div className={cn("flex items-center justify-between gap-4", className)}>
      <span className="text-sm text-slate-500 dark:text-zinc-400">
        Page {page} of {safeCount}
        {typeof total === "number" ? ` · ${total} entries` : ""}
      </span>
      <div className="flex items-center gap-1">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={page <= 1}
          onClick={onPrev}
        >
          Previous
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={page >= safeCount}
          onClick={onNext}
        >
          Next
        </Button>
      </div>
    </div>
  );
}

export function ReportExportButton({
  url,
  filename,
  filters,
  label = "Export",
  method,
  disabled,
  className,
}: {
  url: string;
  filename: string;
  filters?: Record<string, ReportFilterValue>;
  label?: string;
  method?: string;
  disabled?: boolean;
  className?: string;
}) {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);

  const handleExport = async () => {
    setBusy(true);
    try {
      await downloadReportExport({ url, filename, filters, method });
      toast({ title: "Export ready", description: filename });
    } catch (err: any) {
      // Honest failure — no file is saved on error.
      toast({
        title: "Export failed",
        description: err?.message || "Please try again.",
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className={className}
      disabled={disabled || busy}
      onClick={handleExport}
    >
      {busy ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Download className="mr-1 h-4 w-4" />}
      {label}
    </Button>
  );
}

export { DataTableStateRow };
