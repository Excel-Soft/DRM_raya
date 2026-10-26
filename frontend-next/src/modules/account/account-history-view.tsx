"use client";

import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, useRouter } from "next/navigation";
import { format } from "date-fns";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Eye, ArrowLeft } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/query/query-client";
import { useToast } from "@/lib/hooks/use-legacy-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ACCOUNT_LEDGER } from "@/lib/navigation/account-routes";
import { cn } from "@/lib/utils/cn";
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
} from "@/modules/account/account-ui";
import { AccountPaymentDialog } from "@/modules/account/components/account-payment-dialog";

interface Invoice {
  id: string;
  invoiceNumber: string;
  subtotal: string;
  tax: string;
  total: string;
  customerName: string;
  createdByUserId: string;
  createdAt: string;
}

interface Payment {
  id: string;
  amount: string;
  currency: string;
  entryDate: string;
  referenceId: string;
  category: string;
}

interface HistoryResponse {
  success: boolean;
  data: {
    invoices: Invoice[];
    receipts: Payment[];
  };
}

const formSchema = z.object({
  invoiceId: z.string().min(1, "Invoice is required"),
  amount: z.string().min(1, "Amount is required"),
  paymentMethod: z.string().default("BankTransfer"),
  notes: z.string().optional(),
  entryDate: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;
type TabId = "all" | "invoices" | "receipts" | "summary";

const TABS: { id: TabId; label: string }[] = [
  { id: "all", label: "All" },
  { id: "invoices", label: "Invoice list" },
  { id: "receipts", label: "Receipt list" },
  { id: "summary", label: "Account summary" },
];

function formatMoney(amount: string | number, currency = "USD") {
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(Number.isFinite(num) ? num : 0);
}

function resolveCompanyKey(raw: string | undefined): string {
  if (!raw) return "";
  try {
    return decodeURIComponent(raw).trim().replace(/\s+/g, " ");
  } catch {
    return raw.trim().replace(/\s+/g, " ");
  }
}

export function AccountHistoryPage() {
  const { companyId: companyIdParam } = useParams<{ companyId: string }>();
  const router = useRouter();
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [tab, setTab] = useState<TabId>("all");

  const companyKey = resolveCompanyKey(companyIdParam);
  const companyLabel = companyKey;

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      invoiceId: "",
      amount: "",
      paymentMethod: "BankTransfer",
      notes: "",
      entryDate: new Date().toISOString().split("T")[0],
    },
  });

  const { data: historyData, isLoading, isError, error } = useQuery<HistoryResponse>({
    queryKey: ["/api/account/history", companyKey],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/account/history/${encodeURIComponent(companyKey)}`);
      const body = await res.json();
      if (!res.ok) {
        throw new Error(body?.error || "Failed to load company history");
      }
      return body as HistoryResponse;
    },
    enabled: !!companyKey,
  });

  const createPaymentMutation = useMutation({
    mutationFn: (data: FormValues) => apiRequest("POST", "/api/account/payment", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/account/history"] });
      setDialogOpen(false);
      form.reset();
      toast({ title: "Success", description: "Payment recorded successfully" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to record payment", variant: "destructive" });
    },
  });

  const invoices = historyData?.data?.invoices || [];
  const receipts = historyData?.data?.receipts || [];

  const totalInvoicesAmount = invoices.reduce((sum, inv) => sum + parseFloat(inv.total), 0);
  const totalPaidAmount = receipts.reduce((sum, rec) => sum + parseFloat(rec.amount), 0);
  const outstandingDue = totalInvoicesAmount - totalPaidAmount;

  const invoiceOptions = useMemo(
    () => invoices.map((inv) => ({ id: inv.id, label: `${inv.invoiceNumber} — ${formatMoney(inv.total)}` })),
    [invoices],
  );

  return (
    <AccountShell
      title={companyLabel || "Company history"}
      description="Invoices, receipts, and outstanding balance for this company."
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="secondary" size="sm" onClick={() => router.push(ACCOUNT_LEDGER)}>
            <ArrowLeft className="mr-1 h-4 w-4" />
            Back to ledger
          </Button>
          <AccountPrimaryButton onClick={() => setDialogOpen(true)}>Make payment</AccountPrimaryButton>
        </div>
      }
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className={cn(accountPanelClass, "px-4 py-3")}>
          <p className="text-[11px] font-bold uppercase tracking-wide text-zinc-500">Total invoiced</p>
          <p className="mt-1 text-xl font-semibold tabular-nums text-zinc-900 dark:text-zinc-100">
            {formatMoney(totalInvoicesAmount)}
          </p>
        </div>
        <div className={cn(accountPanelClass, "px-4 py-3")}>
          <p className="text-[11px] font-bold uppercase tracking-wide text-emerald-700 dark:text-emerald-400">Total paid</p>
          <p className="mt-1 text-xl font-semibold tabular-nums text-emerald-700 dark:text-emerald-400">
            {formatMoney(totalPaidAmount)}
          </p>
        </div>
        <div className={cn(accountPanelClass, "px-4 py-3")}>
          <p className="text-[11px] font-bold uppercase tracking-wide text-amber-700 dark:text-amber-400">Outstanding due</p>
          <p className="mt-1 text-xl font-semibold tabular-nums text-amber-800 dark:text-amber-400">
            {formatMoney(outstandingDue)}
          </p>
        </div>
      </div>

      <DrmSection title="Account activity" description="Switch tabs to review invoices, receipts, or summary." bodyClassName="!p-0">
        <div className="flex flex-wrap gap-2 border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={cn(
                "rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors",
                tab === t.id
                  ? "border-emerald-600 bg-emerald-600 text-white shadow-sm"
                  : "border-zinc-200 bg-white text-zinc-700 hover:border-emerald-300 hover:bg-emerald-50/80 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200",
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="flex h-40 items-center justify-center text-sm text-zinc-500">Loading…</div>
        ) : isError ? (
          <div className="px-4 py-10 text-center text-sm text-rose-600">
            {(error as Error)?.message || "Could not load history for this company."}
          </div>
        ) : tab === "all" || tab === "invoices" ? (
          <div className={tab === "all" ? "space-y-4 p-4 pt-0" : ""}>
            {tab === "all" ? (
              <p className="px-4 pt-4 text-sm font-semibold text-zinc-800 dark:text-zinc-200">Invoices</p>
            ) : null}
            <div className={accountTableFlushWrapClass}>
              <table className={cn(accountTableClass, "w-full min-w-[640px]")}>
                <thead>
                  <tr className={accountTableHeadRowClass}>
                    {(tab === "invoices"
                      ? ["Invoice #", "Sub total", "Tax", "Grand total", "Date"]
                      : ["Invoice #", "Total", "Date", "Action"]
                    ).map((h) => (
                      <th key={h} className={accountTableHeadCellClass}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {invoices.length === 0 ? (
                    <tr>
                      <td colSpan={tab === "invoices" ? 5 : 4} className="px-4 py-10 text-center text-sm text-zinc-500">
                        No invoices found
                      </td>
                    </tr>
                  ) : (
                    invoices.map((inv) => (
                      <tr key={inv.id} className={accountTableBodyRowClass}>
                        <td className="px-3 py-2.5 text-sm font-medium text-zinc-900 dark:text-zinc-100">
                          {inv.invoiceNumber}
                        </td>
                        {tab === "invoices" ? (
                          <>
                            <td className="px-3 py-2.5 text-sm tabular-nums text-zinc-600">{formatMoney(inv.subtotal)}</td>
                            <td className="px-3 py-2.5 text-sm tabular-nums text-zinc-600">{formatMoney(inv.tax)}</td>
                            <td className="px-3 py-2.5 text-sm font-semibold tabular-nums">{formatMoney(inv.total)}</td>
                          </>
                        ) : (
                          <td className="px-3 py-2.5 text-sm font-semibold tabular-nums">{formatMoney(inv.total)}</td>
                        )}
                        <td className="whitespace-nowrap px-3 py-2.5 text-sm text-zinc-600">
                          {format(new Date(inv.createdAt), "dd-MM-yyyy")}
                        </td>
                        {tab === "all" ? (
                          <td className="px-3 py-2.5">
                            <button
                              type="button"
                              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-200 text-emerald-700 hover:bg-emerald-50 dark:border-zinc-700"
                              title="View invoice"
                            >
                              <Eye className="h-4 w-4" />
                            </button>
                          </td>
                        ) : null}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}

        {tab === "receipts" ? (
          <div className={accountTableFlushWrapClass}>
            <table className={cn(accountTableClass, "w-full")}>
              <thead>
                <tr className={accountTableHeadRowClass}>
                  {["Ref ID", "Amount", "Date"].map((h) => (
                    <th key={h} className={accountTableHeadCellClass}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {receipts.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-4 py-10 text-center text-sm text-zinc-500">
                      No receipts found
                    </td>
                  </tr>
                ) : (
                  receipts.map((rec) => (
                    <tr key={rec.id} className={accountTableBodyRowClass}>
                      <td className="px-3 py-2.5 text-sm font-medium">{rec.id.slice(0, 8)}</td>
                      <td className="px-3 py-2.5 text-sm font-semibold tabular-nums text-emerald-700">
                        {formatMoney(rec.amount)}
                      </td>
                      <td className="px-3 py-2.5 text-sm text-zinc-600">
                        {format(new Date(rec.entryDate), "dd-MM-yyyy")}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        ) : null}

        {tab === "summary" ? (
          <div className={accountTableFlushWrapClass}>
            <table className={cn(accountTableClass, "w-full min-w-[520px]")}>
              <thead>
                <tr className={accountTableHeadRowClass}>
                  {["Invoice #", "Grand total", "Paid", "Due"].map((h) => (
                    <th key={h} className={accountTableHeadCellClass}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {invoices.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-10 text-center text-sm text-zinc-500">
                      No summary data
                    </td>
                  </tr>
                ) : (
                  invoices.map((inv) => {
                    const paidForInv = receipts
                      .filter((r) => r.referenceId === inv.id)
                      .reduce((sum, r) => sum + parseFloat(r.amount), 0);
                    const due = parseFloat(inv.total) - paidForInv;
                    return (
                      <tr key={inv.id} className={accountTableBodyRowClass}>
                        <td className="px-3 py-2.5 text-sm font-medium">{inv.invoiceNumber}</td>
                        <td className="px-3 py-2.5 text-sm tabular-nums">{formatMoney(inv.total)}</td>
                        <td className="px-3 py-2.5 text-sm tabular-nums text-emerald-700">{formatMoney(paidForInv)}</td>
                        <td className="px-3 py-2.5 text-sm font-semibold tabular-nums text-amber-700">{formatMoney(due)}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        ) : null}
      </DrmSection>

      <AccountPaymentDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        form={form}
        invoices={invoiceOptions}
        onSubmit={(v) => createPaymentMutation.mutate(v)}
        pending={createPaymentMutation.isPending}
      />
    </AccountShell>
  );
}
