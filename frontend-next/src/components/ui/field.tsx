import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";
import { Label } from "./label";
import { validationErrorClasses } from "@/styles/tokens";

export function Field({
  id,
  label,
  error,
  hint,
  children,
  className,
}: {
  id: string;
  label: string;
  error?: string;
  hint?: string;
  children: ReactNode;
  className?: string;
}) {
  const errorId = error ? `${id}-error` : undefined;
  const hintId = hint ? `${id}-hint` : undefined;
  return (
    <div className={cn("space-y-1", className)}>
      <Label htmlFor={id}>{label}</Label>
      <div aria-describedby={[hintId, errorId].filter(Boolean).join(" ") || undefined}>{children}</div>
      {hint ? (
        <p id={hintId} className="text-xs text-zinc-500 dark:text-zinc-400">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} role="alert" className={validationErrorClasses}>
          {error}
        </p>
      ) : null}
    </div>
  );
}
