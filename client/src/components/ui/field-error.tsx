import { AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * FieldError — standard inline validation message (Stage 10, section A).
 *
 * Renders nothing when `message` is falsy so it can be dropped under any input
 * unconditionally. Keeps the validation copy consistent across forms instead of
 * ad-hoc `alert()` / bespoke markup.
 */
export function FieldError({ message, className }: { message?: string | null; className?: string }) {
  if (!message) return null;
  return (
    <p className={cn("mt-1 flex items-center gap-1 text-[12px] text-rose-600 dark:text-rose-400", className)} role="alert">
      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
      <span>{message}</span>
    </p>
  );
}

/**
 * Canonical, reusable validation copy so the same situation reads the same way
 * everywhere. Use with toast() or FieldError.
 */
export const validationMessages = {
  required: (field = "This field") => `${field} is required.`,
  invalidDate: "Please enter a valid date.",
  invalidAmount: "Please enter a valid amount greater than 0.",
  invalidUrl: "Please enter a valid URL (including https://).",
  duplicate: (what = "record") => `This ${what} already exists.`,
  unauthorized: "You don't have permission to perform this action.",
  wrongStage: "This action isn't allowed at the current workflow stage.",
  missingReason: "A reason / remark is required for this action.",
  upload: "Please attach a valid file before continuing.",
} as const;

export default FieldError;
