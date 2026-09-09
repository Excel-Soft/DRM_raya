import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { mutationRequest, queryClient } from "@/lib/queryClient";

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
  method: string | null;
  reference: string | null;
  receiptDate: string;
}
interface Summary {
  target: number;
  paid: number;
  remaining: number;
  fullyPaid: boolean;
}

const fmt = (n: any) =>
  `$${Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/**
 * Patch 5 Stage 3 (P4) — partial-payment receipt manager for a single GM.
 * Shows the running target / paid / remaining summary, the receipt ledger, and a
 * form to record new receipts. "Mark Fully Paid" calls finalize-partial which only
 * validates that the balance is cleared — final approval still flows through the
 * normal HOD / Account Manager routes.
 */
export function PartialReceiptsDialog({ gmId, companyName, isPartialPayment, open, onOpenChange }: Props) {
  const { toast } = useToast();
  const [amountUsd, setAmountUsd] = useState("");
  const [amountPkr, setAmountPkr] = useState("");
  const [method, setMethod] = useState("");
  const [reference, setReference] = useState("");

  const key = ["/api/gm-pool", gmId, "partial-receipts"];
  const { data, isLoading } = useQuery<any>({
    queryKey: key,
    enabled: open && !!gmId,
    select: (raw: any) => raw?.data,
  });
  const summary: Summary | undefined = data?.summary;
  const receipts: ReceiptRow[] = data?.receipts || [];

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: key });
    queryClient.invalidateQueries({ queryKey: ["/api/account/gm-entries"] });
  };

  const addReceipt = useMutation({
    mutationFn: async () =>
      mutationRequest("POST", `/api/gm-pool/${gmId}/partial-receipts`, {
        amountUsd: Number(amountUsd),
        amountPkr: amountPkr ? Number(amountPkr) : undefined,
        method: method || undefined,
        reference: reference || undefined,
      }),
    onSuccess: () => {
      setAmountUsd("");
      setAmountPkr("");
      setMethod("");
      setReference("");
      invalidate();
      toast({ title: "Receipt recorded" });
    },
    onError: (e: any) =>
      toast({ title: "Error", description: e?.message || "Failed to record receipt", variant: "destructive" }),
  });

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
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {isPartialPayment ? "Partial Payment Receipts" : "Payment Receipt"}
            {companyName ? ` — ${companyName}` : ""}
          </DialogTitle>
        </DialogHeader>
        {isLoading ? (
          <div className="py-8 text-center text-sm text-gray-400">Loading…</div>
        ) : (
          <div className="space-y-4">
            {summary && (
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded border p-2">
                  <div className="text-xs text-gray-500">Target</div>
                  <div className="font-semibold">{fmt(summary.target)}</div>
                </div>
                <div className="rounded border p-2">
                  <div className="text-xs text-gray-500">Paid</div>
                  <div className="font-semibold text-green-600">{fmt(summary.paid)}</div>
                </div>
                <div className="rounded border p-2">
                  <div className="text-xs text-gray-500">Remaining</div>
                  <div className={`font-semibold ${summary.remaining > 0 ? "text-amber-600" : "text-green-600"}`}>
                    {fmt(summary.remaining)}
                  </div>
                </div>
              </div>
            )}
            <div className="max-h-48 overflow-auto border rounded">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 dark:bg-zinc-800">
                  <tr>
                    <th className="px-2 py-1 text-left">Date</th>
                    <th className="px-2 py-1 text-right">USD</th>
                    <th className="px-2 py-1 text-right">PKR</th>
                    <th className="px-2 py-1 text-left">Method</th>
                    <th className="px-2 py-1 text-left">Ref</th>
                  </tr>
                </thead>
                <tbody>
                  {receipts.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-2 py-4 text-center text-gray-400">
                        No receipts yet
                      </td>
                    </tr>
                  ) : (
                    receipts.map((r) => (
                      <tr key={r.id} className="border-t">
                        <td className="px-2 py-1">{new Date(r.receiptDate).toLocaleDateString()}</td>
                        <td className="px-2 py-1 text-right">{fmt(r.amountUsd)}</td>
                        <td className="px-2 py-1 text-right">{r.amountPkr ?? "—"}</td>
                        <td className="px-2 py-1">{r.method ?? "—"}</td>
                        <td className="px-2 py-1">{r.reference ?? "—"}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Input placeholder="Amount USD *" value={amountUsd} onChange={(e) => setAmountUsd(e.target.value)} />
              <Input placeholder="Amount PKR" value={amountPkr} onChange={(e) => setAmountPkr(e.target.value)} />
              <Input placeholder="Method (e.g. Bank)" value={method} onChange={(e) => setMethod(e.target.value)} />
              <Input placeholder="Reference" value={reference} onChange={(e) => setReference(e.target.value)} />
            </div>
            <div className="flex justify-between">
              {isPartialPayment ? (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!summary?.fullyPaid || finalize.isPending}
                  onClick={() => finalize.mutate()}
                >
                  Mark Fully Paid
                </Button>
              ) : (
                <span className="text-xs text-muted-foreground self-center">
                  {summary?.fullyPaid ? "Payment confirmed — ready for final approval." : "Log the full amount to unblock final approval."}
                </span>
              )}
              <Button size="sm" disabled={!amountUsd || addReceipt.isPending} onClick={() => addReceipt.mutate()}>
                Add Receipt
              </Button>
            </div>
          </div>
        )}
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
