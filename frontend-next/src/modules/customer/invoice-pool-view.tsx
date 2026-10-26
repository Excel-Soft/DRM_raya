"use client";

import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { PageLoading, PageError } from "@/components/ui/page-states";
import { useApiResource } from "@/lib/hooks/use-api-resource";
import { HiOutlineEye } from "react-icons/hi2";
import { cn } from "@/lib/utils/cn";

type InvoiceRow = {
  id: string;
  invoiceNumber?: string;
  client?: string;
  serviceTitle?: string;
  grandTotal?: number;
  hodStatus?: string;
  accountStatus?: string;
  finalStatus?: string;
};

type InvoiceDetail = Record<string, unknown>;

function statusTone(status: string) {
  const s = status?.toUpperCase() || "";
  if (s === "APPROVED") return "success" as const;
  if (s === "REJECTED") return "warning" as const;
  return "neutral" as const;
}

function isHodApprovedStatus(s: string) {
  return s === "APPROVED";
}

function isPendingHodStatus(s: string) {
  return s === "PENDING_HOD" || s === "PENDING" || s === "PENDING_ACCOUNT";
}

export function InvoicePoolView() {
  const [activeTab, setActiveTab] = useState<"Approved" | "Pending" | "Rejected">("Approved");
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null);

  const { data, loading, error, forbidden, refetch } = useApiResource<InvoiceRow[]>(
    "/api/sales/invoice-pool",
  );
  const invoices = data ?? [];

  const detailPath = selectedInvoiceId ? `/api/sales/invoice-pool/${selectedInvoiceId}` : null;
  const {
    data: invoiceDetails,
    loading: detailsLoading,
    error: detailsError,
  } = useApiResource<InvoiceDetail>(detailPath);

  const filtered = useMemo(() => {
    return invoices.filter((i) => {
      const s = i.finalStatus?.toUpperCase() || "";
      if (activeTab === "Approved") return isHodApprovedStatus(s);
      if (activeTab === "Pending") return isPendingHodStatus(s);
      if (activeTab === "Rejected") return s === "REJECTED";
      return true;
    });
  }, [invoices, activeTab]);

  const counts = useMemo(
    () => ({
      Approved: invoices.filter((i) => isHodApprovedStatus(i.finalStatus?.toUpperCase() || "")).length,
      Pending: invoices.filter((i) => isPendingHodStatus(i.finalStatus?.toUpperCase() || "")).length,
      Rejected: invoices.filter((i) => i.finalStatus?.toUpperCase() === "REJECTED").length,
    }),
    [invoices],
  );

  return (
    <Card>
      <PageHeader eyebrow="Customer" title="Invoice Pool" description="Review invoice approval status by stage." />

      {forbidden ? (
        <PageError message="You do not have permission to view the invoice pool." />
      ) : loading ? (
        <PageLoading label="Loading invoices…" />
      ) : error ? (
        <PageError message={error} onRetry={refetch} />
      ) : (
        <>
          <div className="mb-4 flex flex-wrap gap-2 border-b border-zinc-200 pb-2 dark:border-zinc-800">
            {(["Approved", "Pending", "Rejected"] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className={cn(
                  "rounded-lg px-3 py-2 text-sm font-medium",
                  activeTab === tab
                    ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200"
                    : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800",
                )}
              >
                {tab}{" "}
                <Badge variant={tab === "Rejected" ? "warning" : tab === "Pending" ? "neutral" : "success"}>
                  {counts[tab]}
                </Badge>
              </button>
            ))}
          </div>

          <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="bg-zinc-50 dark:bg-zinc-900/80">
                <tr>
                  {[
                    "Invoice ID",
                    "Client",
                    "Service Title",
                    "Grand Total",
                    "HOD Status",
                    "Account Status",
                    "Final Status",
                    "Action",
                  ].map((h) => (
                    <th key={h} className="px-3 py-3 font-semibold text-zinc-700 dark:text-zinc-200">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-10 text-center text-zinc-500">
                      No {activeTab.toLowerCase()} invoices found.
                    </td>
                  </tr>
                ) : (
                  filtered.map((invoice) => (
                    <tr key={invoice.id} className="border-t border-zinc-100 dark:border-zinc-800">
                      <td className="px-3 py-2 font-medium">{invoice.invoiceNumber || invoice.id}</td>
                      <td className="px-3 py-2">{invoice.client || "N/A"}</td>
                      <td className="max-w-[200px] truncate px-3 py-2">{invoice.serviceTitle || "-"}</td>
                      <td className="px-3 py-2 font-semibold">
                        Rs. {Number(invoice.grandTotal || 0).toLocaleString()}
                      </td>
                      <td className="px-3 py-2">
                        <Badge variant={statusTone(invoice.hodStatus || "")}>{invoice.hodStatus}</Badge>
                      </td>
                      <td className="px-3 py-2">
                        <Badge variant={statusTone(invoice.accountStatus || "")}>{invoice.accountStatus}</Badge>
                      </td>
                      <td className="px-3 py-2">
                        <Badge variant="neutral">{invoice.finalStatus}</Badge>
                      </td>
                      <td className="px-3 py-2">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          aria-label="View invoice details"
                          onClick={() => setSelectedInvoiceId(invoice.id)}
                        >
                          <HiOutlineEye className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {selectedInvoiceId ? (
        <dialog
          open
          className="fixed inset-0 z-50 m-auto max-h-[90vh] w-[min(960px,95vw)] overflow-y-auto rounded-2xl border border-zinc-200 bg-white p-6 shadow-xl dark:border-zinc-700 dark:bg-zinc-900"
        >
          <div className="mb-4 flex items-center justify-between gap-4">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Invoice Details</h2>
            <Button type="button" variant="ghost" size="sm" onClick={() => setSelectedInvoiceId(null)}>
              Close
            </Button>
          </div>
          {detailsLoading ? (
            <PageLoading label="Loading invoice details…" />
          ) : detailsError ? (
            <PageError message={detailsError} />
          ) : invoiceDetails ? (
            <pre className="overflow-x-auto rounded-lg bg-zinc-50 p-4 text-xs text-zinc-800 dark:bg-zinc-950 dark:text-zinc-200">
              {JSON.stringify(invoiceDetails, null, 2)}
            </pre>
          ) : (
            <p className="text-sm text-zinc-500">No details returned.</p>
          )}
        </dialog>
      ) : null}
    </Card>
  );
}
