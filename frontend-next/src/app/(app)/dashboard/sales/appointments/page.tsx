import { Suspense } from "react";
import { AppointmentsView } from "@/modules/quick-links/appointments-view";
import { PageLoading } from "@/components/ui/page-states";

export const instant = false;

export default function SalesAppointmentsPage() {
  return (
    <Suspense fallback={<PageLoading label="Loading appointments…" />}>
      <AppointmentsView />
    </Suspense>
  );
}
