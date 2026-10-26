import { Suspense } from "react";
import { QuotationView } from "@/modules/sales/quotation-view";
import { PageLoading } from "@/components/ui/page-states";

/** Form uses runtime searchParams — opt out of instant-nav validation (avoids dev “dropped from rendering”). */
export const instant = false;

type PageProps = {
  searchParams: Promise<{ leadId?: string; id?: string }>;
};

async function QuotationRoute({ searchParams }: PageProps) {
  const { leadId, id } = await searchParams;
  return <QuotationView leadId={leadId} quotationId={id} />;
}

export default function QuotationPage(props: PageProps) {
  return (
    <Suspense fallback={<PageLoading label="Loading quotation…" />}>
      <QuotationRoute {...props} />
    </Suspense>
  );
}
