import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Landmark } from "lucide-react";
import { LoanTermsDialog } from "@/components/gm/LoanTermsDialog";

interface QueueRow {
  id: string;
  companyName: string;
  drmId: string | null;
  amountUsd: string;
  agreedReturnDate: string | null;
  adminApprovalStatus: string;
}
interface ReportSummary {
  total: number;
  returned: number;
  overdue: number;
  pending: number;
}

const fmt = (n: any) =>
  `$${Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

/**
 * Patch 5 Stage 3 (P5) — Super HOD loan oversight panel. Surfaces the pending
 * admin-approval queue (loan GMs whose terms still need Admin sign-off before
 * final approval) and a return / overdue summary. Opening a row reuses
 * LoanTermsDialog so the Admin can approve, reject, or adjust terms in place.
 */
export function LoanAdminQueuePanel() {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState<QueueRow | null>(null);

  const { data: queueData } = useQuery<any>({
    queryKey: ["/api/gm-pool/loan-admin-queue"],
    select: (raw: any) => raw?.data,
  });
  const { data: reportData } = useQuery<any>({
    queryKey: ["/api/gm-pool/loan-return-report"],
    select: (raw: any) => raw?.data,
  });

  const queue: QueueRow[] = queueData?.entries || [];
  const summary: ReportSummary = reportData?.summary || { total: 0, returned: 0, overdue: 0, pending: 0 };

  return (
    <>
      <Card className="border-none shadow-sm overflow-hidden">
        <CardHeader className="pb-2 pt-4 px-6 bg-white dark:bg-zinc-900">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-bold text-slate-800 dark:text-zinc-100 flex items-center gap-2">
              <Landmark className="h-4 w-4 text-amber-600" />
              Loan Admin Approval
            </CardTitle>
            <div className="flex items-center gap-2 text-[11px]">
              <Badge className="bg-amber-500 text-white">Pending {queue.length}</Badge>
              <Badge className="bg-green-600 text-white">Returned {summary.returned}</Badge>
              <Badge className="bg-orange-600 text-white">Overdue {summary.overdue}</Badge>
              <Badge className="bg-slate-500 text-white">Out {summary.pending}</Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="px-6 pb-4">
          {queue.length === 0 ? (
            <div className="text-center py-6 text-sm text-slate-400">No loan GMs awaiting admin approval</div>
          ) : (
            <div className="max-h-64 overflow-auto">
              <table className="w-full text-xs">
                <thead className="text-slate-500">
                  <tr>
                    <th className="px-2 py-1 text-left">Company</th>
                    <th className="px-2 py-1 text-left">DRM</th>
                    <th className="px-2 py-1 text-right">Amount</th>
                    <th className="px-2 py-1 text-left">Return by</th>
                    <th className="px-2 py-1" />
                  </tr>
                </thead>
                <tbody>
                  {queue.map((r) => (
                    <tr key={r.id} className="border-t border-slate-100 dark:border-zinc-800">
                      <td className="px-2 py-1.5 font-medium">{r.companyName}</td>
                      <td className="px-2 py-1.5">{r.drmId || "—"}</td>
                      <td className="px-2 py-1.5 text-right">{fmt(r.amountUsd)}</td>
                      <td className="px-2 py-1.5">
                        {r.agreedReturnDate ? new Date(r.agreedReturnDate).toLocaleDateString() : "—"}
                      </td>
                      <td className="px-2 py-1.5 text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-[11px]"
                          onClick={() => {
                            setActive(r);
                            setOpen(true);
                          }}
                        >
                          Review
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <LoanTermsDialog
        gmId={active?.id ?? null}
        companyName={active?.companyName}
        open={open}
        onOpenChange={setOpen}
      />
    </>
  );
}
