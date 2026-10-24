"use client";

import { PageLoading } from "@/components/ui/page-states";
import { useLeadPoolVariant } from "./lead-pool-variant";
import { SalesLeadPoolView } from "./sales-lead-pool-view";
import { ServiceLeadPoolView } from "./service-lead-pool-view";

/** Sidebar: Public Pool (Pick up) */
export function PublicPoolPickupView() {
  const { ready, isService } = useLeadPoolVariant();
  if (!ready) return <PageLoading label="Loading public pool…" />;
  return isService ? <ServiceLeadPoolView mode="public" /> : <SalesLeadPoolView mode="public" />;
}
