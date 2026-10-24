import { Suspense } from "react";
import { LoanRequestView } from "@/modules/attendance/loan-request-view";
import { PageLoading } from "@/components/ui/page-states";

export const instant = false;

export default function LoanAdvancePage() {
  return (
    <Suspense fallback={<PageLoading label="Loading loan / advance salary…" />}>
      <LoanRequestView />
    </Suspense>
  );
}
