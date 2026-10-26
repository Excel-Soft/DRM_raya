"use client";

import { useRef, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/legacy/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/legacy/tabs";
import { Button } from "@/components/ui/button";
import { useToast } from "@/lib/hooks/use-legacy-toast";
import { mutationRequest, queryClient } from "@/lib/query/query-client";
import { Trash2, Plus, Wallet, Loader2, Pencil } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import {
  accountDialogShellClass,
  accountPanelClass,
  AccountSummaryStrip,
  AccountPrimaryButton,
  drmFieldClass,
  accountTableWrapClass,
  accountTableClass,
  accountTableHeadRowClass,
  accountTableHeadCellClass,
  accountTableBodyRowClass,
} from "@/modules/account/account-ui";

interface Props {
  gmId: string | null;
  companyName?: string;
  isPartialPayment: boolean;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

interface ReceiptRow {
  id: string;
  amountUsd: string;
  amountPkr: string | null;
  dollarRate: string | null;
  method: string | null;
  reference: string | null;
  receiptDate: string;
  collectedByName: string | null;
  due: number;
}
interface InstallmentRow {
  no: number;
  installmentDate: string | null;
  grandTotalDollar: number;
  grandTotalPkr: number;
  dollarRate: number | null;
  chequeNo: string | null;
  pay: number;
  due: number;
  createDate: string | null;
}
interface Summary {
  target: number;
  paid: number;
  remaining: number;
  fullyPaid: boolean;
}
interface DraftRow {
  dollar: string;
  dollarRate: string;
  pkr: string;
  chequeNo: string;
  payDate: string;
}
interface PayForm {
  date: string;
  due: string;
  dollar: string;
  dollarRate: string;
  paymentMethod: string;
  recoveryType: string;
}

const fmt = (n: any) =>
  `$${Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtDate = (d: any) =>
  d ? new Date(d).toLocaleDateString(undefined, { year: "numeric", month: "2-digit", day: "2-digit" }) : "—";

const blankRow = (): DraftRow => ({ dollar: "", dollarRate: "", pkr: "", chequeNo: "", payDate: "" });
const todayStr = () => new Date().toISOString().slice(0, 10);
const blankPayForm = (due: string): PayForm => ({
  date: todayStr(),
  due,
  dollar: "",
  dollarRate: "",
  paymentMethod: "",
  recoveryType: "",
});

const selectClass = cn(drmFieldClass, "h-9 w-full text-sm");

const INSTALLMENT_HEADERS = [
  "No",
  "Installment Date",
  "Company",
  "Person",
  "Grand Total Dollar",
  "Dollar Rate",
  "Grand Total Pkr",
  "Cheque No",
  "Pay",
  "Due",
  "Create Date",
  "Action",
] as const;

const RECEIPT_HEADERS = ["No", "Paid Date", "Company", "Person", "Dollar", "Dollar Rate", "Pkr", "Due", "Create"] as const;

export function PartialReceiptsDialog({ gmId, companyName, isPartialPayment, open, onOpenChange }: Props) {
  const { toast } = useToast();
  const [draftRows, setDraftRows] = useState<DraftRow[]>([blankRow()]);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [payingIndex, setPayingIndex] = useState<number | null>(null);
  const [payForm, setPayForm] = useState<PayForm>(blankPayForm("0.00"));
  const formTopRef = useRef<HTMLDivElement>(null);

  const key = ["/api/gm-pool", gmId, "partial-receipts"];
  const { data, isLoading } = useQuery<any>({
    queryKey: key,
    enabled: open && !!gmId,
    select: (raw: any) => raw?.data,
  });
  const summary: Summary | undefined = data?.summary;
  const receipts: ReceiptRow[] = data?.receipts || [];
  const installments: InstallmentRow[] = data?.installments || [];
  const installmentTotals = data?.installmentTotals || { grandTotalDollar: 0, grandTotalPkr: 0, pay: 0, due: 0 };
  const personName: string | undefined = data?.personName;
  const resolvedCompanyName = companyName || data?.companyName;

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: key });
    queryClient.invalidateQueries({ queryKey: ["/api/sale/commission-verification"] });
  };

  const updateDraftRow = (index: number, field: keyof DraftRow, value: string) => {
    setDraftRows((prev) => prev.map((r, i) => (i === index ? { ...r, [field]: value } : r)));
  };
  const addDraftRow = () => setDraftRows((prev) => [...prev, blankRow()]);
  const removeDraftRow = (index: number) =>
    setDraftRows((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== index) : prev));

  const cancelEdit = () => {
    setEditingIndex(null);
    setDraftRows([blankRow()]);
  };

  const cancelPay = () => setPayingIndex(null);

  const submitInstallments = useMutation({
    mutationFn: async () => {
      if (editingIndex !== null) {
        const r = draftRows[0];
        if (!r.dollar.trim()) throw new Error("Enter the installment's dollar amount");
        return mutationRequest("PATCH", `/api/gm-pool/${gmId}/installments/${editingIndex}`, {
          dollar: Number(r.dollar),
          pkr: r.pkr ? Number(r.pkr) : 0,
          dollarRate: r.dollarRate ? Number(r.dollarRate) : undefined,
          chequeNo: r.chequeNo || undefined,
          payDate: r.payDate || undefined,
        });
      }
      const rows = draftRows
        .filter((r) => r.dollar.trim() !== "")
        .map((r) => ({
          dollar: Number(r.dollar),
          pkr: r.pkr ? Number(r.pkr) : 0,
          dollarRate: r.dollarRate ? Number(r.dollarRate) : undefined,
          chequeNo: r.chequeNo || undefined,
          payDate: r.payDate || undefined,
        }));
      if (rows.length === 0) throw new Error("Enter at least one installment's dollar amount");
      return mutationRequest("POST", `/api/gm-pool/${gmId}/installments`, { rows });
    },
    onSuccess: () => {
      const wasEditing = editingIndex !== null;
      setDraftRows([blankRow()]);
      setEditingIndex(null);
      invalidate();
      toast({ title: wasEditing ? "Installment updated" : "Installment(s) added" });
    },
    onError: (e: any) =>
      toast({ title: "Error", description: e?.message || "Failed to save installment", variant: "destructive" }),
  });

  const addReceipt = useMutation({
    mutationFn: async (vars: {
      amountUsd: number;
      amountPkr?: number;
      dollarRate?: number;
      receiptDate?: string;
      method?: string;
      reference?: string;
      notes?: string;
    }) => mutationRequest("POST", `/api/gm-pool/${gmId}/partial-receipts`, vars),
    onSuccess: () => {
      setPayingIndex(null);
      invalidate();
      toast({ title: "Payment collected" });
    },
    onError: (e: any) =>
      toast({ title: "Error", description: e?.message || "Failed to record receipt", variant: "destructive" }),
  });

  const submitPayment = () => {
    if (payingIndex === null) return;
    const dollar = Number(payForm.dollar);
    if (!dollar || dollar <= 0) {
      toast({ title: "Error", description: "Enter the dollar amount being paid", variant: "destructive" });
      return;
    }
    const row = installments[payingIndex];
    const dollarRate = Number(payForm.dollarRate) || 0;
    addReceipt.mutate({
      amountUsd: dollar,
      amountPkr: dollarRate > 0 ? Number((dollar * dollarRate).toFixed(2)) : undefined,
      dollarRate: payForm.dollarRate ? dollarRate : undefined,
      receiptDate: payForm.date || undefined,
      method: payForm.paymentMethod || undefined,
      reference: row?.chequeNo ? `Cheque #${row.chequeNo}` : undefined,
      notes: payForm.recoveryType ? `Recovery Type: ${payForm.recoveryType}` : undefined,
    });
  };

  const finalize = useMutation({
    mutationFn: async () => mutationRequest("POST", `/api/gm-pool/${gmId}/finalize-partial`, {}),
    onSuccess: () => {
      invalidate();
      toast({ title: "Partial payment complete", description: "This GM can now be finally approved." });
    },
    onError: (e: any) =>
      toast({ title: "Still outstanding", description: e?.message || "Balance not yet cleared", variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={accountDialogShellClass}>
        <DialogHeader className="shrink-0 border-b border-zinc-200 bg-white px-6 py-4 dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-[11px] font-bold uppercase tracking-wide text-emerald-700 dark:text-emerald-400">
            Account · Installments
          </p>
          <DialogTitle className="text-left text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            Add new installment
            {resolvedCompanyName ? (
              <span className="mt-1 block text-sm font-normal text-zinc-500 dark:text-zinc-400">
                {resolvedCompanyName}
              </span>
            ) : null}
          </DialogTitle>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
          {isLoading ? (
            <div className="flex items-center justify-center gap-2 py-16 text-sm text-zinc-500">
              <Loader2 className="h-5 w-5 animate-spin text-emerald-600" /> Loading…
            </div>
          ) : (
            <div className="space-y-5">
              {summary ? (
                <AccountSummaryStrip target={summary.target} paid={summary.paid} remaining={summary.remaining} />
              ) : null}

              <div ref={formTopRef} className={cn(accountPanelClass, "p-4")}>
                {payingIndex !== null ? (
                  <div className="space-y-4">
                    <div>
                      <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Collect payment</h3>
                      <p className="text-xs text-zinc-500">
                        Installment #{payingIndex + 1} — record receipt against schedule.
                      </p>
                    </div>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                      <div className="space-y-1">
                        <Label className="text-xs text-zinc-500">Company</Label>
                        <Input value={resolvedCompanyName || ""} readOnly className={cn(drmFieldClass, "h-9 bg-zinc-50 dark:bg-zinc-800/80")} />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-zinc-500">Date</Label>
                        <Input
                          type="date"
                          className={cn(drmFieldClass, "h-9")}
                          value={payForm.date}
                          onChange={(e) => setPayForm({ ...payForm, date: e.target.value })}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-zinc-500">Due</Label>
                        <Input value={payForm.due} readOnly className={cn(drmFieldClass, "h-9 bg-zinc-50 dark:bg-zinc-800/80")} />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-zinc-500">Dollar</Label>
                        <Input
                          placeholder="0.00"
                          className={cn(drmFieldClass, "h-9")}
                          value={payForm.dollar}
                          onChange={(e) => setPayForm({ ...payForm, dollar: e.target.value })}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-zinc-500">Dollar rate</Label>
                        <Input
                          placeholder="0.00"
                          className={cn(drmFieldClass, "h-9")}
                          value={payForm.dollarRate}
                          onChange={(e) => setPayForm({ ...payForm, dollarRate: e.target.value })}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-zinc-500">PKR amount</Label>
                        <Input
                          readOnly
                          className={cn(drmFieldClass, "h-9 bg-zinc-50 dark:bg-zinc-800/80")}
                          value={((Number(payForm.dollar) || 0) * (Number(payForm.dollarRate) || 0)).toLocaleString(undefined, {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-zinc-500">Payment method</Label>
                        <select
                          value={payForm.paymentMethod}
                          onChange={(e) => setPayForm({ ...payForm, paymentMethod: e.target.value })}
                          className={selectClass}
                        >
                          <option value="">Choose…</option>
                          <option value="Cash">Cash</option>
                          <option value="Bank Transfer">Bank Transfer</option>
                          <option value="Cheque">Cheque</option>
                          <option value="Online">Online</option>
                        </select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-zinc-500">Recovery type</Label>
                        <select
                          value={payForm.recoveryType}
                          onChange={(e) => setPayForm({ ...payForm, recoveryType: e.target.value })}
                          className={selectClass}
                        >
                          <option value="">Choose…</option>
                          <option value="Full Recovery">Full Recovery</option>
                          <option value="Partial Recovery">Partial Recovery</option>
                        </select>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2 pt-1">
                      <AccountPrimaryButton type="button" disabled={addReceipt.isPending} onClick={submitPayment}>
                        {addReceipt.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                        Save payment
                      </AccountPrimaryButton>
                      <Button type="button" variant="secondary" size="sm" onClick={cancelPay}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div>
                      <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                        {editingIndex !== null ? `Edit installment #${editingIndex + 1}` : "Schedule installment"}
                      </h3>
                      <p className="text-xs text-zinc-500">Add one or more rows, then submit to update the schedule.</p>
                    </div>
                    {draftRows.map((row, index) => (
                      <div
                        key={index}
                        className="grid grid-cols-1 items-end gap-3 sm:grid-cols-2 lg:grid-cols-[repeat(5,minmax(0,1fr))_auto]"
                      >
                        <div className="space-y-1">
                          {index === 0 && <Label className="text-xs text-zinc-500">Dollar</Label>}
                          <Input
                            placeholder="Amount ($)"
                            className={cn(drmFieldClass, "h-9")}
                            value={row.dollar}
                            onChange={(e) => updateDraftRow(index, "dollar", e.target.value)}
                          />
                        </div>
                        <div className="space-y-1">
                          {index === 0 && <Label className="text-xs text-zinc-500">Dollar rate</Label>}
                          <Input
                            placeholder="0.00"
                            className={cn(drmFieldClass, "h-9")}
                            value={row.dollarRate}
                            onChange={(e) => updateDraftRow(index, "dollarRate", e.target.value)}
                          />
                        </div>
                        <div className="space-y-1">
                          {index === 0 && <Label className="text-xs text-zinc-500">PKR amount</Label>}
                          <Input
                            placeholder="PKR"
                            value={
                              row.dollarRate
                                ? ((Number(row.dollar) || 0) * (Number(row.dollarRate) || 0)).toFixed(2)
                                : row.pkr
                            }
                            readOnly={!!row.dollarRate}
                            className={cn(drmFieldClass, "h-9", row.dollarRate && "bg-zinc-50 dark:bg-zinc-800/80")}
                            onChange={(e) => updateDraftRow(index, "pkr", e.target.value)}
                          />
                        </div>
                        <div className="space-y-1">
                          {index === 0 && <Label className="text-xs text-zinc-500">Cheque no</Label>}
                          <Input
                            placeholder="Optional"
                            className={cn(drmFieldClass, "h-9")}
                            value={row.chequeNo}
                            onChange={(e) => updateDraftRow(index, "chequeNo", e.target.value)}
                          />
                        </div>
                        <div className="space-y-1">
                          {index === 0 && <Label className="text-xs text-zinc-500">Pay date</Label>}
                          <Input
                            type="date"
                            className={cn(drmFieldClass, "h-9")}
                            value={row.payDate}
                            onChange={(e) => updateDraftRow(index, "payDate", e.target.value)}
                          />
                        </div>
                        {editingIndex === null && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="text-red-600 hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-950/40"
                            disabled={draftRows.length === 1}
                            onClick={() => removeDraftRow(index)}
                            title="Remove row"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    ))}
                    <div className="flex flex-wrap gap-2">
                      {editingIndex === null && (
                        <Button type="button" variant="secondary" size="sm" onClick={addDraftRow}>
                          <Plus className="h-4 w-4" /> Add row
                        </Button>
                      )}
                      <AccountPrimaryButton
                        type="button"
                        disabled={submitInstallments.isPending}
                        onClick={() => submitInstallments.mutate()}
                      >
                        {submitInstallments.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                        {editingIndex !== null ? "Update installment" : "Submit schedule"}
                      </AccountPrimaryButton>
                      {editingIndex !== null && (
                        <Button type="button" variant="secondary" size="sm" onClick={cancelEdit}>
                          Cancel edit
                        </Button>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <div className={cn(accountPanelClass, "overflow-hidden")}>
                <div className="border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
                  <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Time history</h3>
                  <p className="text-xs text-zinc-500">Installment schedule vs collected receipts.</p>
                </div>
                <div className="p-4">
                  <Tabs defaultValue="installments">
                    <TabsList className="mb-3 grid w-full max-w-md grid-cols-2 bg-zinc-100 dark:bg-zinc-800">
                      <TabsTrigger
                        value="installments"
                        className="data-[state=active]:bg-white data-[state=active]:text-emerald-800 dark:data-[state=active]:bg-zinc-900"
                      >
                        Installments
                      </TabsTrigger>
                      <TabsTrigger
                        value="receipts"
                        className="data-[state=active]:bg-white data-[state=active]:text-emerald-800 dark:data-[state=active]:bg-zinc-900"
                      >
                        Receipt list
                      </TabsTrigger>
                    </TabsList>

                    <TabsContent value="installments" className="mt-0">
                      <div className={accountTableWrapClass}>
                        <table className={cn(accountTableClass, "whitespace-nowrap")}>
                          <thead>
                            <tr className={accountTableHeadRowClass}>
                              {INSTALLMENT_HEADERS.map((h) => (
                                <th key={h} className={accountTableHeadCellClass}>
                                  {h}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {installments.length === 0 ? (
                              <tr>
                                <td colSpan={12} className="px-3 py-8 text-center text-sm text-zinc-500">
                                  No installments scheduled yet
                                </td>
                              </tr>
                            ) : (
                              installments.map((row) => (
                                <tr key={row.no} className={accountTableBodyRowClass}>
                                  <td className="px-3 py-2">{row.no}</td>
                                  <td className="px-3 py-2">{fmtDate(row.installmentDate)}</td>
                                  <td className="px-3 py-2 max-w-[140px] truncate">{resolvedCompanyName || "—"}</td>
                                  <td className="px-3 py-2">{personName || "—"}</td>
                                  <td className="px-3 py-2 tabular-nums">{fmt(row.grandTotalDollar)}</td>
                                  <td className="px-3 py-2 tabular-nums">
                                    {row.dollarRate != null ? Number(row.dollarRate).toFixed(2) : "—"}
                                  </td>
                                  <td className="px-3 py-2 tabular-nums">
                                    {Number(row.grandTotalPkr || 0).toLocaleString()}
                                  </td>
                                  <td className="px-3 py-2">{row.chequeNo || "—"}</td>
                                  <td className="px-3 py-2 tabular-nums">{row.pay > 0 ? fmt(row.pay) : "—"}</td>
                                  <td className="px-3 py-2 tabular-nums">{fmt(row.due)}</td>
                                  <td className="px-3 py-2">{fmtDate(row.createDate)}</td>
                                  <td className="px-3 py-2">
                                    <div className="flex items-center gap-1.5">
                                      <Button
                                        type="button"
                                        size="sm"
                                        variant="primary"
                                        className="h-8 w-8 shrink-0 p-0"
                                        disabled={row.due <= 0.009}
                                        onClick={() => {
                                          setPayingIndex(row.no - 1);
                                          setPayForm(blankPayForm(row.due.toFixed(2)));
                                          setEditingIndex(null);
                                          formTopRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
                                        }}
                                        title={row.due > 0.009 ? "Pay" : "Already fully paid"}
                                      >
                                        <Wallet className="h-3.5 w-3.5" />
                                      </Button>
                                      <Button
                                        type="button"
                                        size="sm"
                                        variant="secondary"
                                        className="h-8 w-8 shrink-0 p-0"
                                        disabled={row.due <= 0.009}
                                        onClick={() => {
                                          setEditingIndex(row.no - 1);
                                          setDraftRows([
                                            {
                                              dollar: String(row.grandTotalDollar ?? ""),
                                              dollarRate: row.dollarRate != null ? String(row.dollarRate) : "",
                                              pkr: String(row.grandTotalPkr ?? ""),
                                              chequeNo: row.chequeNo || "",
                                              payDate: row.installmentDate ? row.installmentDate.slice(0, 10) : "",
                                            },
                                          ]);
                                          setPayingIndex(null);
                                          formTopRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
                                        }}
                                        title={row.due > 0.009 ? "Edit installment" : "Fully paid"}
                                      >
                                        <Pencil className="h-3.5 w-3.5" />
                                      </Button>
                                    </div>
                                  </td>
                                </tr>
                              ))
                            )}
                          </tbody>
                          {installments.length > 0 && (
                            <tfoot className="border-t border-zinc-200 bg-zinc-50 font-semibold dark:border-zinc-800 dark:bg-zinc-950/80">
                              <tr>
                                <td className="px-3 py-2" colSpan={4}>
                                  Total
                                </td>
                                <td className="px-3 py-2 tabular-nums">{fmt(installmentTotals.grandTotalDollar)}</td>
                                <td className="px-3 py-2" />
                                <td className="px-3 py-2 tabular-nums">
                                  {Number(installmentTotals.grandTotalPkr || 0).toLocaleString()}
                                </td>
                                <td className="px-3 py-2" />
                                <td className="px-3 py-2 tabular-nums">{fmt(installmentTotals.pay)}</td>
                                <td className="px-3 py-2 tabular-nums">{fmt(installmentTotals.due)}</td>
                                <td className="px-3 py-2" colSpan={2} />
                              </tr>
                            </tfoot>
                          )}
                        </table>
                      </div>
                    </TabsContent>

                    <TabsContent value="receipts" className="mt-0">
                      <div className={accountTableWrapClass}>
                        <table className={cn(accountTableClass, "whitespace-nowrap")}>
                          <thead>
                            <tr className={accountTableHeadRowClass}>
                              {RECEIPT_HEADERS.map((h) => (
                                <th key={h} className={accountTableHeadCellClass}>
                                  {h}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {receipts.length === 0 ? (
                              <tr>
                                <td colSpan={9} className="px-3 py-8 text-center text-sm text-zinc-500">
                                  No receipts yet
                                </td>
                              </tr>
                            ) : (
                              receipts.map((r, i) => (
                                <tr key={r.id} className={accountTableBodyRowClass}>
                                  <td className="px-3 py-2">{i + 1}</td>
                                  <td className="px-3 py-2">{fmtDate(r.receiptDate)}</td>
                                  <td className="px-3 py-2 max-w-[140px] truncate">{resolvedCompanyName || "—"}</td>
                                  <td className="px-3 py-2">{personName || "—"}</td>
                                  <td className="px-3 py-2 tabular-nums">{fmt(r.amountUsd)}</td>
                                  <td className="px-3 py-2 tabular-nums">{r.dollarRate ?? "—"}</td>
                                  <td className="px-3 py-2 tabular-nums">
                                    {r.amountPkr ? Number(r.amountPkr).toLocaleString() : "—"}
                                  </td>
                                  <td className="px-3 py-2 tabular-nums">{fmt(r.due)}</td>
                                  <td className="px-3 py-2">{r.collectedByName || "—"}</td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    </TabsContent>
                  </Tabs>
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="shrink-0 flex-row items-center justify-between gap-2 border-t border-zinc-200 bg-white px-6 py-3 dark:border-zinc-800 dark:bg-zinc-900 sm:justify-between">
          {isPartialPayment ? (
            <Button
              size="sm"
              variant="secondary"
              disabled={!summary?.fullyPaid || finalize.isPending}
              onClick={() => finalize.mutate()}
            >
              Mark fully paid
            </Button>
          ) : (
            <span />
          )}
          <Button variant="secondary" size="sm" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
