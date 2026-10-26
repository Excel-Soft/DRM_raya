"use client";

import type { ReactNode } from "react";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";

/** Wraps ported DRM pages with the same chrome as Customer / Audit modules. */
export function DrmPageShell({
  title,
  description,
  actions,
  children,
  unboxed,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  /** Skip inner Card when the child already provides layout (e.g. Attributes). */
  unboxed?: boolean;
}) {
  return (
    <div className="space-y-4">
      <PageHeader eyebrow="DRM Setting" title={title} description={description} actions={actions} />
      {unboxed ? children : <Card>{children}</Card>}
    </div>
  );
}
