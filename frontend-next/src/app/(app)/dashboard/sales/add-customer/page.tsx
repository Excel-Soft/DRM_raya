import { Suspense } from "react";
import { AddCustomerView } from "@/modules/customer/add-customer-view";
import { PageLoading } from "@/components/ui/page-states";

export default function AddCustomerPage() {
  return (
    <Suspense fallback={<PageLoading label="Loading add customer…" />}>
      <AddCustomerView />
    </Suspense>
  );
}
