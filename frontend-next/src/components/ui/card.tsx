import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900",
        className,
      )}
      {...props}
    />
  );
}

export function CardHeader({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn("mb-4 flex flex-wrap items-baseline justify-between gap-2", className)}>{children}</div>;
}
