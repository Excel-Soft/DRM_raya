import { Suspense } from "react";
import { ServicePoolView } from "@/modules/customer/service-pool-view";
import { PageLoading } from "@/components/ui/page-states";

export const instant = false;

export default function ServicePoolPage() {
  return (
    <Suspense fallback={<PageLoading label="Loading service pool…" />}>
      <ServicePoolView />
    </Suspense>
  );
}
