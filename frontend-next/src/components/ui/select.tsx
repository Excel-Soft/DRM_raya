import { forwardRef, type SelectHTMLAttributes } from "react";
import { cn } from "@/lib/utils/cn";
import { focusRing, inputClasses } from "@/styles/tokens";

export type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
  invalid?: boolean;
};

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { className, invalid, children, ...props },
  ref,
) {
  return (
    <select
      ref={ref}
      aria-invalid={invalid ?? undefined}
      className={cn(inputClasses, focusRing, invalid && "border-red-400 dark:border-red-700", className)}
      {...props}
    >
      {children}
    </select>
  );
});
