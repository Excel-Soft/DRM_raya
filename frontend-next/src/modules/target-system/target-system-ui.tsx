import type { ReactNode } from "react";
import { PageHeader } from "@/components/ui/page-header";
import { cn } from "@/lib/utils/cn";
import { drmFieldClass, DrmInlineActions } from "@/modules/drm/drm-ui";

export {
  DrmSection,
  DrmFormActions,
  DrmInlineActions,
  drmFieldClass,
} from "@/modules/drm/drm-ui";

export const tsSelectTriggerClass = cn(drmFieldClass, "h-9 w-full text-sm");

export function TargetSystemShell({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-4">
      <PageHeader eyebrow="Target system" title={title} description={description} />
      {children}
    </div>
  );
}

export function TsFormGrid({ children, cols = 4 }: { children: ReactNode; cols?: 3 | 4 | 5 }) {
  const colClass =
    cols === 5
      ? "md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5"
      : cols === 3
        ? "md:grid-cols-2 lg:grid-cols-3"
        : "md:grid-cols-2 lg:grid-cols-4";
  return <div className={cn("grid grid-cols-1 gap-4", colClass)}>{children}</div>;
}

/** Current quarter vs all history — matches Events pill nav. */
export function TargetQuarterToggle({
  showAll,
  onChange,
}: {
  showAll: boolean;
  onChange: (showAll: boolean) => void;
}) {
  return (
    <DrmInlineActions
      items={[
        {
          id: "current",
          label: "Current quarter",
          active: !showAll,
          onClick: () => onChange(false),
        },
        {
          id: "all",
          label: "All history",
          active: showAll,
          onClick: () => onChange(true),
        },
      ]}
    />
  );
}

export const tsDialogShellClass =
  "gap-0 overflow-hidden border-zinc-200 bg-white p-0 dark:border-zinc-800 dark:bg-zinc-900 sm:rounded-2xl";
