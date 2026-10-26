import type { ReactNode } from "react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils/cn";
import { inputClasses } from "@/styles/tokens";

/** Native inputs in ported DRM forms — matches Customer / Audit fields. */
export const drmFieldClass = inputClasses;

/** Shared panel styling for DRM Setting submodules (matches Customer / Audit modules). */
export const drmPanelClass =
  "rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900";

export const drmTreePanelClass = cn(
  drmPanelClass,
  "divide-y divide-zinc-100 p-2 dark:divide-zinc-800",
);

export function DrmCategoryNav({
  categories,
  selected,
  onSelect,
  label = "Categories",
}: {
  categories: readonly string[];
  selected: string;
  onSelect: (cat: string) => void;
  label?: string;
}) {
  return (
    <nav
      className={cn(drmPanelClass, "flex shrink-0 flex-col p-2 lg:w-56")}
      aria-label={label}
    >
      <p className="mb-2 px-2 text-[11px] font-bold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
        {label}
      </p>
      <ul className="max-h-[min(70vh,32rem)] space-y-0.5 overflow-y-auto">
        {categories.map((cat) => {
          const active = cat === selected;
          return (
            <li key={cat}>
              <button
                type="button"
                onClick={() => onSelect(cat)}
                className={cn(
                  "w-full rounded-lg px-2.5 py-2 text-left text-sm font-medium transition-colors",
                  active
                    ? "bg-emerald-600 text-white shadow-sm"
                    : "text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800",
                )}
              >
                {cat}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

const modalSizeClass = {
  md: "max-w-md",
  lg: "max-w-lg",
  xl: "max-w-3xl",
} as const;

export function DrmFormModal({
  open,
  title,
  children,
  onClose,
  footer,
  size = "md",
}: {
  open: boolean;
  title: string;
  children: ReactNode;
  onClose: () => void;
  footer?: ReactNode;
  size?: keyof typeof modalSizeClass;
}) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[1px]" aria-hidden />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="drm-form-modal-title"
        className={cn(
          "relative z-10 w-full rounded-2xl border border-zinc-200 bg-white p-5 shadow-xl dark:border-zinc-700 dark:bg-zinc-900",
          modalSizeClass[size],
        )}
      >
        <h2 id="drm-form-modal-title" className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
          {title}
        </h2>
        <div className="mt-4 space-y-4">{children}</div>
        {footer ? <div className="mt-5 flex flex-wrap justify-end gap-2">{footer}</div> : null}
      </div>
    </div>
  );
}

export function DrmSection({
  title,
  description,
  actions,
  children,
  className,
  bodyClassName,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  /** Pass `!p-0` for full-bleed tables (toolbar + grid flush to card edges). */
  bodyClassName?: string;
}) {
  return (
    <Card className={cn("!p-0", className)}>
      <div className="flex flex-wrap items-start justify-between gap-2 border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
        <div>
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{title}</h3>
          {description ? (
            <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">{description}</p>
          ) : null}
        </div>
        {actions}
      </div>
      <div className={cn("p-4", bodyClassName)}>{children}</div>
    </Card>
  );
}

/** Right-aligned primary/secondary actions under a form (no full-width slab buttons). */
export function DrmFormActions({ children }: { children: ReactNode }) {
  return (
    <div className="mt-4 flex flex-wrap items-center justify-end gap-2 border-t border-zinc-200 pt-4 dark:border-zinc-800">
      {children}
    </div>
  );
}

export function DrmInlineActions({
  items,
}: {
  items: { id: string; label: string; onClick: () => void; active?: boolean }[];
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={item.onClick}
          className={cn(
            "rounded-lg px-2.5 py-1.5 font-medium transition-colors",
            item.active
              ? "bg-emerald-600 text-white"
              : "text-emerald-700 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-950/40",
          )}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
