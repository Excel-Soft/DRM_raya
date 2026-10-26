import { Suspense } from "react";
import { TaskSystemPage } from "@/modules/pms/task-system-view";

export const instant = false;

export default function PmsTasksRoutePage() {
  return (
    <Suspense>
      <TaskSystemPage />
    </Suspense>
  );
}
