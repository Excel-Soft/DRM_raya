import { Suspense } from "react";
import { PublicPoolFollowupView } from "@/modules/customer/public-pool-followup-view";
import { PageLoading } from "@/components/ui/page-states";

export const instant = false;

export default function PublicPoolFollowupPage() {
  return (
    <Suspense fallback={<PageLoading label="Loading follow-up pool…" />}>
      <PublicPoolFollowupView />
    </Suspense>
  );
}
