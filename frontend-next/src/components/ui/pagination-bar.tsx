import { cn } from "@/lib/utils/cn";
import { Button } from "./button";
import { paginationSummary } from "@/lib/pagination";

export function PaginationBar({
  page,
  pageSize,
  total,
  onPageChange,
  disabled,
  className,
}: {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  disabled?: boolean;
  className?: string;
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize) || 1);
  const canPrev = page > 1;
  const canNext = page < totalPages;

  return (
    <nav
      className={cn(
        "flex flex-wrap items-center justify-between gap-3 border-t border-zinc-200 pt-3 dark:border-zinc-800",
        className,
      )}
      aria-label="Pagination"
    >
      <p className="text-sm text-zinc-600 dark:text-zinc-400">{paginationSummary(page, pageSize, total)}</p>
      <div className="flex items-center gap-2">
        <Button
          variant="secondary"
          size="sm"
          disabled={disabled || !canPrev}
          onClick={() => onPageChange(page - 1)}
          aria-label="Previous page"
        >
          Previous
        </Button>
        <span className="text-sm tabular-nums text-zinc-700 dark:text-zinc-300" aria-live="polite">
          Page {page} of {totalPages}
        </span>
        <Button
          variant="secondary"
          size="sm"
          disabled={disabled || !canNext}
          onClick={() => onPageChange(page + 1)}
          aria-label="Next page"
        >
          Next
        </Button>
      </div>
    </nav>
  );
}
