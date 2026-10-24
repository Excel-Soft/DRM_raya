import { forwardRef, type TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/utils/cn";
import { focusRing, inputClasses } from "@/styles/tokens";

export type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  invalid?: boolean;
};

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { className, invalid, rows = 3, ...props },
  ref,
) {
  return (
    <textarea
      ref={ref}
      rows={rows}
      aria-invalid={invalid ?? undefined}
      className={cn(
        inputClasses,
        "min-h-[4.5rem] py-2",
        focusRing,
        invalid && "border-red-400 dark:border-red-700",
        className,
      )}
      {...props}
    />
  );
});
