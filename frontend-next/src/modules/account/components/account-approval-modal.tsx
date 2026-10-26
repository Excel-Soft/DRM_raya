"use client";

import { useEffect, useId, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/legacy/select";
import { mutationRequest, getAuthHeader } from "@/lib/query/query-client";
import { useToast } from "@/lib/hooks/use-legacy-toast";
import { cn } from "@/lib/utils/cn";
import { Loader2, Upload, CheckCircle2 } from "lucide-react";
import {
  accountPanelClass,
  AccountPrimaryButton,
  drmFieldClass,
} from "@/modules/account/account-ui";

const AMOUNT_MATCH_EPSILON = 0.01;

const approvalDialogClass =
  "flex max-h-[90vh] w-full max-w-lg flex-col gap-0 overflow-hidden border-zinc-200 bg-zinc-50 p-0 dark:border-zinc-800 dark:bg-zinc-950 sm:rounded-2xl";

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
  const fileInputId = useId();
  const [paymentStatus, setPaymentStatus] = useState("Cash Received");
  const [alibabaStatus, setAlibabaStatus] = useState("Approved");
  const [screenshotUrl, setScreenshotUrl] = useState<string | null>(null);
  const [screenshotName, setScreenshotName] = useState<string | null>(null);
  const [uploadingScreenshot, setUploadingScreenshot] = useState(false);
  const [enteredAmount, setEnteredAmount] = useState("");

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

  const expectedAmount = Number(gmEntry?.amountUsd ?? 0);
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
      toast({ title: "Approved", description: "GM entry approved successfully" });
    },
    onError: (err: any) =>
      toast({ title: "Error", description: err?.message || "Failed to approve entry", variant: "destructive" }),
  });

  const rejectMutation = useMutation({
    mutationFn: async () =>
      mutationRequest("POST", `/api/gm-pool/${gmEntry.id}/account-manager-reject`, {
        comment: "Rejected by Account Manager",
      }),
    onSuccess: () => {
      invalidateAfterAction();
      onOpenChange(false);
      toast({ title: "Rejected", description: "GM entry rejected", variant: "destructive" });
    },
    onError: (err: any) =>
      toast({ title: "Error", description: err?.message || "Failed to reject entry", variant: "destructive" }),
  });

  const isPending = approveMutation.isPending || rejectMutation.isPending;
  const requiresAmountVerification = alibabaStatus !== "Rejected";
  const canSave =
    !requiresAmountVerification ||
    (!!screenshotUrl && enteredAmountNum !== null && !hasAmountMismatch);

  const companyLabel = [gmEntry?.companyName, gmEntry?.drmId].filter(Boolean).join(" · ");

  return (
    <Dialog open={open} onOpenChange={(next) => !isPending && onOpenChange(next)}>
      <DialogContent className={approvalDialogClass}>
        <DialogHeader className="shrink-0 border-b border-zinc-200 bg-white px-6 py-4 dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-[11px] font-bold uppercase tracking-wide text-emerald-700 dark:text-emerald-400">
            Account · Approval
          </p>
          <DialogTitle className="text-left text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            Accountant approve
          </DialogTitle>
          <DialogDescription className="text-left text-sm text-zinc-600 dark:text-zinc-400">
            Confirm payment and Alibaba status before final account approval.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
          <div className={cn(accountPanelClass, "space-y-4 p-4")}>
            <div className="space-y-1">
              <Label className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Company</Label>
              <Input
                value={companyLabel || "—"}
                readOnly
                className={cn(drmFieldClass, "h-10 bg-zinc-50 dark:bg-zinc-800/80")}
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1">
                <Label className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Payment</Label>
                <Select value={paymentStatus} onValueChange={setPaymentStatus}>
                  <SelectTrigger className={cn(drmFieldClass, "h-10 w-full")}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Cash Received">Cash Received</SelectItem>
                    <SelectItem value="Online Paid">Online Paid</SelectItem>
                    <SelectItem value="Customer Paid">Customer Paid</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Alibaba</Label>
                <Select value={alibabaStatus} onValueChange={setAlibabaStatus}>
                  <SelectTrigger className={cn(drmFieldClass, "h-10 w-full")}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Approved">Approved</SelectItem>
                    <SelectItem value="Rejected">Rejected</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {requiresAmountVerification && (
              <>
                <div className="space-y-2">
                  <Label className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                    Payment screenshot
                  </Label>
                  <input
                    id={fileInputId}
                    type="file"
                    accept="image/*"
                    className="sr-only"
                    disabled={uploadingScreenshot}
                    onChange={handleScreenshotChange}
                  />
                  <label
                    htmlFor={fileInputId}
                    className={cn(
                      drmFieldClass,
                      "flex min-h-10 cursor-pointer items-center gap-2 bg-white px-3 py-2 text-sm dark:bg-zinc-900",
                      uploadingScreenshot && "pointer-events-none opacity-60",
                    )}
                  >
                    {uploadingScreenshot ? (
                      <Loader2 className="h-4 w-4 shrink-0 animate-spin text-emerald-600" />
                    ) : screenshotUrl ? (
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                    ) : (
                      <Upload className="h-4 w-4 shrink-0 text-zinc-400" />
                    )}
                    <span className="truncate text-zinc-700 dark:text-zinc-300">
                      {uploadingScreenshot
                        ? "Uploading…"
                        : screenshotName
                          ? screenshotName
                          : "Choose image file"}
                    </span>
                  </label>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                    Amount in screenshot
                  </Label>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="Enter amount shown in screenshot"
                    className={cn(drmFieldClass, "h-10")}
                    value={enteredAmount}
                    onChange={(e) => setEnteredAmount(e.target.value)}
                  />
                  <p className="text-xs text-zinc-500">
                    Expected:{" "}
                    <span className="font-semibold tabular-nums text-zinc-800 dark:text-zinc-200">
                      ${expectedAmount.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                    </span>
                  </p>
                  {hasAmountMismatch && (
                    <p className="text-xs font-medium text-red-600 dark:text-red-400">
                      {amountShortBy > 0
                        ? `Amount is $${amountShortBy.toLocaleString(undefined, { maximumFractionDigits: 2 })} less than expected — cannot approve.`
                        : `Amount is $${Math.abs(amountShortBy).toLocaleString(undefined, { maximumFractionDigits: 2 })} more than expected — cannot approve.`}
                    </p>
                  )}
                </div>
              </>
            )}

            {alibabaStatus === "Rejected" && (
              <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
                Saving will reject this GM entry (screenshot not required).
              </p>
            )}
          </div>
        </div>

        <DialogFooter className="shrink-0 gap-2 border-t border-zinc-200 bg-white px-6 py-3 dark:border-zinc-800 dark:bg-zinc-900 sm:justify-end">
          <Button variant="secondary" size="sm" onClick={() => onOpenChange(false)} disabled={isPending}>
            Close
          </Button>
          <AccountPrimaryButton
            disabled={isPending || !gmEntry?.id || uploadingScreenshot || !canSave}
            onClick={() => {
              if (alibabaStatus === "Rejected") {
                rejectMutation.mutate();
              } else {
                approveMutation.mutate();
              }
            }}
          >
            {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            {isPending ? "Saving…" : alibabaStatus === "Rejected" ? "Reject entry" : "Save approval"}
          </AccountPrimaryButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
