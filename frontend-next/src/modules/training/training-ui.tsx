import type { ReactNode } from "react";
import { PageHeader } from "@/components/ui/page-header";

export { DrmSection, drmFieldClass } from "@/modules/drm/drm-ui";

export function TrainingShell({
  title = "Training",
  description,
  actions,
  children,
}: {
  title?: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="mx-auto w-full max-w-[1600px] space-y-5">
      <PageHeader eyebrow="Learning" title={title} description={description} actions={actions} />
      {children}
    </div>
  );
}

export function fmtTrainingDate(value?: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}
