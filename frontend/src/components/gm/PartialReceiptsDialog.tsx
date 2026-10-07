import { useRef, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { mutationRequest, queryClient } from "@/lib/queryClient";
import { Trash2, Plus, Wallet, Loader2, Pencil } from "lucide-react";

interface Props {
  gmId: string | null;
  companyName?: string;
  /** False for a Full GM — it still uses this same receipts ledger to verify
   *  payment (see enforceLoanPartialFinalApprovalGate), it just isn't eligible
   *  for the Partial-only "finalize-partial" milestone below. */
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
const fmtDate = (d: any) => (d ? new Date(d).toLocaleDateString(undefined, { year: "numeric", month: "2-digit", day: "2-digit" }) : "—");

const blankRow = (): DraftRow => ({ dollar: "", pkr: "", chequeNo: "", payDate: "" });
const todayStr = () => new Date().toISOString().slice(0, 10);
const blankPayForm = (due: string): PayForm => ({
  date: todayStr(), due, dollar: "", dollarRate: "", paymentMethod: "", recoveryType: "",
});

/**
 * Account History / Add New Installment — mirrors the legacy "Time History
 * Details" layout: a top form to schedule one or more installments (each a
 * Dollar/Pkr/Cheque No/Pay Date row), and below it two tabs: the Installments
 * schedule (with Pay/Due waterfall-allocated from actual receipts) and the
 * Receipt List (the actual money collected, via the existing partial-receipts
 * ledger).
 */
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
    setDraftRows(prev => prev.map((r, i) => (i === index ? { ...r, [field]: value } : r)));
  };
  const addDraftRow = () => setDraftRows(prev => [...prev, blankRow()]);
  const removeDraftRow = (index: number) => setDraftRows(prev => (prev.length > 1 ? prev.filter((_, i) => i !== index) : prev));

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
          chequeNo: r.chequeNo || undefined,
          payDate: r.payDate || undefined,
        });
      }
      const rows = draftRows
        .filter(r => r.dollar.trim() !== "")
        .map(r => ({
          dollar: Number(r.dollar),
          pkr: r.pkr ? Number(r.pkr) : 0,
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
    onError: (e: any) => toast({ title: "Error", description: e?.message || "Failed to save installment", variant: "destructive" }),
  });

  const addReceipt = useMutation({
    mutationFn: async (vars: { amountUsd: number; amountPkr?: number; dollarRate?: number; receiptDate?: string; method?: string; reference?: string; notes?: string }) =>
      mutationRequest("POST", `/api/gm-pool/${gmId}/partial-receipts`, vars),
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
      <DialogContent className="sm:max-w-[98vw] w-[98vw] h-[95vh] max-h-[95vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="text-muted-foreground font-normal">Account History /</span>
            <span>Add New Installment</span>
            {resolvedCompanyName && <span className="text-sm font-normal text-muted-foreground">— {resolvedCompanyName}</span>}
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="py-8 text-center text-sm text-gray-400 flex items-center justify-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </div>
        ) : (
          <div className="space-y-5">
            {summary && (
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                <span>Target <span className="font-semibold text-foreground">{fmt(summary.target)}</span></span>
                <span>Paid <span className="font-semibold text-green-600">{fmt(summary.paid)}</span></span>
                <span>Remaining <span className={`font-semibold ${summary.remaining > 0 ? "text-amber-600" : "text-green-600"}`}>{fmt(summary.remaining)}</span></span>
              </div>
            )}

            {/* Add New Installment form (reused in-place for editing an existing row),
                or — when a green Pay button was clicked — a Make Payment form instead. */}
            <div ref={formTopRef} className="space-y-2">
            {payingIndex !== null ? (
              <div className="space-y-3">
                <div className="text-sm font-semibold">
                  Make Payment (Installment Id: <span className="text-emerald-600">{payingIndex + 1}</span>)
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">Company Name:</label>
                    <Input value={resolvedCompanyName || ""} readOnly className="bg-gray-50 dark:bg-zinc-800" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">Date:</label>
                    <Input type="date" value={payForm.date} onChange={e => setPayForm({ ...payForm, date: e.target.value })} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">Due:</label>
                    <Input value={payForm.due} readOnly className="bg-gray-50 dark:bg-zinc-800" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">Enter Dollar:</label>
                    <Input placeholder="0.00" value={payForm.dollar} onChange={e => setPayForm({ ...payForm, dollar: e.target.value })} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">Dollar Rate:</label>
                    <Input placeholder="0.00" value={payForm.dollarRate} onChange={e => setPayForm({ ...payForm, dollarRate: e.target.value })} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">Pkr Amount:</label>
                    <Input
                      readOnly
                      className="bg-gray-50 dark:bg-zinc-800"
                      value={((Number(payForm.dollar) || 0) * (Number(payForm.dollarRate) || 0)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">Payment Method:</label>
                    <select
                      value={payForm.paymentMethod}
                      onChange={e => setPayForm({ ...payForm, paymentMethod: e.target.value })}
                      className="h-9 w-full border border-gray-300 rounded-md px-2 bg-white dark:bg-zinc-900 dark:border-zinc-700 text-sm focus:outline-none"
                    >
                      <option value="">Choose...</option>
                      <option value="Cash">Cash</option>
                      <option value="Bank Transfer">Bank Transfer</option>
                      <option value="Cheque">Cheque</option>
                      <option value="Online">Online</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">Recovery Type Method:</label>
                    <select
                      value={payForm.recoveryType}
                      onChange={e => setPayForm({ ...payForm, recoveryType: e.target.value })}
                      className="h-9 w-full border border-gray-300 rounded-md px-2 bg-white dark:bg-zinc-900 dark:border-zinc-700 text-sm focus:outline-none"
                    >
                      <option value="">Choose...</option>
                      <option value="Full Recovery">Full Recovery</option>
                      <option value="Partial Recovery">Partial Recovery</option>
                    </select>
                  </div>
                </div>
                <div className="flex items-center gap-2 pt-1">
                  <Button type="button" size="sm" disabled={addReceipt.isPending} onClick={submitPayment} className="gap-1 bg-[#00a65a] hover:bg-[#008d4c]">
                    {addReceipt.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Save
                  </Button>
                  <Button type="button" size="sm" variant="ghost" onClick={cancelPay}>
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <>
              {editingIndex !== null && (
                <div className="text-xs font-semibold text-blue-600 bg-blue-50 border border-blue-100 rounded px-2 py-1 w-fit">
                  Editing Installment #{editingIndex + 1}
                </div>
              )}
              {draftRows.map((row, index) => (
                <div key={index} className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_1fr_1fr_auto] gap-2 items-end">
                  <div>
                    {index === 0 && <label className="block text-xs font-medium text-muted-foreground mb-1">Dollar</label>}
                    <Input placeholder="add dollar $" value={row.dollar} onChange={e => updateDraftRow(index, "dollar", e.target.value)} />
                  </div>
                  <div>
                    {index === 0 && <label className="block text-xs font-medium text-muted-foreground mb-1">Pkr Amount</label>}
                    <Input placeholder="add pkr amount" value={row.pkr} onChange={e => updateDraftRow(index, "pkr", e.target.value)} />
                  </div>
                  <div>
                    {index === 0 && <label className="block text-xs font-medium text-muted-foreground mb-1">Cheque No</label>}
                    <Input placeholder="add cheque no" value={row.chequeNo} onChange={e => updateDraftRow(index, "chequeNo", e.target.value)} />
                  </div>
                  <div>
                    {index === 0 && <label className="block text-xs font-medium text-muted-foreground mb-1">Pay Date</label>}
                    <Input type="date" value={row.payDate} onChange={e => updateDraftRow(index, "payDate", e.target.value)} />
                  </div>
                  {editingIndex === null && (
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="text-red-500 hover:text-red-700 hover:bg-red-50"
                      disabled={draftRows.length === 1}
                      onClick={() => removeDraftRow(index)}
                      title="Remove row"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
              <div className="flex items-center gap-2 pt-1">
                {editingIndex === null && (
                  <Button type="button" size="sm" variant="outline" onClick={addDraftRow} className="gap-1">
                    <Plus className="h-4 w-4" /> Add Row
                  </Button>
                )}
                <Button type="button" size="sm" disabled={submitInstallments.isPending} onClick={() => submitInstallments.mutate()} className="gap-1">
                  {submitInstallments.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />} {editingIndex !== null ? "Update" : "Submit"}
                </Button>
                {editingIndex !== null && (
                  <Button type="button" size="sm" variant="ghost" onClick={cancelEdit}>
                    Cancel
                  </Button>
                )}
              </div>
              </>
            )}
            </div>

            {/* Time History Details */}
            <div className="pt-2 border-t">
              <div className="text-sm font-semibold py-2">Time History Details</div>
              <Tabs defaultValue="installments">
                <TabsList>
                  <TabsTrigger value="installments">Installments</TabsTrigger>
                  <TabsTrigger value="receipts">Receipt List</TabsTrigger>
                </TabsList>

                <TabsContent value="installments" className="mt-3">
                  <div className="border rounded overflow-x-auto">
                    <table className="w-full text-xs whitespace-nowrap">
                      <thead className="bg-gray-50 dark:bg-zinc-800">
                        <tr>
                          {["No", "Installment Date", "Company", "Person", "Grand Total Dollar", "Grand Total Pkr", "Cheque No", "Pay", "Due", "Create Date", "Action"].map(h => (
                            <th key={h} className="px-2 py-1.5 text-left font-semibold">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {installments.length === 0 ? (
                          <tr><td colSpan={11} className="px-2 py-4 text-center text-gray-400">No installments scheduled yet</td></tr>
                        ) : (
                          installments.map((row) => (
                            <tr key={row.no} className="border-t">
                              <td className="px-2 py-1.5">{row.no}</td>
                              <td className="px-2 py-1.5">{fmtDate(row.installmentDate)}</td>
                              <td className="px-2 py-1.5">{resolvedCompanyName || "—"}</td>
                              <td className="px-2 py-1.5">{personName || "—"}</td>
                              <td className="px-2 py-1.5">{fmt(row.grandTotalDollar)}</td>
                              <td className="px-2 py-1.5">{Number(row.grandTotalPkr || 0).toLocaleString()}</td>
                              <td className="px-2 py-1.5">{row.chequeNo || "—"}</td>
                              <td className="px-2 py-1.5">{row.pay > 0 ? fmt(row.pay) : "—"}</td>
                              <td className="px-2 py-1.5">{fmt(row.due)}</td>
                              <td className="px-2 py-1.5">{fmtDate(row.createDate)}</td>
                              <td className="px-2 py-1.5">
                                <div className="flex items-center gap-1.5">
                                  <button
                                    type="button"
                                    disabled={row.due <= 0.009}
                                    onClick={() => {
                                      setPayingIndex(row.no - 1);
                                      setPayForm(blankPayForm(row.due.toFixed(2)));
                                      setEditingIndex(null);
                                      formTopRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
                                    }}
                                    title={row.due > 0.009 ? "Pay" : "Already fully paid"}
                                    className="w-7 h-7 rounded-full bg-[#00a65a] hover:bg-[#008d4c] disabled:opacity-40 disabled:cursor-not-allowed text-white flex items-center justify-center shadow-sm transition-all cursor-pointer"
                                  >
                                    <Wallet className="h-3.5 w-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    disabled={row.due <= 0.009}
                                    onClick={() => {
                                      setEditingIndex(row.no - 1);
                                      setDraftRows([{
                                        dollar: String(row.grandTotalDollar ?? ""),
                                        pkr: String(row.grandTotalPkr ?? ""),
                                        chequeNo: row.chequeNo || "",
                                        payDate: row.installmentDate ? row.installmentDate.slice(0, 10) : "",
                                      }]);
                                      setPayingIndex(null);
                                      formTopRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
                                    }}
                                    title={row.due > 0.009 ? "Edit this installment" : "Already fully paid — can't be edited"}
                                    className="w-7 h-7 rounded-full bg-[#3c8dbc] hover:bg-[#367fa9] disabled:opacity-40 disabled:cursor-not-allowed text-white flex items-center justify-center shadow-sm transition-all cursor-pointer"
                                  >
                                    <Pencil className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                      {installments.length > 0 && (
                        <tfoot className="bg-gray-50 dark:bg-zinc-800 font-semibold">
                          <tr className="border-t">
                            <td className="px-2 py-1.5" colSpan={4}>Total</td>
                            <td className="px-2 py-1.5">{fmt(installmentTotals.grandTotalDollar)}</td>
                            <td className="px-2 py-1.5">{Number(installmentTotals.grandTotalPkr || 0).toLocaleString()}</td>
                            <td className="px-2 py-1.5"></td>
                            <td className="px-2 py-1.5">{fmt(installmentTotals.pay)}</td>
                            <td className="px-2 py-1.5">{fmt(installmentTotals.due)}</td>
                            <td className="px-2 py-1.5" colSpan={2}></td>
                          </tr>
                        </tfoot>
                      )}
                    </table>
                  </div>
                </TabsContent>

                <TabsContent value="receipts" className="mt-3">
                  <div className="border rounded overflow-x-auto">
                    <table className="w-full text-xs whitespace-nowrap">
                      <thead className="bg-gray-50 dark:bg-zinc-800">
                        <tr>
                          {["No", "Paid Date", "Company", "Person", "Dollar", "Dollar Rate", "Pkr", "Due", "Create"].map(h => (
                            <th key={h} className="px-2 py-1.5 text-left font-semibold">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {receipts.length === 0 ? (
                          <tr><td colSpan={9} className="px-2 py-4 text-center text-gray-400">No receipts yet</td></tr>
                        ) : (
                          receipts.map((r, i) => (
                            <tr key={r.id} className="border-t">
                              <td className="px-2 py-1.5">{i + 1}</td>
                              <td className="px-2 py-1.5">{fmtDate(r.receiptDate)}</td>
                              <td className="px-2 py-1.5">{resolvedCompanyName || "—"}</td>
                              <td className="px-2 py-1.5">{personName || "—"}</td>
                              <td className="px-2 py-1.5">{fmt(r.amountUsd)}</td>
                              <td className="px-2 py-1.5">{r.dollarRate ?? "—"}</td>
                              <td className="px-2 py-1.5">{r.amountPkr ? Number(r.amountPkr).toLocaleString() : "—"}</td>
                              <td className="px-2 py-1.5">{fmt(r.due)}</td>
                              <td className="px-2 py-1.5">{r.collectedByName || "—"}</td>
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
        )}

        <DialogFooter className="flex items-center justify-between sm:justify-between gap-2">
          {isPartialPayment ? (
            <Button
              size="sm"
              variant="outline"
              disabled={!summary?.fullyPaid || finalize.isPending}
              onClick={() => finalize.mutate()}
            >
              Mark Fully Paid
            </Button>
          ) : <span />}
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
