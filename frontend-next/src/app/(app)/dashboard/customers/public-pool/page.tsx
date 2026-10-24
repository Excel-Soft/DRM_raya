import { Suspense } from "react";
import { PublicPoolPickupView } from "@/modules/customer/public-pool-pickup-view";
import { PageLoading } from "@/components/ui/page-states";

export const instant = false;

export default function PublicPoolPage() {
  return (
    <Suspense fallback={<PageLoading label="Loading public pool…" />}>
      <PublicPoolPickupView />
    </Suspense>
  );
}
