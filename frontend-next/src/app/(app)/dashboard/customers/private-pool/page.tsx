import { Suspense } from "react";
import { PrivatePoolView } from "@/modules/customer/private-pool-view";
import { PageLoading } from "@/components/ui/page-states";

export const instant = false;

export default function PrivatePoolPage() {
  return (
    <Suspense fallback={<PageLoading label="Loading private pool…" />}>
      <PrivatePoolView />
    </Suspense>
  );
}
