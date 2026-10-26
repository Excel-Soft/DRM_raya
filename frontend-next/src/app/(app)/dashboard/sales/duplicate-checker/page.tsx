import { Suspense } from "react";
import { DuplicateCheckerView } from "@/modules/customer/duplicate-checker-view";
import { PageLoading } from "@/components/ui/page-states";

export default function DuplicateCheckerPage() {
  return (
    <Suspense fallback={<PageLoading label="Loading duplicate checker…" />}>
      <DuplicateCheckerView />
    </Suspense>
  );
}
