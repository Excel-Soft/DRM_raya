"use client";

import { useState, useMemo, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/legacy/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/legacy/select";
import { useToast } from "@/lib/hooks/use-legacy-toast";
import { InvoiceReceipt } from "@/modules/sales/invoice-receipt";
import { gmEntryToReceiptData } from "@/modules/finance/journal-receipt-utils";
import { apiRequest, queryClient } from "@/lib/query/query-client";
import { cn } from "@/lib/utils/cn";
import { Eye, PlusCircle, Loader2 } from "lucide-react";
import type { GmEntry } from "@shared/schema";
import { GmEntryInvoiceForm } from "@/modules/account/components/gm-entry-invoice-form";
import { PaginationBar } from "@/components/ui/pagination-bar";
import {
  AccountShell,
  AccountTextLink,
  DrmSection,
  accountPanelClass,
  accountTableFlushWrapClass,
  accountTableClass,
  accountTableHeadRowClass,
  accountTableHeadCellClass,
  accountTableBodyRowClass,
  AccountListToolbar,
  accountDialogShellClass,
  drmFieldClass,
} from "@/modules/account/account-ui";

export function AccountInvoicesPage() {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [selectedEntry, setSelectedEntry] = useState<GmEntry | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [showForm, setShowForm] = useState(true);
  const [modalMode, setModalMode] = useState<"view" | "create">("view");

  const { data: gmEntries = [], isLoading } = useQuery<GmEntry[]>({
    queryKey: ["/api/account/gm-entries"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/account/gm-entries");
      if (!res.ok) throw new Error("Failed to fetch GM entries");
      return res.json();
    },
  });

  const markPaidMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("PATCH", `/api/sale/commission-verification/${id}/approve`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sale/commission-verification"] });
      setSelectedEntry(null);
      toast({
        title: "Invoice Created",
        description: "Payment has been recorded successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create invoice",
        variant: "destructive",
      });
    },
  });

  const filteredEntries = useMemo(() => {
    if (!searchQuery || searchQuery === "none") return gmEntries;
    const query = searchQuery.toLowerCase();
    return gmEntries.filter(
      (entry) =>
        entry.companyName.toLowerCase().includes(query) ||
        entry.drmId.toLowerCase().includes(query) ||
        (entry.memberId && entry.memberId.toLowerCase().includes(query)),
    );
  }, [gmEntries, searchQuery]);

  const paginatedEntries = filteredEntries.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const viewReceiptData = useMemo(
    () => (selectedEntry ? gmEntryToReceiptData(selectedEntry, "invoice") : null),
    [selectedEntry],
  );

  const handleConfirmInvoice = () => {
    if (selectedEntry) {
      markPaidMutation.mutate(selectedEntry.id);
    }
  };

  const isPaid = (status: string) => status === "Approved";

  const formatPayment = (entry: GmEntry) => {
    if (entry.amountPkr) {
      return Number.parseFloat(entry.amountPkr).toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
    }
    const usd = Number(entry.amountUsd || 0);
    return (usd * 277).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  return (
    <AccountShell
      title="Make invoice"
      description="Search GM entries by company and create or review invoices."
      actions={
        <AccountTextLink
          active={showForm}
          onClick={() => {
            const nextShowForm = !showForm;
            setShowForm(nextShowForm);
            if (nextShowForm) {
              setTimeout(() => searchInputRef.current?.focus(), 100);
            }
          }}
        >
          {showForm ? "Hide company search" : "Show company search"}
        </AccountTextLink>
      }
    >
      {showForm && (
        <DrmSection title="Company search" description="Find a GM entry to invoice.">
          <div className={cn(accountPanelClass, "space-y-2 p-4")}>
            <Label className="text-[11px] font-bold uppercase tracking-wide text-zinc-500">Company name</Label>
            <Select
              value={searchQuery || "none"}
              onValueChange={(v) => {
                setSearchQuery(v === "none" ? "" : v);
                setCurrentPage(1);
                if (v === "none") return;
                const match = gmEntries?.find((gm: GmEntry) => {
                  const val = (gm.companyName || gm.drmId || gm.orderId || gm.id || "").toLowerCase().trim();
                  return (val || "unknown") === v;
                });
                if (match) {
                  setSelectedEntry(match);
                  setModalMode("create");
                }
              }}
            >
              <SelectTrigger className={cn(drmFieldClass, "h-10 w-full text-sm")}>
                <SelectValue placeholder="Search company through ID or name" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Search company through ID or name</SelectItem>
                {gmEntries?.map((gm: GmEntry) => {
                  const val = (gm.companyName || gm.drmId || gm.orderId || gm.id || "").toLowerCase().trim();
                  return (
                    <SelectItem key={gm.id} value={val || "unknown"}>
                      {gm.companyName || gm.drmId || gm.orderId || "Unnamed company"}
                      {gm.drmId ? ` (${gm.drmId})` : ""}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>
        </DrmSection>
      )}

      <DrmSection
        title="Invoice queue"
        description={`${filteredEntries.length} GM ${filteredEntries.length === 1 ? "entry" : "entries"} ready for invoicing.`}
        className="overflow-hidden"
        bodyClassName="!p-0"
      >
        <AccountListToolbar
          pageSize={pageSize}
          pageSizeOptions={[10, 25, 50, 100]}
          onPageSizeChange={(n) => {
            setPageSize(n);
            setCurrentPage(1);
          }}
          search={searchQuery === "none" ? "" : searchQuery}
          onSearchChange={(q) => {
            setSearchQuery(q);
            setCurrentPage(1);
          }}
          searchPlaceholder="Company, DRM ID, member ID…"
        />

        <div className={accountTableFlushWrapClass}>
          {isLoading ? (
            <div className="flex h-40 items-center justify-center gap-2 border-t border-zinc-200 text-sm text-zinc-500 dark:border-zinc-800">
              <Loader2 className="h-6 w-6 animate-spin text-emerald-600" />
              Loading entries…
            </div>
          ) : (
            <table className={cn(accountTableClass, "w-full min-w-[640px] table-fixed")}>
              <colgroup>
                <col className="w-[3.5rem]" />
                <col className="w-[38%]" />
                <col className="w-[18%]" />
                <col className="w-[12%]" />
                <col className="w-[14%]" />
                <col className="w-[7.5rem]" />
              </colgroup>
              <thead>
                <tr className={accountTableHeadRowClass}>
                  <th className={accountTableHeadCellClass}>No</th>
                  <th className={accountTableHeadCellClass}>Company</th>
                  <th className={accountTableHeadCellClass}>Sale person</th>
                  <th className={accountTableHeadCellClass}>Create</th>
                  <th className={cn(accountTableHeadCellClass, "text-right")}>Payment (PKR)</th>
                  <th className={cn(accountTableHeadCellClass, "text-center")}>Action</th>
                </tr>
              </thead>
              <tbody>
                {paginatedEntries.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="border-t border-zinc-100 px-4 py-12 text-center text-sm text-zinc-500 dark:border-zinc-800">
                      {searchQuery ? "No entries match your search." : "No GM entries available."}
                    </td>
                  </tr>
                ) : (
                  paginatedEntries.map((entry, index) => (
                    <tr key={entry.id} className={accountTableBodyRowClass}>
                      <td className="px-3 py-3 text-sm font-medium tabular-nums text-zinc-600 dark:text-zinc-400">
                        {(currentPage - 1) * pageSize + index + 1}
                      </td>
                      <td className="px-3 py-3" title={`${entry.companyName}${entry.drmId ? ` · ${entry.drmId}` : ""}`}>
                        <p className="truncate text-sm font-semibold normal-case text-zinc-900 dark:text-zinc-100">
                          {entry.companyName}
                        </p>
                        {entry.drmId ? (
                          <p className="truncate text-xs font-normal text-zinc-500 dark:text-zinc-400">{entry.drmId}</p>
                        ) : null}
                      </td>
                      <td className="truncate px-3 py-3 text-sm text-zinc-600 dark:text-zinc-400">
                        {(entry as GmEntry & { salesPersonName?: string; agentName?: string }).salesPersonName ||
                          (entry as GmEntry & { agentName?: string }).agentName ||
                          "—"}
                      </td>
                      <td className="whitespace-nowrap px-3 py-3 text-sm tabular-nums text-zinc-600 dark:text-zinc-400">
                        {entry.createdAt ? format(new Date(entry.createdAt), "dd/MM/yyyy") : "—"}
                      </td>
                      <td className="px-3 py-3 text-right text-sm font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
                        {formatPayment(entry)}
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            type="button"
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-200 bg-white text-emerald-700 shadow-sm transition-colors hover:border-emerald-300 hover:bg-emerald-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-emerald-400 dark:hover:bg-emerald-950/40"
                            onClick={() => {
                              setSelectedEntry(entry);
                              setModalMode("view");
                            }}
                            title="View invoice"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                          {!isPaid(entry.status) ? (
                            <button
                              type="button"
                              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-200 bg-white text-emerald-700 shadow-sm transition-colors hover:border-emerald-300 hover:bg-emerald-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-emerald-400 dark:hover:bg-emerald-950/40"
                              onClick={() => {
                                setSelectedEntry(entry);
                                setModalMode("create");
                              }}
                              title="Create invoice"
                            >
                              <PlusCircle className="h-4 w-4" />
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>

        {filteredEntries.length > 0 && (
          <div className="border-t border-zinc-200 bg-zinc-50/50 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-950/30">
            <PaginationBar
              page={currentPage}
              pageSize={pageSize}
              total={filteredEntries.length}
              onPageChange={setCurrentPage}
              disabled={isLoading}
            />
          </div>
        )}
      </DrmSection>

      <Dialog open={!!selectedEntry} onOpenChange={(open) => !open && setSelectedEntry(null)}>
        <DialogContent
          className={cn(
            "flex flex-col gap-0 overflow-hidden p-0",
            modalMode === "create"
              ? accountDialogShellClass
              : "max-h-[92vh] w-full max-w-3xl border-zinc-200 bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-950 sm:rounded-2xl",
          )}
        >
          <DialogHeader className="sr-only">
            <DialogTitle>Invoice detail</DialogTitle>
          </DialogHeader>

          {selectedEntry && modalMode === "view" && viewReceiptData && (
            <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
              <InvoiceReceipt
                invoiceData={viewReceiptData}
                documentTitle="Invoice"
                onClose={() => setSelectedEntry(null)}
              />
              {!isPaid(selectedEntry.status) && (
                <div className="no-print mx-auto mt-4 flex max-w-[760px] justify-end gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={handleConfirmInvoice}
                    disabled={markPaidMutation.isPending}
                  >
                    {markPaidMutation.isPending ? "Processing…" : "Confirm & send"}
                  </Button>
                </div>
              )}
            </div>
          )}

          {selectedEntry && modalMode === "create" && (
            <div className="flex min-h-0 flex-1 flex-col">
              <GmEntryInvoiceForm
                entry={selectedEntry}
                onClose={() => setSelectedEntry(null)}
                onSaved={() => queryClient.invalidateQueries({ queryKey: ["/api/account/gm-entries"] })}
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AccountShell>
  );
}
