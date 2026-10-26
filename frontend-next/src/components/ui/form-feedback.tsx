import type { ReactNode } from "react";
import { Button, type ButtonProps } from "./button";
import { validationErrorClasses } from "@/styles/tokens";
import { cn } from "@/lib/utils/cn";

/** Inline validation message for forms (pair with Field or aria-describedby). */
export function FormError({ id, message, className }: { id?: string; message: string; className?: string }) {
  return (
    <p id={id} role="alert" className={cn(validationErrorClasses, className)}>
      {message}
    </p>
  );
}

/** Submit control with pending/disabled semantics for destructive-safe flows. */
export function SubmitButton({
  pending,
  pendingLabel = "Saving…",
  children,
  ...props
}: ButtonProps & { pending?: boolean; pendingLabel?: string; children: ReactNode }) {
  return (
    <Button type="submit" disabled={pending || props.disabled} aria-busy={pending} {...props}>
      {pending ? pendingLabel : children}
    </Button>
  );
}

/** Non-blocking status after submit (success/failure banners). */
export function FormBanner({
  variant,
  children,
}: {
  variant: "success" | "error";
  children: ReactNode;
}) {
  const styles =
    variant === "success"
      ? "border-green-200 bg-green-50 text-green-800 dark:border-green-900 dark:bg-green-950 dark:text-green-100"
      : "border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-100";
  return (
    <div role={variant === "error" ? "alert" : "status"} className={cn("rounded-lg border px-3 py-2 text-sm", styles)}>
      {children}
    </div>
  );
}
