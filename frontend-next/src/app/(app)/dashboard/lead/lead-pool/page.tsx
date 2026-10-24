import { Suspense } from "react";
import { LeadLeadPoolView } from "@/modules/lead/lead-pool-view";
import { PageLoading } from "@/components/ui/page-states";

export const instant = false;

export default function LeadPoolPage() {
  return (
    <Suspense fallback={<PageLoading label="Loading lead pool…" />}>
      <LeadLeadPoolView />
    </Suspense>
  );
}
