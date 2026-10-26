import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils/cn";

export type BadgeVariant = "neutral" | "brand" | "success" | "warning";

const variants: Record<BadgeVariant, string> = {
  neutral: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200",
  brand: "bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200",
  success: "bg-green-50 text-green-800 dark:bg-green-950 dark:text-green-200",
  warning: "bg-amber-50 text-amber-900 dark:bg-amber-950 dark:text-amber-100",
};

export function Badge({
  variant = "neutral",
  className,
  ...props
}: HTMLAttributes<HTMLSpanElement> & { variant?: BadgeVariant }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
        variants[variant],
        className,
      )}
      {...props}
    />
  );
}
