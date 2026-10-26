import { type LabelHTMLAttributes } from "react";
import { cn } from "@/lib/utils/cn";
import { labelClasses } from "@/styles/tokens";

export function Label({ className, ...props }: LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn(labelClasses, className)} {...props} />;
}
