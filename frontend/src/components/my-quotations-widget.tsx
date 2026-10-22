import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

type QuotationRow = {
  rowNumber: number;
  id: string;
  company: string;
  customerId: string | null;
  serviceDetails: string;
  date: string;
  statusComment: string;
  isConfirmed: boolean;
  isRejected: boolean;
};

type SummaryResponse = {
  approved: { count: number; items: QuotationRow[] };
  pendingRejected: { count: number; items: QuotationRow[] };
  convertedInvoices: { count: number; items: QuotationRow[] };
};

function fmtDate(value: string) {
  const d = new Date(value);
  if (isNaN(d.getTime())) return "-";
  return d.toLocaleDateString();
}

// Backed by GET /api/sales/quotations/my-summary — the creator's own
// quotations, bucketed into Approved (confirmed via the "Done" action
// below) / Pending & Rejected (not yet confirmed — there's no separate
// reject mechanism for quotations today, so this bucket is really just
// "pending") / Converted Invoices (always empty for now — no
// quotation-to-invoice link exists anywhere in this codebase yet).
export function MyQuotationsWidget() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<"approved" | "pendingRejected" | "convertedInvoices">("pendingRejected");

  const { data, isLoading } = useQuery<SummaryResponse>({
    queryKey: ["/api/sales/quotations/my-summary"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/sales/quotations/my-summary");
      return res.json();
    },
  });

  const confirmMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("POST", `/api/quotations/${id}/confirm`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.message || "Failed to confirm quotation");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Quotation confirmed — now visible to your HOD" });
      queryClient.invalidateQueries({ queryKey: ["/api/sales/quotations/my-summary"] });
    },
    onError: (err: any) => {
      toast({ title: "Failed to confirm", description: err.message, variant: "destructive" });
    },
  });

  const resubmitMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("POST", `/api/quotations/${id}/resubmit`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.message || "Failed to resubmit quotation");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Quotation resubmitted — back with your HOD" });
      queryClient.invalidateQueries({ queryKey: ["/api/sales/quotations/my-summary"] });
    },
    onError: (err: any) => {
      toast({ title: "Failed to resubmit", description: err.message, variant: "destructive" });
    },
  });

  const tabs = [
    { key: "approved" as const, label: "Approved Quotations", count: data?.approved.count ?? 0, dot: "bg-emerald-500" },
    { key: "pendingRejected" as const, label: "Pending & Rejected Quotations", count: data?.pendingRejected.count ?? 0, dot: "bg-amber-500" },
    { key: "convertedInvoices" as const, label: "Converted Invoices", count: data?.convertedInvoices.count ?? 0, dot: "bg-blue-500" },
  ];

  const activeItems = data?.[activeTab]?.items ?? [];
  const activeLabel = tabs.find((t) => t.key === activeTab)?.label ?? "";

  return (
    <div className="bg-card shadow-sm border border-border rounded-2xl mt-8 overflow-hidden">
      <div className="px-6 py-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-border">
        <div className="flex flex-wrap gap-5">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 text-sm font-semibold pb-1 border-b-2 transition-colors ${
                activeTab === tab.key
                  ? "text-foreground border-emerald-500"
                  : "text-muted-foreground border-transparent hover:text-foreground"
              }`}
            >
              {tab.label}
              <span className={`inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-[11px] font-bold text-white ${tab.dot}`}>
                {tab.count}
              </span>
            </button>
          ))}
        </div>
        <div className="flex gap-2 shrink-0">
          <button
            onClick={() => setLocation("/customers/private-pool")}
            className="bg-emerald-700 text-white text-sm px-4 h-9 rounded-lg font-medium hover:bg-emerald-800 transition-all shadow-sm"
          >
            Add Follow-up
          </button>
          <button
            onClick={() => setLocation("/sales/quotation")}
            className="bg-emerald-500 text-white text-sm px-4 h-9 rounded-lg font-medium hover:bg-emerald-600 transition-all shadow-sm"
          >
            Add Quotation
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm whitespace-nowrap">
          <thead>
            <tr className="bg-muted/50 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <th className="px-6 py-3">#</th>
              <th className="px-6 py-3">Company</th>
              <th className="px-6 py-3">Service Details</th>
              <th className="px-6 py-3">Date</th>
              <th className="px-6 py-3">Status / Comment</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={5} className="text-center py-8 text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin inline" />
                </td>
              </tr>
            ) : activeItems.length === 0 ? (
              <tr>
                <td colSpan={5} className="text-center py-8 text-muted-foreground">
                  No {activeLabel} Found
                </td>
              </tr>
            ) : (
              activeItems.map((item) => (
                <tr key={item.id} className="border-t border-border hover:bg-muted/40">
                  <td className="px-6 py-3 text-muted-foreground">{item.rowNumber}</td>
                  <td className="px-6 py-3 font-medium text-foreground">{item.company}</td>
                  <td className="px-6 py-3 text-muted-foreground">{item.serviceDetails}</td>
                  <td className="px-6 py-3 text-muted-foreground">{fmtDate(item.date)}</td>
                  <td className="px-6 py-3">
                    {activeTab === "pendingRejected" && !item.isConfirmed ? (
                      <button
                        onClick={() => confirmMutation.mutate(item.id)}
                        disabled={confirmMutation.isPending}
                        className="bg-emerald-600 text-white text-xs px-3 py-1.5 rounded-md font-medium hover:bg-emerald-700 transition-all disabled:opacity-50"
                      >
                        Done
                      </button>
                    ) : activeTab === "pendingRejected" && item.isRejected ? (
                      <div className="flex items-center gap-2">
                        <span className="text-rose-600 dark:text-rose-400">{item.statusComment}</span>
                        <button
                          onClick={() => resubmitMutation.mutate(item.id)}
                          disabled={resubmitMutation.isPending}
                          className="bg-amber-600 text-white text-xs px-3 py-1.5 rounded-md font-medium hover:bg-amber-700 transition-all disabled:opacity-50 shrink-0"
                        >
                          Resubmit
                        </button>
                      </div>
                    ) : activeTab === "approved" ? (
                      <div className="flex items-center gap-2">
                        <span className="text-emerald-600 dark:text-emerald-400">{item.statusComment}</span>
                        {item.customerId && (
                          <button
                            onClick={() => setLocation(`/sales/create-invoice/${item.customerId}?quotationId=${item.id}`)}
                            className="bg-indigo-600 text-white text-xs px-3 py-1.5 rounded-md font-medium hover:bg-indigo-700 transition-all shrink-0"
                          >
                            Create Invoice
                          </button>
                        )}
                      </div>
                    ) : (
                      <span className="text-muted-foreground">{item.statusComment}</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
