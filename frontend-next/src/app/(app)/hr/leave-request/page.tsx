import { Suspense } from "react";
import { LeaveRequestView } from "@/modules/attendance/leave-request-view";
import { PageLoading } from "@/components/ui/page-states";

export const instant = false;

export default function LeaveRequestPage() {
  return (
    <Suspense fallback={<PageLoading label="Loading leave requests…" />}>
      <LeaveRequestView />
    </Suspense>
  );
}
