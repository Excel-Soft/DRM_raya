import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  className,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("mb-4", className)}>
      {eyebrow ? (
        <p className="text-[11px] font-bold uppercase tracking-wide text-emerald-700 dark:text-emerald-400">
          {eyebrow}
        </p>
      ) : null}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">{title}</h1>
        {actions}
      </div>
      {description ? <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{description}</p> : null}
    </header>
  );
}
