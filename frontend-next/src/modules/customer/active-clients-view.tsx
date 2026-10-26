"use client";

import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";

/**
 * Sidebar orphan: legacy `app-sidebar.tsx` links here but Vite has no App route
 * (see route-matrix SIDEBAR-ORPHAN-01). Do not invent business data.
 */
export function ActiveClientsView() {
  return (
    <Card>
      <PageHeader
        eyebrow="Customer"
        title="Active Clients"
        description="This menu item exists in the sidebar but has no legacy page implementation."
      />
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        Product decision pending: add a legacy route or remove the sidebar link. Next.js mirrors the
        documented orphan state — no API integration until a source page exists.
      </p>
    </Card>
  );
}
