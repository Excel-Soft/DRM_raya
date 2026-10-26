import { Suspense } from "react";
import { CustomerAttributePageShell } from "@/modules/customer/customer-attribute-view";
import { PageLoading } from "@/components/ui/page-states";

/** Dynamic `params` — opt out of instant-nav validation (dev “dropped from rendering”). */
export const instant = false;

type PageProps = { params: Promise<{ id: string }> };

async function CustomerAttributeRoute({ params }: PageProps) {
  const { id } = await params;
  return <CustomerAttributePageShell customerId={id} />;
}

export default function CustomerAttributePage(props: PageProps) {
  return (
    <Suspense fallback={<PageLoading label="Loading customer…" />}>
      <CustomerAttributeRoute {...props} />
    </Suspense>
  );
}
