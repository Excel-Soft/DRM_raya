"use client";

import { accountHistoryPath } from "@/lib/navigation/account-routes";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/legacy/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/legacy/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/legacy/select";
import { Calendar, Eye, User, Loader2 } from "lucide-react";
import { useMemo, useState } from "react";
import { format } from "date-fns";
import { useToast } from "@/lib/hooks/use-legacy-toast";
import { apiRequest, queryClient } from "@/lib/query/query-client";
import { useRouter } from "next/navigation";
import {
  AccountShell,
  AccountPrimaryButton,
  DrmSection,
  accountPanelClass,
  accountTableClass,
  accountTableHeadRowClass,
  accountTableHeadCellClass,
  accountTableBodyRowClass,
  accountTableFlushWrapClass,
  AccountListToolbar,
  drmFieldClass,
} from "@/modules/account/account-ui";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { cn } from "@/lib/utils/cn";
import { PaginationBar } from "@/components/ui/pagination-bar";

interface LedgerEntry {
  id: string;
  entryType: "Credit" | "Debit";
  amount: string;
  currency: string;
  description: string;
  category: string;
  referenceId: string | null;
  referenceType: string | null;
  balanceAfter: string | null;
  entryDate: string;
  createdAt: string;
  accountName?: string;
  grandTotal?: string;
  pay?: string;
  due?: string;
}

interface LedgerResponse {
  data: LedgerEntry[];
  total: number;
  page: number;
  pageSize: number;
  summary: {
    totalGM: number;
    totalRefund: number;
    totalInvoice: number;
    totalDonation: number;
    outstandingDues: number;
  };
}

