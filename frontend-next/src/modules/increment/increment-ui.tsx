import type { ReactNode } from "react";
import { PageHeader } from "@/components/ui/page-header";

export { DrmSection, DrmFormModal } from "@/modules/drm/drm-ui";

export function IncrementShell({
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
      <PageHeader eyebrow="Increment" title={title} description={description} actions={actions} />
      {children}
    </div>
  );
}
