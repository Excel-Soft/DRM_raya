import { Suspense } from "react";
import { AttendanceManagementView } from "@/modules/attendance/attendance-management-view";
import { PageLoading } from "@/components/ui/page-states";

export const instant = false;

export default function AttendancePage() {
  return (
    <Suspense fallback={<PageLoading label="Loading attendance…" />}>
      <AttendanceManagementView />
    </Suspense>
  );
}
