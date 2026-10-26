"use client";

import { PageLoading } from "@/components/ui/page-states";
import { useLeadPoolVariant } from "./lead-pool-variant";
import { SalesLeadPoolView } from "./sales-lead-pool-view";
import { ServiceLeadPoolView } from "./service-lead-pool-view";

export function PrivatePoolView() {
  const { ready, isService } = useLeadPoolVariant();
  if (!ready) return <PageLoading label="Loading private pool…" />;
  return isService ? <ServiceLeadPoolView mode="private" /> : <SalesLeadPoolView mode="private" />;
}
