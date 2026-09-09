import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, AlertCircle } from "lucide-react";

export type ApprovalDecision = "approve" | "reject";

export interface ApprovalActionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Title of the record being acted on (e.g. invoice number, employee name). */
  recordTitle: string;
  currentStatus?: string;
  nextAction?: string;
  actorRole?: string;
  /** Require remarks for the given decisions. Default: reject only. */
  requireRemarksFor?: ApprovalDecision[];
  /** When true, an extra confirmation checkbox must be ticked (destructive). */
  destructive?: boolean;
  confirmLabel?: string;
  approveLabel?: string;
  rejectLabel?: string;
  /** Hide the reject button (approve-only flows). */
  hideReject?: boolean;
  /** Called with the chosen decision + remarks. May be async; modal shows a spinner. */
  onSubmit: (decision: ApprovalDecision, remarks: string) => void | Promise<void>;
}

/**
 * ApprovalActionModal — shared approve/reject confirmation dialog (Stage 10,
 * section C). Frontend convenience only; the backend remains the source of
 * truth for permissions and required reasons. It enforces remarks and the
 * destructive-confirmation checkbox before calling `onSubmit`, and surfaces any
 * thrown error inline instead of an alert().
 */
export function ApprovalActionModal({
  open,
  onOpenChange,
  recordTitle,
  currentStatus,
  nextAction,
  actorRole,
  requireRemarksFor = ["reject"],
  destructive = false,
  confirmLabel = "I understand this action cannot be undone.",
  approveLabel = "Approve",
  rejectLabel = "Reject",
  hideReject = false,
  onSubmit,
}: ApprovalActionModalProps) {
  const [remarks, setRemarks] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setRemarks("");
      setConfirmed(false);
      setSubmitting(false);
      setError(null);
    }
  }, [open]);

  const handle = async (decision: ApprovalDecision) => {
    setError(null);
    if (requireRemarksFor.includes(decision) && !remarks.trim()) {
      setError("A reason / remark is required for this action.");
      return;
    }
    if (destructive && !confirmed) {
      setError("Please confirm before continuing.");
      return;
    }
    try {
      setSubmitting(true);
      await onSubmit(decision, remarks.trim());
      onOpenChange(false);
    } catch (e: any) {
      setError(e?.message || "Action failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !submitting && onOpenChange(o)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-[15px]">{recordTitle}</DialogTitle>
          <DialogDescription className="text-[12px] space-y-0.5">
            {currentStatus && <div>Current status: <span className="font-semibold">{currentStatus}</span></div>}
            {nextAction && <div>Next action: <span className="font-semibold">{nextAction}</span></div>}
            {actorRole && <div>Acting as: <span className="font-semibold">{actorRole}</span></div>}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-1">
          <div>
            <label className="block text-[12px] font-semibold text-slate-600 mb-1 dark:text-zinc-400">
              Remarks {requireRemarksFor.length > 0 && <span className="text-rose-500">*</span>}
            </label>
            <Textarea
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="Add a reason / remark…"
              className="text-[13px] min-h-[80px]"
              disabled={submitting}
            />
          </div>

          {destructive && (
            <label className="flex items-start gap-2 text-[12px] text-slate-600 dark:text-zinc-400">
              <Checkbox checked={confirmed} onCheckedChange={(v) => setConfirmed(!!v)} disabled={submitting} />
              <span>{confirmLabel}</span>
            </label>
          )}

          {error && (
            <p className="flex items-center gap-1 text-[12px] text-rose-600" role="alert">
              <AlertCircle className="w-3.5 h-3.5" /> {error}
            </p>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting} className="text-[13px]">Cancel</Button>
          {!hideReject && (
            <Button variant="destructive" onClick={() => handle("reject")} disabled={submitting} className="text-[13px]">
              {submitting && <Loader2 className="w-4 h-4 animate-spin mr-1" />} {rejectLabel}
            </Button>
          )}
          <Button onClick={() => handle("approve")} disabled={submitting} className="text-[13px]">
            {submitting && <Loader2 className="w-4 h-4 animate-spin mr-1" />} {approveLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default ApprovalActionModal;
