import { SaleServicePerformanceSection } from "@/components/sale-service-performance-section";

/**
 * Rebuild of a second, simpler legacy PHP page (the user supplied the old
 * PHP source as a spec) — same "Overall Performance report" section as
 * sale-service-report.tsx's first section, but as its own standalone page
 * (no Daily Activities / Team Work Performance sections), matching what
 * "Update Sale And Service Report" actually was in the legacy app.
 */
export default function UpdateSaleServiceReport() {
  return (
    <div className="p-6 space-y-6">
      <h4 className="mb-0 font-size-18 text-xl font-bold text-[#495057] dark:text-zinc-300">Sale And Service Report</h4>
      <SaleServicePerformanceSection cardTitle="Overall Performance Report" />
    </div>
  );
}
