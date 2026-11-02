import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { mutationRequest, getAuthHeader, apiRequestJson } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

const AMOUNT_MATCH_EPSILON = 0.01;

function resolveGmKind(gmEntry: any): "FULL" | "PARTIAL" | "LOAN" {
  const type = String(gmEntry?.gmType || "").toUpperCase();
  if (type === "LOAN" || gmEntry?.isLoan) return "LOAN";
  if (type === "PARTIAL" || gmEntry?.isPartialPayment) return "PARTIAL";
  return "FULL";
}

export function AccountApprovalModal({
  open,
  onOpenChange,
  gmEntry,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  gmEntry?: any;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [paymentStatus, setPaymentStatus] = useState("Cash Received");
  const [alibabaStatus, setAlibabaStatus] = useState("Approved");
  const [screenshotUrl, setScreenshotUrl] = useState<string | null>(null);
  const [screenshotName, setScreenshotName] = useState<string | null>(null);
  const [uploadingScreenshot, setUploadingScreenshot] = useState(false);
  const [enteredAmount, setEnteredAmount] = useState("");

  const gmKind = resolveGmKind(gmEntry);
  const isLoanOrPartial = gmKind === "LOAN" || gmKind === "PARTIAL";
  // Full GM: screenshot required. Loan / Partial: optional (installments cover payment proof).
  const screenshotRequired = !isLoanOrPartial;

  useEffect(() => {
    if (open) {
      setPaymentStatus("Cash Received");
      setAlibabaStatus("Approved");
      setScreenshotUrl(null);
      setScreenshotName(null);
      setUploadingScreenshot(false);
      setEnteredAmount("");
    }
  }, [open, gmEntry?.id]);

  // Loan / Partial: all scheduled installments must be collected (account-approved
  // via Dollar System / partial-receipts) before GM final Save is allowed.
  const installmentsQuery = useQuery<{
    success?: boolean;
    data?: { summary?: { fullyPaid?: boolean; paid?: number; remaining?: number; target?: number } };
  }>({
    queryKey: ["/api/gm-pool", gmEntry?.id, "partial-receipts"],
    enabled: open && !!gmEntry?.id && isLoanOrPartial,
    queryFn: () => apiRequestJson("GET", `/api/gm-pool/${gmEntry.id}/partial-receipts`),
    refetchOnWindowFocus: true,
  });

  const knownFullyPaid =
    gmEntry?.fullyPaid === true ||
    (Number(gmEntry?.partialPendingAmount) === 0 &&
      gmEntry?.partialReceivedAmount != null &&
      Number(gmEntry.partialReceivedAmount) > 0);

  const installmentsFullyPaid = useMemo(() => {
    if (!isLoanOrPartial) return true;
    if (installmentsQuery.data?.data?.summary?.fullyPaid === true) return true;
    if (installmentsQuery.data?.data?.summary?.fullyPaid === false) return false;
    // Fallback while loading / if receipts API unavailable: use row flag when present.
    if (typeof gmEntry?.fullyPaid === "boolean") return gmEntry.fullyPaid;
    return knownFullyPaid;
  }, [isLoanOrPartial, installmentsQuery.data, gmEntry?.fullyPaid, knownFullyPaid]);

  const installmentsLoading = isLoanOrPartial && installmentsQuery.isLoading;
  const installmentsBlockSave = isLoanOrPartial && !installmentsLoading && !installmentsFullyPaid;

  const expectedAmount = Number(gmEntry?.amountPkr ?? 0);
  const enteredAmountNum = enteredAmount.trim() === "" ? null : Number(enteredAmount);
  const hasAmountMismatch =
    enteredAmountNum !== null &&
    !Number.isNaN(enteredAmountNum) &&
    Math.abs(enteredAmountNum - expectedAmount) > AMOUNT_MATCH_EPSILON;
  const amountShortBy = enteredAmountNum !== null ? expectedAmount - enteredAmountNum : 0;

  const handleScreenshotChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !gmEntry?.id) return;
    setUploadingScreenshot(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("entryId", String(gmEntry.id));
      const res = await fetch("/api/account/dollar-system/attach", {
        method: "POST",
        headers: getAuthHeader(),
        credentials: "include",
        body: fd,
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error || "Upload failed");
      setScreenshotUrl(body.proofUrl);
      setScreenshotName(file.name);
    } catch (err: any) {
      toast({ title: "Error", description: err?.message || "Failed to upload screenshot", variant: "destructive" });
    } finally {
      setUploadingScreenshot(false);
    }
  };

  const invalidateAfterAction = () => {
    queryClient.invalidateQueries({ queryKey: ["accounts-gm-summary"] });
    queryClient.invalidateQueries({ queryKey: ["/api/gm-pool"] });
    queryClient.invalidateQueries({ queryKey: ["/api/account/gm-entries"] });
    queryClient.invalidateQueries({ queryKey: ["account-gm-entries"] });
    if (gmEntry?.id) {
      queryClient.invalidateQueries({ queryKey: ["/api/gm-pool", gmEntry.id, "partial-receipts"] });
    }
  };

  const approveMutation = useMutation({
    mutationFn: async () =>
      mutationRequest("POST", `/api/gm-pool/${gmEntry.id}/account-manager-approve`, {
        paymentStatus,
        alibabaStatus,
      }),
    onSuccess: () => {
      invalidateAfterAction();
      onOpenChange(false);
      toast({ title: "✅ Approved", description: "GM entry approved successfully" });
    },
    onError: (err: any) => toast({ title: "Error", description: err?.message || "Failed to approve entry", variant: "destructive" }),
  });

  const rejectMutation = useMutation({
    mutationFn: async () =>
      mutationRequest("POST", `/api/gm-pool/${gmEntry.id}/account-manager-reject`, {
        comment: "Rejected by Account Manager",
      }),
    onSuccess: () => {
      invalidateAfterAction();
      onOpenChange(false);
      toast({ title: "❌ Rejected", description: "GM entry rejected", variant: "destructive" });
    },
    onError: (err: any) => toast({ title: "Error", description: err?.message || "Failed to reject entry", variant: "destructive" }),
  });

  const isPending = approveMutation.isPending || rejectMutation.isPending;
  const requiresAmountVerification = alibabaStatus !== "Rejected";

  // Full GM: screenshot + matching amount required.
  // Loan / Partial: screenshot optional; if amount entered it must match; installments must be fully paid.
  const screenshotOk = !requiresAmountVerification || !screenshotRequired || !!screenshotUrl;
  const amountOk =
    !requiresAmountVerification ||
    (screenshotRequired
      ? enteredAmountNum !== null && !hasAmountMismatch
      : enteredAmountNum === null || !hasAmountMismatch);

  const canSave =
    screenshotOk &&
    amountOk &&
    !installmentsBlockSave &&
    !installmentsLoading;

  return (
    <Dialog open={open} onOpenChange={(next) => !isPending && onOpenChange(next)}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Accountant Approve</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4 py-4">
          <div>
            <Label className="text-sm font-medium">Name</Label>
            <Input value={gmEntry?.companyName || ""} readOnly className="mt-1 bg-gray-50" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-sm font-medium">Payment</Label>
              <Select value={paymentStatus} onValueChange={setPaymentStatus}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Cash Received">Cash Received</SelectItem>
                  <SelectItem value="Online Paid">Online Paid</SelectItem>
                  <SelectItem value="Customer Paid">Customer Paid</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-sm font-medium">Alibaba</Label>
              <Select value={alibabaStatus} onValueChange={setAlibabaStatus}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Approved">Approved</SelectItem>
                  <SelectItem value="Rejected">Rejected</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {isLoanOrPartial && requiresAmountVerification && (
            <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900">
              {installmentsLoading ? (
                <p className="text-xs text-muted-foreground">Checking installments…</p>
              ) : installmentsFullyPaid ? (
                <p className="text-xs text-emerald-700 font-medium">
                  All installments are approved — you can save this GM.
                </p>
              ) : (
                <p className="text-xs text-red-600 font-semibold">
                  Approve all installments first, then this GM can be approved.
                </p>
              )}
            </div>
          )}

          {requiresAmountVerification && (
            <>
              <div>
                <Label className="text-sm font-medium">
                  Payment Screenshot
                  {screenshotRequired ? (
                    <span className="text-red-500"> *</span>
                  ) : (
                    <span className="text-muted-foreground font-normal"> (optional for {gmKind})</span>
                  )}
                </Label>
                <Input
                  type="file"
                  accept="image/*"
                  className="mt-1"
                  disabled={uploadingScreenshot}
                  onChange={handleScreenshotChange}
                />
                {uploadingScreenshot && (
                  <p className="text-xs text-muted-foreground mt-1">Uploading…</p>
                )}
                {!uploadingScreenshot && screenshotName && (
                  <p className="text-xs text-emerald-600 mt-1 truncate">✓ {screenshotName}</p>
                )}
                {screenshotRequired && !screenshotUrl && !uploadingScreenshot && (
                  <p className="text-xs text-red-600 mt-1">Payment screenshot is required for Full GM.</p>
                )}
              </div>

              <div>
                <Label className="text-sm font-medium">
                  Amount in Screenshot (PKR)
                  {screenshotRequired ? <span className="text-red-500"> *</span> : null}
                </Label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="Enter PKR amount shown in screenshot"
                  className="mt-1"
                  value={enteredAmount}
                  onChange={(e) => setEnteredAmount(e.target.value)}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Expected: Rs {expectedAmount.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                </p>
                {hasAmountMismatch && (
                  <p className="text-xs text-red-600 font-medium mt-1">
                    {amountShortBy > 0
                      ? `This amount is Rs ${amountShortBy.toLocaleString(undefined, { maximumFractionDigits: 2 })} less than expected — cannot approve.`
                      : `This amount is Rs ${Math.abs(amountShortBy).toLocaleString(undefined, { maximumFractionDigits: 2 })} more than expected — cannot approve.`}
                  </p>
                )}
              </div>
            </>
          )}
        </div>
        <DialogFooter className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>Close</Button>
          <Button
            className="bg-green-600 hover:bg-green-700 text-white"
            disabled={isPending || !gmEntry?.id || uploadingScreenshot || !canSave}
            onClick={() => {
              if (alibabaStatus === "Rejected") {
                rejectMutation.mutate();
              } else {
                approveMutation.mutate();
              }
            }}
          >
            {isPending ? "Saving..." : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
