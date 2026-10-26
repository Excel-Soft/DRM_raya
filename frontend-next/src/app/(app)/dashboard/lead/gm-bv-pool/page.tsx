import { Suspense } from "react";
import { LeadGmBvPoolView } from "@/modules/lead/gm-bv-pool-view";
import { PageLoading } from "@/components/ui/page-states";

export const instant = false;

export default function LeadGmBvPoolPage() {
  return (
    <Suspense fallback={<PageLoading label="Loading GM BV pool…" />}>
      <LeadGmBvPoolView />
    </Suspense>
  );
}
