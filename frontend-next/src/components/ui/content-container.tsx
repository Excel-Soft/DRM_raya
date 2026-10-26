import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils/cn";

export function ContentContainer({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("mx-auto w-full max-w-6xl px-4 py-6 sm:px-6", className)} {...props} />;
}
