import { Suspense } from "react";
import { CommissionVerificationView } from "@/modules/quick-links/commission-verification-view";
import { PageLoading } from "@/components/ui/page-states";

export const instant = false;

export default function SaleCommissionVerificationPage() {
  return (
    <Suspense fallback={<PageLoading label="Loading commission verification…" />}>
      <CommissionVerificationView />
    </Suspense>
  );
}
