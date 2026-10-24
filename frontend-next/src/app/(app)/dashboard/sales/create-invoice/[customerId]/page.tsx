import { Suspense } from "react";
import { CreateInvoiceView } from "@/modules/sales/create-invoice-view";
import { PageLoading } from "@/components/ui/page-states";

export const instant = false;

type PageProps = {
  params: Promise<{ customerId: string }>;
  searchParams: Promise<{ quotationId?: string }>;
};

async function CreateInvoiceRoute({ params, searchParams }: PageProps) {
  const { customerId } = await params;
  const { quotationId } = await searchParams;
  return <CreateInvoiceView customerId={customerId} quotationId={quotationId} />;
}

export default function CreateInvoicePage(props: PageProps) {
  return (
    <Suspense fallback={<PageLoading label="Loading invoice…" />}>
      <CreateInvoiceRoute {...props} />
    </Suspense>
  );
}
