import { cn } from "@/lib/utils/cn";

export function Separator({ className }: { className?: string }) {
  return <hr className={cn("border-zinc-200 dark:border-zinc-800", className)} aria-hidden="true" />;
}
