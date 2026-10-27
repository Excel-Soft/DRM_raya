import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { apiRequest, apiRequestJson } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

/**
 * Rebuild of a legacy PHP admin report (quotation_report.php, gated
 * role_id===48/HOD only there). Unlike the HOD dashboard's "Pending
 * Quotation" tab (GET /api/sales/quotations/hod-pending — an actionable
 * queue that drops a row the moment it's decided), this is a browsable
 * date-ranged history of every quotation regardless of status.
 *
 * The legacy page let the HOD pick any of Pending/Approved/Rejected from a
 * plain <select> and posted it straight to the DB. Our real workflow is
 * more guarded (POST /api/quotations/:id/hod-approve and .../hod-reject —
 * confirmed_at is required first, an approved quotation can't be
 * re-rejected, rejecting needs a reason), so instead of a free status
 * dropdown this reuses those same existing, already-validated endpoints via
 * explicit Approve/Reject actions. "isLocked" from the backend mirrors the
 * legacy is_locked (already approved, or already converted to an Invoice/GM).
 */

const STATUS_OPTIONS = ["Pending", "Approved", "Rejected"];

function todayMinus(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}
function firstDayOfMonth(): string {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
}
function fmtDate(v: string | null): string {
  if (!v) return "-";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? "-" : d.toLocaleDateString();
}
function fmtMoney(n: number): string {
  return `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

interface QuotationReportRow {
  no: number;
  id: string;
  date: string;
  companyName: string;
  services: string;
  grandTotal: number;
  hodStatus: "approved" | "rejected" | null;
  hodComment: string | null;
  confirmed: boolean;
  isLocked: boolean;
}

function StatusBadge({ row }: { row: QuotationReportRow }) {
  if (row.hodStatus === "approved") {
    return <span className="text-emerald-600 font-semibold text-[12px]">Approved</span>;
  }
  if (row.hodStatus === "rejected") {
    return (
      <span className="text-rose-600 font-semibold text-[12px]" title={row.hodComment ?? undefined}>
        Rejected
      </span>
    );
  }
  if (!row.confirmed) {
    return <span className="text-gray-400 font-medium text-[12px]">Awaiting Confirmation</span>;
  }
  return <span className="text-amber-600 font-semibold text-[12px]">Pending</span>;
}

export default function QuotationReport() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const [startDate, setStartDate] = useState(firstDayOfMonth());
  const [endDate, setEndDate] = useState(todayMinus(0));
  const [status, setStatus] = useState<string>("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [rejectRow, setRejectRow] = useState<QuotationReportRow | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [actingId, setActingId] = useState<string | null>(null);
  const limit = 20;

  const applied = startDate && endDate ? { startDate, endDate, status } : null;

  const { data, isLoading, isError } = useQuery<{ rows: QuotationReportRow[]; total: number }>({
    queryKey: ["/api/reports/quotation-report", applied, search, page],
    enabled: !!applied,
    queryFn: () => {
      const p = new URLSearchParams({ startDate, endDate, page: String(page), limit: String(limit) });
      if (status) p.set("status", status);
      if (search.trim()) p.set("search", search.trim());
      return apiRequestJson("GET", `/api/reports/quotation-report?${p.toString()}`);
    },
  });

  const rows = data?.rows ?? [];
  const totalPages = Math.max(1, Math.ceil((data?.total ?? 0) / limit));

  function refresh() {
    queryClient.invalidateQueries({ queryKey: ["/api/reports/quotation-report"] });
  }

  async function approve(row: QuotationReportRow) {
    setActingId(row.id);
    try {
      const res = await apiRequest("POST", `/api/quotations/${row.id}/hod-approve`);
      if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.message || "Failed to approve quotation");
      toast({ title: "Quotation approved" });
      refresh();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setActingId(null);
    }
  }

  async function submitReject() {
    if (!rejectRow || !rejectReason.trim()) {
      toast({ title: "Error", description: "Please enter a rejection reason", variant: "destructive" });
      return;
    }
    setActingId(rejectRow.id);
    try {
      const res = await apiRequest("POST", `/api/quotations/${rejectRow.id}/hod-reject`, { reason: rejectReason.trim() });
      if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.message || "Failed to reject quotation");
      toast({ title: "Quotation rejected", variant: "destructive" });
      setRejectRow(null);
      setRejectReason("");
      refresh();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setActingId(null);
    }
  }

  return (
    <div className="p-6 space-y-6">
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-end justify-between gap-3 mb-4">
            <h4 className="card-title text-xl font-bold text-[#495057] dark:text-zinc-300">Quotation Report</h4>
            <div className="flex items-end gap-2">
              <div className="space-y-1.5">
                <Label className="text-xs text-gray-500">From</Label>
                <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-gray-500">To</Label>
                <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-gray-500">Status</Label>
                <Select value={status || "ALL"} onValueChange={(v) => { setStatus(v === "ALL" ? "" : v); setPage(1); }}>
                  <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All Status</SelectItem>
                    {STATUS_OPTIONS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={() => setPage(1)}>Filter</Button>
            </div>
          </div>

          <div className="mb-3 max-w-[260px]">
            <Input placeholder="Search company..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
          </div>

          <div className="overflow-x-auto">
            <Table className="text-[12px]">
              <TableHeader>
                <TableRow>
                  <TableHead>Quotation ID</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Company Name</TableHead>
                  <TableHead>Services</TableHead>
                  <TableHead>Grand Total</TableHead>
                  <TableHead>HOD Status</TableHead>
                  <TableHead>Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {!applied ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-8 text-gray-500">Please select filter to see the data</TableCell></TableRow>
                ) : isLoading ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-8 text-gray-500">Loading...</TableCell></TableRow>
                ) : isError ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-8 text-rose-600">Failed to load report.</TableCell></TableRow>
                ) : rows.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-8 text-gray-500">No quotations found</TableCell></TableRow>
                ) : (
                  rows.map((r) => {
                    const canDecide = r.confirmed && !r.isLocked && r.hodStatus !== "approved";
                    const busy = actingId === r.id;
                    return (
                      <TableRow key={r.id}>
                        <TableCell className="font-mono text-[11px]" title={r.id}>{r.id.slice(0, 8)}</TableCell>
                        <TableCell className="whitespace-nowrap">{fmtDate(r.date)}</TableCell>
                        <TableCell className="font-medium">{r.companyName}</TableCell>
                        <TableCell className="max-w-[220px] truncate" title={r.services}>{r.services}</TableCell>
                        <TableCell className="whitespace-nowrap">{fmtMoney(r.grandTotal)}</TableCell>
                        <TableCell>
                          <StatusBadge row={r} />
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setLocation(`/sales/quotation?id=${r.id}&view=1`)}
                            >
                              View
                            </Button>
                            {canDecide && (
                              <>
                                <Button size="sm" disabled={busy} onClick={() => approve(r)}>Approve</Button>
                                <Button
                                  variant="destructive"
                                  size="sm"
                                  disabled={busy}
                                  onClick={() => { setRejectRow(r); setRejectReason(""); }}
                                >
                                  Reject
                                </Button>
                              </>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>

          {applied && rows.length > 0 && (
            <div className="flex items-center justify-between mt-3 text-[12px] text-gray-500">
              <span>Page {page} of {totalPages}</span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
                <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Next</Button>
              </div>
            </div>
          )}
        </CardContent>

        <Dialog open={!!rejectRow} onOpenChange={(o) => !o && setRejectRow(null)}>
          <DialogContent>
            <DialogHeader><DialogTitle>Reject Quotation</DialogTitle></DialogHeader>
            <Textarea rows={4} placeholder="Enter rejection reason" value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} />
            <DialogFooter>
              <Button variant="destructive" onClick={submitReject} disabled={actingId === rejectRow?.id}>
                {actingId === rejectRow?.id ? "Saving..." : "Submit"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </Card>
    </div>
  );
}
