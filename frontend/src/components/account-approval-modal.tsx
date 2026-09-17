import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
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
import { mutationRequest, getAuthHeader } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

const AMOUNT_MATCH_EPSILON = 0.01;

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
  const canSave =
    !requiresAmountVerification ||
    (!!screenshotUrl && enteredAmountNum !== null && !hasAmountMismatch);

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

          {requiresAmountVerification && (
            <>
              <div>
                <Label className="text-sm font-medium">Payment Screenshot</Label>
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
              </div>

              <div>
                <Label className="text-sm font-medium">Amount in Screenshot</Label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="Enter amount shown in screenshot"
                  className="mt-1"
                  value={enteredAmount}
                  onChange={(e) => setEnteredAmount(e.target.value)}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Expected: ${expectedAmount.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                </p>
                {hasAmountMismatch && (
                  <p className="text-xs text-red-600 font-medium mt-1">
                    {amountShortBy > 0
                      ? `This amount is $${amountShortBy.toLocaleString(undefined, { maximumFractionDigits: 2 })} less than expected — cannot approve.`
                      : `This amount is $${Math.abs(amountShortBy).toLocaleString(undefined, { maximumFractionDigits: 2 })} more than expected — cannot approve.`}
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
