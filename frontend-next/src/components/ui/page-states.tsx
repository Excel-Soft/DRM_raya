import { Button } from "./button";
import { ModulePageSkeleton, TableSkeleton } from "./skeleton";

/** Shared async page states for admin/pilot modules (Phase 6 foundation). */

export function PageLoading({
  label = "Loading…",
  variant = "module",
}: {
  label?: string;
  /** `module` = title + table; `table` = table only */
  variant?: "module" | "table";
}) {
  return (
    <div className="relative">
      <span className="sr-only">{label}</span>
      {variant === "table" ? <TableSkeleton /> : <ModulePageSkeleton />}
    </div>
  );
}

export function PageEmpty({ message }: { message: string }) {
  return <p className="py-10 text-center text-sm text-zinc-500 dark:text-zinc-400">{message}</p>;
}

export function PageError({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div
      role="alert"
      className="rounded-lg border border-red-200 bg-red-50 px-4 py-6 text-center text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-200"
    >
      <p>{message}</p>
      {onRetry ? (
        <Button type="button" variant="secondary" size="sm" className="mt-3" onClick={onRetry}>
          Retry
        </Button>
      ) : null}
    </div>
  );
}

export function PageForbidden({ message }: { message: string }) {
  return (
    <div
      role="alert"
      className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-8 text-center text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-100"
    >
      {message}
    </div>
  );
}
