import { cn } from "@/lib/utils/cn";

/** Pulse placeholder block — use for skeleton loaders across migrated modules. */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn("animate-pulse rounded-md bg-zinc-200/90 dark:bg-zinc-700/60", className)}
      aria-hidden
    />
  );
}

export function SkeletonText({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <div className={cn("space-y-2", className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} className={cn("h-3", i === lines - 1 ? "w-2/3" : "w-full")} />
      ))}
    </div>
  );
}

export function TableSkeleton({
  rows = 6,
  columns = 4,
  className,
}: {
  rows?: number;
  columns?: number;
  className?: string;
}) {
  return (
    <div
      className={cn("overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800", className)}
      role="status"
      aria-live="polite"
      aria-label="Loading table"
    >
      <div className="flex gap-3 border-b border-zinc-200 bg-zinc-50 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-950/80">
        {Array.from({ length: columns }).map((_, i) => (
          <Skeleton key={i} className="h-3 flex-1" />
        ))}
      </div>
      <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
        {Array.from({ length: rows }).map((_, r) => (
          <div key={r} className="flex gap-3 px-4 py-3">
            {Array.from({ length: columns }).map((_, c) => (
              <Skeleton key={c} className={cn("h-3 flex-1", c === 0 && "max-w-[40%]")} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

/** Typical pilot module: page title + optional toolbar + table. */
export function ModulePageSkeleton({ tableRows = 6 }: { tableRows?: number }) {
  return (
    <div className="space-y-4" role="status" aria-live="polite" aria-label="Loading page">
      <div className="space-y-2">
        <Skeleton className="h-7 w-48 max-w-full" />
        <Skeleton className="h-3 w-72 max-w-full" />
      </div>
      <div className="flex flex-wrap gap-2">
        <Skeleton className="h-9 w-40" />
        <Skeleton className="h-9 w-32" />
      </div>
      <TableSkeleton rows={tableRows} columns={5} />
    </div>
  );
}

/** Auth bootstrap — content area while `/api/auth/me` resolves. */
export function AuthSessionSkeleton() {
  return (
    <div className="mx-auto w-full max-w-6xl space-y-4 py-2" role="status" aria-live="polite" aria-label="Verifying session">
      <Skeleton className="h-6 w-56" />
      <ModulePageSkeleton tableRows={4} />
    </div>
  );
}
