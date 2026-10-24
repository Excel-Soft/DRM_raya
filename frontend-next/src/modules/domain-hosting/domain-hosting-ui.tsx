import type { ReactNode } from "react";
import { Search } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils/cn";
import { drmFieldClass } from "@/modules/drm/drm-ui";

export { DrmSection, DrmFormActions, DrmInlineActions, drmFieldClass } from "@/modules/drm/drm-ui";

export const dhSelectTriggerClass = cn(drmFieldClass, "h-9 w-full text-sm");

export function DomainHostingShell({
  title,
  description,
  actions,
  children,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="mx-auto w-full max-w-[1600px] space-y-5">
      <PageHeader eyebrow="Domain hosting" title={title} description={description} actions={actions} />
      <div className="space-y-5">{children}</div>
    </div>
  );
}

/** Search + filters row above tables (keeps section headers clean). */
export function DhSectionToolbar({ leading, trailing }: { leading?: ReactNode; trailing?: ReactNode }) {
  return (
    <div className="mb-4 flex flex-col gap-3 border-b border-zinc-100 pb-4 dark:border-zinc-800/80 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">{leading}</div>
      <div className="flex flex-wrap items-center gap-2">{trailing}</div>
    </div>
  );
}

export function DhSearchInput({
  id,
  value,
  onChange,
  placeholder = "Search…",
  className,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}) {
  return (
    <div className={cn("relative w-full min-w-[200px] max-w-sm", className)}>
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" aria-hidden />
      <Input
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={cn(drmFieldClass, "h-9 pl-9 text-sm")}
      />
    </div>
  );
}

export function DhResourceList({
  items,
  emptyLabel,
  renderActions,
}: {
  items: { id: string; title: string; subtitle?: string }[];
  emptyLabel: string;
  renderActions: (id: string) => ReactNode;
}) {
  if (items.length === 0) {
    return <p className="py-6 text-center text-sm text-zinc-500 dark:text-zinc-400">{emptyLabel}</p>;
  }
  return (
    <ul className="divide-y divide-zinc-100 rounded-lg border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
      {items.map((item) => (
        <li key={item.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">{item.title}</p>
            {item.subtitle ? <p className="truncate text-xs text-emerald-700 dark:text-emerald-400">{item.subtitle}</p> : null}
          </div>
          {renderActions(item.id)}
        </li>
      ))}
    </ul>
  );
}

export const dhDialogShellClass =
  "gap-0 overflow-hidden border-zinc-200 bg-white p-0 dark:border-zinc-800 dark:bg-zinc-900 sm:rounded-2xl";

export function DhFormGrid({ children, cols = 3 }: { children: ReactNode; cols?: 2 | 3 | 4 }) {
  const colClass =
    cols === 2 ? "sm:grid-cols-2" : cols === 4 ? "md:grid-cols-2 lg:grid-cols-4" : "md:grid-cols-2 lg:grid-cols-3";
  return <div className={cn("grid grid-cols-1 gap-4", colClass)}>{children}</div>;
}
