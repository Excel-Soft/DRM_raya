import { Suspense } from "react";
import { TemporaryContactView } from "@/modules/customer/temporary-contact-view";
import { PageLoading } from "@/components/ui/page-states";

export default function TemporaryContactPage() {
  return (
    <Suspense fallback={<PageLoading label="Loading temporary contact…" />}>
      <TemporaryContactView />
    </Suspense>
  );
}
