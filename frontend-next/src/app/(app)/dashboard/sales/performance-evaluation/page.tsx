import { Suspense } from "react";
import { PerformanceEvaluationView } from "@/modules/quick-links/performance-evaluation-view";
import { PageLoading } from "@/components/ui/page-states";

export const instant = false;

export default function SalesPerformanceEvaluationPage() {
  return (
    <Suspense fallback={<PageLoading label="Loading performance evaluation…" />}>
      <PerformanceEvaluationView />
    </Suspense>
  );
}
