import { Suspense } from "react";
import { MainDashboardView } from "@/modules/dashboard/main-dashboard-view";
import { PageLoading } from "@/components/ui/page-states";

export const instant = false;

export default function DashboardHomePage() {
  return (
    <Suspense fallback={<PageLoading label="Loading dashboard…" />}>
      <MainDashboardView />
    </Suspense>
  );
}
