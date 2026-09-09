import { useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { mutationRequest, queryClient } from "@/lib/queryClient";
import { normalizeRole } from "@/lib/role-utils";

interface Props {
  gmId: string | null;
  companyName?: string;
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

const statusBadge = (s: string) => {
  switch (s) {
    case "APPROVED":
      return "bg-green-500 text-white";
    case "REJECTED":
      return "bg-red-600 text-white";
    case "RETURNED":
      return "bg-green-600 text-white";
    case "OVERDUE":
      return "bg-orange-600 text-white";
    default:
      return "bg-amber-500 text-white";
  }
};

/**
 * Patch 5 Stage 3 (P5) — loan terms, Admin (Super HOD) approval and return
 * tracking for a single loan GM. Recording terms / changing financial figures
 * re-arms the Admin gate (back to PENDING). A loan GM cannot be finally approved
 * until admin_approval_status is APPROVED — that gate is enforced server-side on
 * the existing approval routes.
 */
export function LoanTermsDialog({ gmId, companyName, open, onOpenChange }: Props) {
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
    queryClient.invalidateQueries({ queryKey: ["/api/account/gm-entries"] });
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Loan Terms{companyName ? ` — ${companyName}` : ""}</DialogTitle>
        </DialogHeader>
        {isLoading ? (
          <div className="py-8 text-center text-sm text-gray-400">Loading…</div>
        ) : (
          <div className="space-y-4 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-gray-500">Admin approval:</span>
              <Badge className={statusBadge(terms?.admin_approval_status ?? "PENDING")}>
                {terms?.admin_approval_status ?? "PENDING"}
              </Badge>
              <span className="text-gray-500 ml-2">Return:</span>
              <Badge className={statusBadge(terms?.return_status ?? "PENDING")}>
                {terms?.return_status ?? "PENDING"}
              </Badge>
            </div>
            {terms?.admin_comment && (
              <div className="text-xs text-gray-500">Admin note: {terms.admin_comment}</div>
            )}

            <div className="grid grid-cols-2 gap-2">
              <label className="text-xs text-gray-500">
                Loan amount (USD)
                <Input value={loanAmount} onChange={(e) => setLoanAmount(e.target.value)} />
              </label>
              <label className="text-xs text-gray-500">
                Company co-pay (USD)
                <Input value={copay} onChange={(e) => setCopay(e.target.value)} />
              </label>
              <label className="text-xs text-gray-500 col-span-2">
                Agreed return date
                <Input type="date" value={returnDate} onChange={(e) => setReturnDate(e.target.value)} />
              </label>
            </div>
            <div className="flex justify-end">
              <Button size="sm" disabled={saveTerms.isPending} onClick={() => saveTerms.mutate()}>
                Save Terms
              </Button>
            </div>

            <div className="border-t pt-3 space-y-2">
              <div className="text-xs font-semibold text-gray-500">Return tracking</div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={setReturn.isPending}
                  onClick={() => setReturn.mutate("RETURNED")}
                >
                  Mark Returned
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={setReturn.isPending}
                  onClick={() => setReturn.mutate("PENDING")}
                >
                  Mark Pending
                </Button>
              </div>
            </div>

            {isAdmin && (
              <div className="border-t pt-3 space-y-2">
                <div className="text-xs font-semibold text-gray-500">Admin (Super HOD) decision</div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    className="bg-green-600 hover:bg-green-700"
                    disabled={approve.isPending}
                    onClick={() => approve.mutate()}
                  >
                    Approve Loan
                  </Button>
                </div>
                <div className="flex gap-2 items-center">
                  <Input
                    placeholder="Rejection reason"
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                  />
                  <Button
                    size="sm"
                    variant="destructive"
                    disabled={!rejectReason || reject.isPending}
                    onClick={() => reject.mutate()}
                  >
                    Reject
                  </Button>
                </div>
              </div>
            )}
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