const formSchema = z.object({
  entryType: z.enum(["Credit", "Debit"]),
  amount: z.string().min(1, "Amount is required"),
  currency: z.string().default("USD"),
  description: z.string().min(1, "Description is required"),
  category: z.string().min(1, "Category is required"),
  entryDate: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

const categories = [
  "Revenue",
  "Expense",
  "Invoice Payment",
  "GM Payment",
  "Donation",
  "Refund",
  "Salary",
  "Utilities",
  "Rent",
  "Marketing",
  "Other",
];

const EXPORT_ACTIONS = ["copy", "excel", "csv", "pdf", "print"] as const;

function formatPkr(amount: string | number) {
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  return new Intl.NumberFormat("en-PK", {
    style: "currency",
    currency: "PKR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(num) ? num : 0);
}

const ledgerDialogClass =
  "flex max-h-[90vh] w-full max-w-lg flex-col gap-0 overflow-hidden border-zinc-200 bg-zinc-50 p-0 dark:border-zinc-800 dark:bg-zinc-950 sm:rounded-2xl";

export function AccountLedgerPage() {
  const { toast } = useToast();
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [companyFilter, setCompanyFilter] = useState("");
  const [contactFilter, setContactFilter] = useState("");
  const [ntnFilter, setNtnFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      entryType: "Credit",
      amount: "",
      currency: "USD",
      description: "",
      category: "",
      entryDate: new Date().toISOString().split("T")[0],
    },
  });

  const { data: ledgerData, isLoading } = useQuery<LedgerResponse>({
    queryKey: ["/api/reports/ledger", companyFilter, contactFilter, ntnFilter, dateFrom, currentPage],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set("page", currentPage.toString());
      params.set("pageSize", pageSize.toString());
      if (companyFilter) params.set("company", companyFilter);
      if (contactFilter) params.set("contact", contactFilter);
      if (ntnFilter) params.set("ntn", ntnFilter);
      if (dateFrom) params.set("from", dateFrom);
      const res = await apiRequest("GET", `/api/reports/ledger?${params.toString()}`);
      return res.json();
    },
  });

  const createMutation = useMutation({
    mutationFn: (data: FormValues) => apiRequest("POST", "/api/account/ledger", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/reports/ledger"] });
      setDialogOpen(false);
      form.reset();
      toast({ title: "Success", description: "Ledger entry created successfully" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to create ledger entry", variant: "destructive" });
    },
  });

  const entries = ledgerData?.data || [];
  const summary = ledgerData?.summary || {
    totalGM: 0,
    totalRefund: 0,
    totalInvoice: 0,
    totalDonation: 0,
    outstandingDues: 0,
  };

  const filteredEntries = useMemo(() => {
    if (!searchQuery.trim()) return entries;
    const q = searchQuery.toLowerCase();
    return entries.filter((e) => {
      const co = (e.description.split(":").pop()?.trim() || e.description).toLowerCase();
      return co.includes(q) || (e.accountName || "").toLowerCase().includes(q);
    });
  }, [entries, searchQuery]);

  const handleExport = (type: string) => {
    toast({ title: `Export ${type.toUpperCase()}`, description: "Preparing your file…" });
    if (type === "csv") {
      const params = new URLSearchParams();
      if (companyFilter) params.set("company", companyFilter);
      if (dateFrom) params.set("from", dateFrom);
      window.open(`/api/reports/ledger/export-csv?${params.toString()}`, "_blank");
    }
  };

  return (
    <AccountShell
      title="Company ledger"
      description="Financial tracking — invoices, payments, and outstanding balances by company."
      actions={<AccountPrimaryButton onClick={() => setDialogOpen(true)}>Add transaction</AccountPrimaryButton>}
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className={cn(accountPanelClass, "px-4 py-3")}>
          <p className="text-[11px] font-bold uppercase tracking-wide text-zinc-500">Total invoices</p>
          <p className="mt-1 text-xl font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">{formatPkr(summary.totalInvoice)}</p>
          <p className="mt-1 text-[10px] font-semibold uppercase text-emerald-600">Verified</p>
        </div>
        <div className={cn(accountPanelClass, "px-4 py-3")}>
          <p className="text-[11px] font-bold uppercase tracking-wide text-zinc-500">Total received</p>
          <p className="mt-1 text-xl font-semibold tabular-nums text-emerald-700">{formatPkr(summary.totalGM)}</p>
          <p className="mt-1 text-[10px] font-semibold uppercase text-zinc-500">Bank clearance</p>
        </div>
        <div className={cn(accountPanelClass, "px-4 py-3")}>
          <p className="text-[11px] font-bold uppercase tracking-wide text-zinc-500">Refunds / adjustments</p>
          <p className="mt-1 text-xl font-semibold tabular-nums text-rose-600">{formatPkr(summary.totalRefund)}</p>
        </div>
        <div className={cn(accountPanelClass, "px-4 py-3")}>
          <p className="text-[11px] font-bold uppercase tracking-wide text-amber-700 dark:text-amber-400">Outstanding</p>
          <p className="mt-1 text-xl font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
            {formatPkr(summary.outstandingDues)}
          </p>
          <p className="mt-1 text-[10px] font-semibold uppercase text-amber-600">Pending</p>
        </div>
      </div>

      <DrmSection title="Filters" description="Narrow the invoice list by company or date.">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1">
            <Label className="text-[11px] font-bold uppercase tracking-wide text-zinc-500">Company name</Label>
            <Input
              className={cn(drmFieldClass, "h-10")}
              placeholder="Company name"
              value={companyFilter}
              onChange={(e) => {
                setCompanyFilter(e.target.value);
                setCurrentPage(1);
              }}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-[11px] font-bold uppercase tracking-wide text-zinc-500">Contact no.</Label>
            <Input
              className={cn(drmFieldClass, "h-10")}
              placeholder="Contact"
              value={contactFilter}
              onChange={(e) => setContactFilter(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-[11px] font-bold uppercase tracking-wide text-zinc-500">NTN / CINC</Label>
            <Input
              className={cn(drmFieldClass, "h-10")}
              placeholder="NTN or CINC"
              value={ntnFilter}
              onChange={(e) => setNtnFilter(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-[11px] font-bold uppercase tracking-wide text-zinc-500">From date</Label>
            <Input
              type="date"
              className={cn(drmFieldClass, "h-10")}
              value={dateFrom}
              onChange={(e) => {
                setDateFrom(e.target.value);
                setCurrentPage(1);
              }}
            />
          </div>
        </div>
      </DrmSection>

      <DrmSection title="Invoices list" description="Export or open company history from the action column." bodyClassName="!p-0">
        <div className="flex flex-col gap-3 border-b border-zinc-200 px-4 py-3 sm:flex-row sm:items-center sm:justify-between dark:border-zinc-800">
          <div className="flex flex-wrap gap-1">
            {EXPORT_ACTIONS.map((type) => (
              <Button key={type} type="button" variant="secondary" size="sm" onClick={() => handleExport(type)}>
                {type.charAt(0).toUpperCase() + type.slice(1)}
              </Button>
            ))}
          </div>
        </div>

        <AccountListToolbar
          pageSize={pageSize}
          pageSizeOptions={[15, 30, 50]}
          onPageSizeChange={(n) => {
            setPageSize(n);
            setCurrentPage(1);
          }}
          search={searchQuery}
          onSearchChange={setSearchQuery}
          searchPlaceholder="Search company or account name…"
        />

        <div className={accountTableFlushWrapClass}>
          {isLoading ? (
            <div className="flex h-40 items-center justify-center gap-2 text-sm text-zinc-500">
              <Loader2 className="h-6 w-6 animate-spin text-emerald-600" />
              Loading…
            </div>
          ) : (
            <table className={cn(accountTableClass, "w-full min-w-[960px] table-fixed")}>
              <thead>
                <tr className={accountTableHeadRowClass}>
                  {[
                    "No",
                    "Company",
                    "Sub total",
                    "Discount",
                    "Grand total",
                    "Pay",
                    "Due",
                    "Date",
                    "Action",
                  ].map((h) => (
                    <th
                      key={h}
                      className={cn(
                        accountTableHeadCellClass,
                        ["Sub total", "Discount", "Grand total", "Pay", "Due"].includes(h) && "text-right",
                        h === "Action" && "text-center",
                      )}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredEntries.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-12 text-center text-sm text-zinc-500">
                      No invoice records found.
                    </td>
                  </tr>
                ) : (
                  filteredEntries.map((entry, i) => {
                    const subTotal = parseFloat(entry.amount);
                    const discount = 0;
                    const grandTotal = entry.grandTotal ? parseFloat(entry.grandTotal) : subTotal - discount;
                    const pay = entry.pay ? parseFloat(entry.pay) : entry.entryType === "Credit" ? grandTotal : 0;
                    const due = entry.due ? parseFloat(entry.due) : entry.entryType === "Debit" ? grandTotal : 0;
                    const coName = entry.description.split(":").pop()?.trim() || entry.description;
                    const historyKey = entry.id || coName;

                    return (
                      <tr key={entry.id} className={accountTableBodyRowClass}>
                        <td className="px-3 py-2.5 text-sm tabular-nums text-zinc-500">
                          {(currentPage - 1) * pageSize + i + 1}
                        </td>
                        <td className="px-3 py-2.5">
                          <p className="truncate text-sm font-semibold normal-case text-zinc-900 dark:text-zinc-100">{coName}</p>
                          {entry.accountName ? (
                            <p className="truncate text-xs text-zinc-500">{entry.accountName}</p>
                          ) : null}
                        </td>
                        <td className="px-3 py-2.5 text-right text-sm tabular-nums">{subTotal.toLocaleString()}</td>
                        <td className="px-3 py-2.5 text-right text-sm tabular-nums text-zinc-500">0.00</td>
                        <td className="px-3 py-2.5 text-right text-sm font-semibold tabular-nums">
                          {grandTotal.toLocaleString()}
                        </td>
                        <td className="px-3 py-2.5 text-right text-sm tabular-nums text-emerald-700">
                          {pay > 0 ? pay.toLocaleString() : "0.00"}
                        </td>
                        <td className="px-3 py-2.5 text-right text-sm tabular-nums text-amber-700">
                          {due > 0 ? due.toLocaleString() : "0.00"}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2.5 text-center text-sm text-zinc-600">
                          {format(new Date(entry.entryDate), "dd-MM-yyyy")}
                        </td>
                        <td className="px-3 py-2.5">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              type="button"
                              title="Company history"
                              onClick={() => router.push(accountHistoryPath(historyKey))}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-200 bg-white text-emerald-700 hover:bg-emerald-50 dark:border-zinc-700 dark:bg-zinc-900"
                            >
                              <User className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              title="View receipt"
                              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-200 bg-white text-emerald-700 hover:bg-emerald-50 dark:border-zinc-700 dark:bg-zinc-900"
                            >
                              <Eye className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          )}
        </div>

        <div className="border-t border-zinc-200 bg-zinc-50/50 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-950/30">
          <PaginationBar page={currentPage} pageSize={pageSize} total={ledgerData?.total || 0} onPageChange={setCurrentPage} />
        </div>
      </DrmSection>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className={ledgerDialogClass}>
          <DialogHeader className="border-b border-zinc-200 bg-white px-6 py-4 dark:border-zinc-800 dark:bg-zinc-900">
            <p className="text-[11px] font-bold uppercase tracking-wide text-emerald-700 dark:text-emerald-400">
              Account · Ledger
            </p>
            <DialogTitle className="text-left text-lg font-semibold">Add transaction</DialogTitle>
            <DialogDescription className="text-left text-sm text-zinc-600 dark:text-zinc-400">
              Record a credit or debit entry on the company ledger.
            </DialogDescription>
          </DialogHeader>
          <div className="overflow-y-auto px-6 py-4">
            <Form {...form}>
              <form id="ledger-entry-form" onSubmit={form.handleSubmit((d) => createMutation.mutate(d))} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="entryType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-[11px] font-bold uppercase text-zinc-500">Type</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger className={cn(drmFieldClass, "h-10")}>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="Credit">Credit (income)</SelectItem>
                            <SelectItem value="Debit">Debit (expense)</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="category"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-[11px] font-bold uppercase text-zinc-500">Category</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger className={cn(drmFieldClass, "h-10")}>
                              <SelectValue placeholder="Category" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {categories.map((cat) => (
                              <SelectItem key={cat} value={cat}>
                                {cat}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="amount"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-[11px] font-bold uppercase text-zinc-500">Amount</FormLabel>
                        <FormControl>
                          <Input type="number" step="0.01" {...field} className={cn(drmFieldClass, "h-10")} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="currency"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-[11px] font-bold uppercase text-zinc-500">Currency</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger className={cn(drmFieldClass, "h-10")}>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="USD">USD</SelectItem>
                            <SelectItem value="PKR">PKR</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-[11px] font-bold uppercase text-zinc-500">Description</FormLabel>
                      <FormControl>
                        <Textarea {...field} className={cn(drmFieldClass, "min-h-[80px] resize-none")} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="entryDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-[11px] font-bold uppercase text-zinc-500">Date (optional)</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Input type="date" {...field} className={cn(drmFieldClass, "h-10 pl-9")} />
                          <Calendar className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </form>
            </Form>
          </div>
          <DialogFooter className="gap-2 border-t border-zinc-200 bg-white px-6 py-3 dark:border-zinc-800 dark:bg-zinc-900">
            <Button type="button" variant="secondary" size="sm" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <AccountPrimaryButton type="submit" form="ledger-entry-form" disabled={createMutation.isPending}>
              {createMutation.isPending ? "Saving…" : "Save entry"}
            </AccountPrimaryButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AccountShell>
  );
}
