import { Suspense } from "react";
import { OvertimeSubmissionView } from "@/modules/attendance/overtime-submission-view";
import { PageLoading } from "@/components/ui/page-states";

export const instant = false;

export default function OvertimePage() {
  return (
    <Suspense fallback={<PageLoading label="Loading overtime…" />}>
      <OvertimeSubmissionView />
    </Suspense>
  );
}
