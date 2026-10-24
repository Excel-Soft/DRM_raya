import type { ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { drmFieldClass } from "@/modules/drm/drm-ui";

export { DrmSection, DrmFormActions, DrmInlineActions, drmFieldClass } from "@/modules/drm/drm-ui";

/** Legacy select triggers aligned with DRM form fields. */
export const eventsSelectTriggerClass = cn(drmFieldClass, "h-9 w-full text-sm");

export function EventsEditBanner({ label, onCancel }: { label: string; onCancel: () => void }) {
  return (
    <div className="mb-4 flex items-center justify-between rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-300">
      <span>{label}</span>
      <button type="button" onClick={onCancel} className="inline-flex items-center gap-1 text-amber-900 hover:underline dark:text-amber-200">
        <X className="h-3 w-3" aria-hidden />
        Cancel
      </button>
    </div>
  );
}

export function EventsFormGrid({ children, cols = 4 }: { children: ReactNode; cols?: 3 | 4 | 5 }) {
  const colClass =
    cols === 5
      ? "md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5"
      : cols === 3
        ? "md:grid-cols-2 lg:grid-cols-3"
        : "md:grid-cols-2 lg:grid-cols-4";
  return <div className={cn("grid grid-cols-1 gap-4", colClass)}>{children}</div>;
}

export function fmtEventDate(value: string | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value);
  if (isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" });
}
