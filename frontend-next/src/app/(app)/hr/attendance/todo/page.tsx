import { Suspense } from "react";
import { AttendanceTodoView } from "@/modules/attendance/attendance-todo-view";
import { PageLoading } from "@/components/ui/page-states";

export const instant = false;

export default function AttendanceTodoPage() {
  return (
    <Suspense fallback={<PageLoading label="Loading to do list…" />}>
      <AttendanceTodoView />
    </Suspense>
  );
}
