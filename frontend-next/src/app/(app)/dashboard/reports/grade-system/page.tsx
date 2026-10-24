import { Suspense } from "react";
import { GradeSystemView } from "@/modules/quick-links/grade-system-view";
import { PageLoading } from "@/components/ui/page-states";

export const instant = false;

export default function ReportsGradeSystemPage() {
  return (
    <Suspense fallback={<PageLoading label="Loading grade system…" />}>
      <GradeSystemView />
    </Suspense>
  );
}
