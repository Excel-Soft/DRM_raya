import type { ReactNode } from "react";
import { PageHeader } from "@/components/ui/page-header";

export { DrmSection, drmFieldClass } from "@/modules/drm/drm-ui";

export function NoticeShell({
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
    <div className="mx-auto w-full max-w-[1600px] space-y-5 pb-8">
      <PageHeader eyebrow="Notice" title={title} description={description} actions={actions} />
      <div className="space-y-5">{children}</div>
    </div>
  );
}

export function fmtNoticeDate(value?: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}
