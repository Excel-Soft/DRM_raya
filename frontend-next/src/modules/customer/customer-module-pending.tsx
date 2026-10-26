"use client";

import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";

/** Shown until Phase 14 sub-phase ports the legacy page with full parity. */
export function CustomerModulePending({
  title,
  legacyPath,
  subPhase,
}: {
  title: string;
  legacyPath: string;
  subPhase: string;
}) {
  return (
    <Card>
      <PageHeader
        eyebrow="Customer"
        title={title}
        description={`Next.js port in progress (${subPhase}). Legacy route ${legacyPath} remains available on the Vite app.`}
      />
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        Use the legacy app for full workflow until this submodule is marked verified in{" "}
        <code className="text-xs">docs/PHASE14_CUSTOMER_MIGRATION.md</code>.
      </p>
    </Card>
  );
}
