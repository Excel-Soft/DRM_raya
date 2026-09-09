import { Loader2 } from "lucide-react";
import { TableCell, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * DataTableStateRow — standard loading / error / empty rows for data tables
 * (Stage 10, section D). Drop inside <TableBody> when there is no data to show.
 * Returns `null` when there ARE rows so callers can do:
 *
 *   <TableBody>
 *     <DataTableStateRow colSpan={6} isLoading=… isError=… isEmpty=… onRetry=… />
 *     {hasRows && rows.map(...)}
 *   </TableBody>
 */
export function DataTableStateRow({
  colSpan,
  isLoading,
  isError,
  isEmpty,
  loadingLabel = "Loading…",
  emptyLabel = "No records found.",
  errorLabel = "Failed to load data.",
  onRetry,
  skeletonRows = 3,
}: {
  colSpan: number;
  isLoading?: boolean;
  isError?: boolean;
  isEmpty?: boolean;
  loadingLabel?: string;
  emptyLabel?: string;
  errorLabel?: string;
  onRetry?: () => void;
  skeletonRows?: number;
}) {
  if (isLoading) {
    return (
      <>
        {Array.from({ length: skeletonRows }).map((_, i) => (
          <TableRow key={`sk-${i}`} className="border-b border-slate-50 dark:border-zinc-800">
            <TableCell colSpan={colSpan} className="py-3">
              <Skeleton className="h-5 w-full" />
            </TableCell>
          </TableRow>
        ))}
        <TableRow>
          <TableCell colSpan={colSpan} className="py-2 text-center text-[12px] text-slate-400">
            <Loader2 className="w-4 h-4 animate-spin inline-block mr-1" /> {loadingLabel}
          </TableCell>
        </TableRow>
      </>
    );
  }
  if (isError) {
    return (
      <TableRow>
        <TableCell colSpan={colSpan} className="py-10 text-center text-rose-500 text-[13px]">
          {errorLabel}{" "}
          {onRetry && (
            <button onClick={onRetry} className="underline font-semibold ml-1">Retry</button>
          )}
        </TableCell>
      </TableRow>
    );
  }
  if (isEmpty) {
    return (
      <TableRow>
        <TableCell colSpan={colSpan} className="py-10 text-center text-slate-500 text-[13px]">{emptyLabel}</TableCell>
      </TableRow>
    );
  }
  return null;
}

export default DataTableStateRow;
