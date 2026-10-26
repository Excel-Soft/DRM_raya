import type { ReactNode } from "react";
import { PageHeader } from "@/components/ui/page-header";

export { DrmSection, DrmFormActions, DrmInlineActions, drmFieldClass } from "@/modules/drm/drm-ui";

export function ReportsShell({
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
    <div className="space-y-4">
      <PageHeader eyebrow="Reports" title={title} description={description} actions={actions} />
      {children}
    </div>
  );
}
