"use client";

import { PageLoading } from "@/components/ui/page-states";
import { useLeadPoolVariant } from "@/modules/customer/lead-pool-variant";
import { SalesLeadPoolView } from "@/modules/customer/sales-lead-pool-view";
import { ServiceLeadPoolView } from "@/modules/customer/service-lead-pool-view";

const LEAD_POOL_META = {
  eyebrow: "Lead",
  title: "Lead Pool",
  description: "Private leads hub — status chips, tracing, and follow-up (same workflow as legacy Lead Pool).",
} as const;

export function LeadLeadPoolView() {
  const { ready, isService } = useLeadPoolVariant();
  if (!ready) return <PageLoading label="Loading lead pool…" />;
  return isService ? (
    <ServiceLeadPoolView mode="private" pageMeta={LEAD_POOL_META} />
  ) : (
    <SalesLeadPoolView mode="private" pageMeta={LEAD_POOL_META} />
  );
}
