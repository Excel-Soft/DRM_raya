import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

/** Shared layout tokens for Users module (matches DRM / Customer Next theme). */
export { drmFieldClass, drmPanelClass, DrmSection, DrmFormActions } from "@/modules/drm/drm-ui";

/** In-dialog form blocks (Edit user, etc.). */
export function UsersFormSection({
  title,
  description,
  children,
  className,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800", className)}>
      <div className="border-b border-zinc-200 px-4 py-2.5 dark:border-zinc-800">
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{title}</h3>
        {description ? (
          <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">{description}</p>
        ) : null}
      </div>
      <div className="space-y-4 p-4">{children}</div>
    </div>
  );
}

export const usersDialogShellClass =
  "flex max-h-[90vh] flex-col gap-0 overflow-hidden border-zinc-200 bg-white p-0 dark:border-zinc-800 dark:bg-zinc-900 sm:rounded-2xl";

export const usersDialogHeaderClass =
  "shrink-0 space-y-1 border-b border-zinc-200 px-6 py-4 text-left dark:border-zinc-800";

export const usersDialogBodyClass = "min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 py-4";

export const usersDialogFooterClass =
  "shrink-0 gap-2 border-t border-zinc-200 px-6 py-4 dark:border-zinc-800 sm:flex-row sm:justify-end";

/** Reserve space so in-modal absolute dropdowns do not cover fields below. */
export const usersDropdownReserveClass = "mb-56";
