"use client";

import { useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/legacy/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/lib/hooks/use-legacy-toast";
import { mutationRequest, queryClient } from "@/lib/query/query-client";
import { normalizeRole } from "@/lib/auth/role-utils";
import { cn } from "@/lib/utils/cn";
import { Loader2 } from "lucide-react";
import {
  accountPanelClass,
  AccountPrimaryButton,
  drmFieldClass,
} from "@/modules/account/account-ui";

interface Props {
  gmId: string | null;
  companyName?: string;
  salesPersonName?: string | null;
  drmId?: string | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

interface LoanTerms {
  loan_amount_usd: string;
  company_copay_usd: string;
  agreed_return_date: string | null;
  admin_approval_status: string;
  admin_comment: string | null;
  return_status: string;
  returned_at: string | null;
}

function loanStatusVariant(status: string): "success" | "warning" | "neutral" | "brand" {
  const s = (status || "PENDING").toUpperCase();
  if (s === "APPROVED" || s === "RETURNED") return "success";
  if (s === "REJECTED" || s === "OVERDUE") return "warning";
  return "neutral";
}

const loanDialogClass =
  "flex max-h-[90vh] w-full max-w-xl flex-col gap-0 overflow-hidden border-zinc-200 bg-zinc-50 p-0 shadow-xl dark:border-zinc-800 dark:bg-zinc-950 sm:rounded-2xl";

function loanContextLine(companyName?: string, salesPersonName?: string | null, drmId?: string | null): string | null {
  const parts: string[] = [];
  if (companyName?.trim()) parts.push(companyName.trim());
  if (salesPersonName?.trim()) parts.push(salesPersonName.trim());
  const base = parts.join(" · ");
  if (drmId?.trim()) return base ? `${base} (${drmId.trim()})` : drmId.trim();
  return base || null;
}

export function LoanTermsDialog({
  gmId,
  companyName,
  salesPersonName,
  drmId,
  open,
  onOpenChange,
}: Props) {
  const { toast } = useToast();
  const role = normalizeRole(typeof window !== "undefined" ? sessionStorage.getItem("userRole") : "");
  const isAdmin = role === "super_hod" || role === "admin" || role === "super_admin";

  const [loanAmount, setLoanAmount] = useState("");
  const [copay, setCopay] = useState("");
  const [returnDate, setReturnDate] = useState("");
  const [rejectReason, setRejectReason] = useState("");

  const key = ["/api/gm-pool", gmId, "loan-terms"];
  const { data, isLoading } = useQuery<any>({
    queryKey: key,
    enabled: open && !!gmId,
    select: (raw: any) => raw?.data,
  });
  const terms: LoanTerms | null = data?.terms ?? null;

  useEffect(() => {
    if (terms) {
      setLoanAmount(terms.loan_amount_usd ?? "");
      setCopay(terms.company_copay_usd ?? "");
      setReturnDate(terms.agreed_return_date ? String(terms.agreed_return_date).slice(0, 10) : "");
    }
  }, [terms]);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: key });
    queryClient.invalidateQueries({ queryKey: ["/api/gm-pool/loan-admin-queue"] });
    queryClient.invalidateQueries({ queryKey: ["/api/gm-pool/loan-return-report"] });
    queryClient.invalidateQueries({ queryKey: ["/api/sale/commission-verification"] });
  };

  const saveTerms = useMutation({
    mutationFn: async () =>
      mutationRequest("POST", `/api/gm-pool/${gmId}/loan-terms`, {
        loanAmountUsd: loanAmount ? Number(loanAmount) : undefined,
        companyCopayUsd: copay ? Number(copay) : undefined,
        agreedReturnDate: returnDate || undefined,
      }),
    onSuccess: () => {
      invalidate();
      toast({ title: "Loan terms saved" });
    },
    onError: (e: any) =>
      toast({ title: "Error", description: e?.message || "Failed to save loan terms", variant: "destructive" }),
  });

  const approve = useMutation({
    mutationFn: async () => mutationRequest("POST", `/api/gm-pool/${gmId}/loan-admin-approve`, {}),
    onSuccess: () => {
      invalidate();
      toast({ title: "Loan approved", description: "This loan GM can now proceed to final approval." });
    },
    onError: (e: any) => toast({ title: "Error", description: e?.message || "Failed", variant: "destructive" }),
  });

  const reject = useMutation({
    mutationFn: async () =>
      mutationRequest("POST", `/api/gm-pool/${gmId}/loan-admin-reject`, { comment: rejectReason }),
    onSuccess: () => {
      setRejectReason("");
      invalidate();
      toast({ title: "Loan rejected" });
    },
    onError: (e: any) =>
      toast({ title: "Error", description: e?.message || "A reason is required", variant: "destructive" }),
  });

  const setReturn = useMutation({
    mutationFn: async (returnStatus: string) =>
      mutationRequest("PATCH", `/api/gm-pool/${gmId}/loan-return`, { returnStatus }),
    onSuccess: () => {
      invalidate();
      toast({ title: "Return status updated" });
    },
    onError: (e: any) => toast({ title: "Error", description: e?.message || "Failed", variant: "destructive" }),
  });

  const adminStatus = terms?.admin_approval_status ?? "PENDING";
  const returnStatus = terms?.return_status ?? "PENDING";
  const contextLine = loanContextLine(companyName, salesPersonName, drmId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={loanDialogClass}>
        <DialogHeader className="shrink-0 border-b border-zinc-200 bg-white px-6 py-4 dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-[11px] font-bold uppercase tracking-wide text-emerald-700 dark:text-emerald-400">
            Account · Loan GM
          </p>
          <DialogTitle className="text-left text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            Loan terms
            {contextLine ? (
              <span className="mt-1 block text-sm font-normal text-zinc-500 dark:text-zinc-400">{contextLine}</span>
            ) : null}
          </DialogTitle>
          <DialogDescription className="text-left text-sm text-zinc-600 dark:text-zinc-400">
            Configure loan amounts, return date, admin approval, and return tracking.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
          {isLoading ? (
            <div className="flex items-center justify-center gap-2 py-16 text-sm text-zinc-500">
              <Loader2 className="h-5 w-5 animate-spin text-emerald-600" />
              Loading…
            </div>
          ) : (
            <div className="space-y-4">
              <div className={cn(accountPanelClass, "flex flex-wrap items-center gap-3 px-4 py-3")}>
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-zinc-500">Admin approval</span>
                  <Badge variant={loanStatusVariant(adminStatus)} className="normal-case">
                    {adminStatus}
                  </Badge>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-zinc-500">Return</span>
                  <Badge variant={loanStatusVariant(returnStatus)} className="normal-case">
                    {returnStatus}
                  </Badge>
                </div>
              </div>

              {terms?.admin_comment && (
                <p className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
                  Admin note: {terms.admin_comment}
                </p>
              )}

              <div className={cn(accountPanelClass, "space-y-4 p-4")}>
                <div>
                  <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Financial terms</h3>
                  <p className="text-xs text-zinc-500">Saving terms resets admin approval to pending.</p>
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                      Loan amount (USD)
                    </Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={loanAmount}
                      onChange={(e) => setLoanAmount(e.target.value)}
                      className={cn(drmFieldClass, "h-10")}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                      Company co-pay (USD)
                    </Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={copay}
                      onChange={(e) => setCopay(e.target.value)}
                      className={cn(drmFieldClass, "h-10")}
                    />
                  </div>
                  <div className="space-y-1 sm:col-span-2">
                    <Label className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                      Agreed return date
                    </Label>
                    <Input
                      type="date"
                      value={returnDate}
                      onChange={(e) => setReturnDate(e.target.value)}
                      className={cn(drmFieldClass, "h-10")}
                    />
                  </div>
                </div>
                <div className="flex justify-end">
                  <AccountPrimaryButton disabled={saveTerms.isPending} onClick={() => saveTerms.mutate()}>
                    {saveTerms.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                    Save terms
                  </AccountPrimaryButton>
                </div>
              </div>

              <div className={cn(accountPanelClass, "space-y-3 p-4")}>
                <div>
                  <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Return tracking</h3>
                  <p className="text-xs text-zinc-500">Update whether the loan has been returned.</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    disabled={setReturn.isPending}
                    onClick={() => setReturn.mutate("RETURNED")}
                  >
                    Mark returned
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    disabled={setReturn.isPending}
                    onClick={() => setReturn.mutate("PENDING")}
                  >
                    Mark pending
                  </Button>
                </div>
              </div>

              {isAdmin && (
                <div className={cn(accountPanelClass, "space-y-3 p-4")}>
                  <div>
                    <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                      Admin (Super HOD) decision
                    </h3>
                    <p className="text-xs text-zinc-500">Approve or reject this loan GM for final workflow.</p>
                  </div>
                  <AccountPrimaryButton disabled={approve.isPending} onClick={() => approve.mutate()}>
                    {approve.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                    Approve loan
                  </AccountPrimaryButton>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <Input
                      placeholder="Rejection reason (required to reject)"
                      value={rejectReason}
                      onChange={(e) => setRejectReason(e.target.value)}
                      className={cn(drmFieldClass, "h-10 flex-1")}
                    />
                    <Button
                      type="button"
                      variant="danger"
                      size="sm"
                      className="shrink-0"
                      disabled={!rejectReason.trim() || reject.isPending}
                      onClick={() => reject.mutate()}
                    >
                      Reject
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="shrink-0 border-t border-zinc-200 bg-white px-6 py-3 dark:border-zinc-800 dark:bg-zinc-900">
          <Button variant="secondary" size="sm" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
