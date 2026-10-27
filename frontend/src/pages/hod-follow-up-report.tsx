import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
 * Rebuild of a legacy PHP admin report (the user supplied the old PHP source
 * as a spec — it ran on a different system entirely with numeric service ids
 * and PHP controllers this app has no source for). Two independent sections:
 *   1. Sale Teams Activity/Follow Up Report — real drill-down (main service
 *      -> sub type -> grade) backed by drm.followup_subservice_details.
 *   2. Service Team Follow Up Report — same columns as the existing Diagnose
 *      Report (drm.diagnose_followups), which has no service/grade columns,
 *      so no drill-down is offered there — date range + search only.
 * Both support an "HOD Comment" add action (new hod_comment column on each
 * backing table — didn't exist before this).
 */

const MAIN_SERVICES = [
  { code: "ALIBABA_MEMBERSHIP", name: "Alibaba Membership" },
  { code: "ALIBABA_SERVICES", name: "Alibaba Services" },
  { code: "DESIGN_DEVELOPMENT", name: "Design Development" },
  { code: "DOMAIN_HOSTING", name: "Domain Hosting" },
  { code: "AI_SERVICES", name: "AI Services" },
];

function todayMinus(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}
function fmtDate(v: string | null): string {
  if (!v) return "-";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? "-" : d.toLocaleDateString();
}

function HodCommentCell({ value, onAdd }: { value: string | null | undefined; onAdd: () => void }) {
  if (value && value.trim()) {
    return <span className="text-[12px]">{value}</span>;
  }
  return (
    <button onClick={onAdd} className="text-emerald-600 hover:text-emerald-700" title="Add HOD Comment">
      <i className="mdi mdi-plus-circle" style={{ fontSize: 18 }}>+</i>
    </button>
  );
}

// ─── Section 1 ────────────────────────────────────────────────────────────
interface SaleRow {
  no: number;
  id: string;
  followupId: string;
  salePerson: string;
  companyName: string;
  mainService: string;
  subType: string;
  grade: string;
  purpose: string;
  method: string;
  nextDate: string | null;
  comment: string;
  createdDate: string;
  followupNote: string;
  managerComment: string | null;
  smComment: string | null;
  hodComment: string | null;
}

function SaleTeamsFollowUpSection() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [startDate, setStartDate] = useState(todayMinus(30));
  const [endDate, setEndDate] = useState(todayMinus(0));
  const [serviceCode, setServiceCode] = useState("");
  const [subserviceCode, setSubserviceCode] = useState("");
  const [grade, setGrade] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [commentRow, setCommentRow] = useState<SaleRow | null>(null);
  const [commentText, setCommentText] = useState("");
  const [saving, setSaving] = useState(false);
  const limit = 20;

  const applied = startDate && endDate ? { startDate, endDate } : null;

  const { data: countsData } = useQuery<{ counts: { code: string; name: string; total: number }[] }>({
    queryKey: ["/api/reports/hod-follow-up/sale/service-counts", applied],
    enabled: !!applied,
    queryFn: () => apiRequestJson("GET", `/api/reports/hod-follow-up/sale/service-counts?startDate=${startDate}&endDate=${endDate}`),
  });

  const { data: typeSummary } = useQuery<{ items: { code: string; name: string; total: number }[] }>({
    queryKey: ["/api/reports/hod-follow-up/sale/service-type-summary", applied, serviceCode],
    enabled: !!applied && !!serviceCode,
    queryFn: () => apiRequestJson("GET", `/api/reports/hod-follow-up/sale/service-type-summary?startDate=${startDate}&endDate=${endDate}&serviceCode=${serviceCode}`),
  });

  const { data: gradeSummary } = useQuery<{ items: { grade: string; total: number }[] }>({
    queryKey: ["/api/reports/hod-follow-up/sale/grade-summary", applied, serviceCode, subserviceCode],
    enabled: !!applied && !!serviceCode && !!subserviceCode,
    queryFn: () => apiRequestJson("GET", `/api/reports/hod-follow-up/sale/grade-summary?startDate=${startDate}&endDate=${endDate}&serviceCode=${serviceCode}&subserviceCode=${subserviceCode}`),
  });

  const { data, isLoading, isError } = useQuery<{ rows: SaleRow[]; total: number }>({
    queryKey: ["/api/reports/hod-follow-up/sale/data", applied, serviceCode, subserviceCode, grade, search, page],
    enabled: !!applied,
    queryFn: () => {
      const p = new URLSearchParams({ startDate, endDate, page: String(page), limit: String(limit) });
      if (serviceCode) p.set("serviceCode", serviceCode);
      if (subserviceCode) p.set("subserviceCode", subserviceCode);
      if (grade) p.set("grade", grade);
      if (search.trim()) p.set("search", search.trim());
      return apiRequestJson("GET", `/api/reports/hod-follow-up/sale/data?${p.toString()}`);
    },
  });

  const rows = data?.rows ?? [];
  const totalPages = Math.max(1, Math.ceil((data?.total ?? 0) / limit));

  function pickService(code: string) {
    setServiceCode(code);
    setSubserviceCode("");
    setGrade("");
    setPage(1);
  }
  function pickSubservice(code: string) {
    setSubserviceCode(code);
    setGrade("");
    setPage(1);
  }
  function pickGrade(g: string) {
    setGrade(g);
    setPage(1);
  }

  async function submitComment() {
    if (!commentRow || !commentText.trim()) {
      toast({ title: "Error", description: "Please enter comment", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const res = await apiRequest("POST", `/api/reports/hod-follow-up/sale/${commentRow.followupId}/hod-comment`, { comment: commentText.trim() });
      if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.message || "Failed to save comment");
      toast({ title: "Success", description: "HOD comment added successfully" });
      setCommentRow(null);
      setCommentText("");
      queryClient.invalidateQueries({ queryKey: ["/api/reports/hod-follow-up/sale/data"] });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex flex-wrap items-end justify-between gap-3 mb-4">
          <h4 className="card-title text-[15px] font-bold text-[#495057] dark:text-zinc-300">Sale Teams Activity/Follow Up Report</h4>
          <div className="flex items-end gap-2">
            <div className="space-y-1.5">
              <Label className="text-xs text-gray-500">From</Label>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-gray-500">To</Label>
              <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
            <Button onClick={() => setPage(1)}>Filter</Button>
          </div>
        </div>

        {/* Main service filter bar */}
        <div className="flex w-full rounded-md overflow-hidden mb-3 border border-slate-200 dark:border-zinc-800">
          {MAIN_SERVICES.map((s) => {
            const total = countsData?.counts.find((c) => c.code === s.code)?.total ?? 0;
            return (
              <button
                key={s.code}
                onClick={() => pickService(s.code)}
                className={`flex-1 h-9 text-[12px] font-semibold text-white transition-colors ${serviceCode === s.code ? "bg-[#1e293b]" : "bg-[#059669] hover:bg-[#047857]"}`}
              >
                {s.name} <span className="font-bold">{total}</span>
              </button>
            );
          })}
        </div>

        {serviceCode && typeSummary?.items && typeSummary.items.length > 0 && (
          <div className="mb-3 rounded-md border border-slate-200 dark:border-zinc-800 p-2">
            <div className="text-xs font-semibold text-gray-500 mb-1.5">Service Type Summary</div>
            <div className="flex flex-wrap gap-1.5">
              {typeSummary.items.map((it) => (
                <button
                  key={it.code}
                  onClick={() => pickSubservice(it.code)}
                  className={`text-[11px] px-2 py-1 rounded-md border transition-colors ${subserviceCode === it.code ? "bg-[#059669] text-white border-[#059669]" : "border-slate-300 text-slate-600 hover:bg-slate-50 dark:border-zinc-700 dark:text-zinc-300"}`}
                >
                  {it.name} ({it.total})
                </button>
              ))}
            </div>
          </div>
        )}

        {subserviceCode && gradeSummary?.items && gradeSummary.items.length > 0 && (
          <div className="mb-3 rounded-md border border-slate-200 dark:border-zinc-800 p-2">
            <div className="text-xs font-semibold text-gray-500 mb-1.5">Grade Summary</div>
            <div className="flex flex-wrap gap-1.5">
              {gradeSummary.items.map((it) => (
                <button
                  key={it.grade}
                  onClick={() => pickGrade(it.grade)}
                  className={`text-[11px] px-2 py-1 rounded-md border transition-colors ${grade === it.grade ? "bg-slate-800 text-white border-slate-800" : "border-slate-300 text-slate-600 hover:bg-slate-50 dark:border-zinc-700 dark:text-zinc-300"}`}
                >
                  {it.grade} ({it.total})
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="mb-3 max-w-[260px]">
          <Input placeholder="Search company or person..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
        </div>

        <div className="overflow-x-auto">
          <Table className="text-[12px]">
            <TableHeader>
              <TableRow>
                <TableHead>#</TableHead>
                <TableHead>Sale Person</TableHead>
                <TableHead>Company</TableHead>
                <TableHead>Main Service</TableHead>
                <TableHead>Sub Type</TableHead>
                <TableHead>Grade</TableHead>
                <TableHead>Purpose</TableHead>
                <TableHead>Method</TableHead>
                <TableHead>Next Date</TableHead>
                <TableHead>Comment</TableHead>
                <TableHead>Created Date</TableHead>
                <TableHead>Followup Note</TableHead>
                <TableHead>Manager Comment</TableHead>
                <TableHead>SM Comment</TableHead>
                <TableHead>HOD Comment</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {!applied ? (
                <TableRow><TableCell colSpan={15} className="text-center py-8 text-gray-500">Please select filter to see the data</TableCell></TableRow>
              ) : isLoading ? (
                <TableRow><TableCell colSpan={15} className="text-center py-8 text-gray-500">Loading...</TableCell></TableRow>
              ) : isError ? (
                <TableRow><TableCell colSpan={15} className="text-center py-8 text-rose-600">Failed to load report.</TableCell></TableRow>
              ) : rows.length === 0 ? (
                <TableRow><TableCell colSpan={15} className="text-center py-8 text-gray-500">No records found.</TableCell></TableRow>
              ) : (
                rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>{r.no}</TableCell>
                    <TableCell className="font-medium">{r.salePerson}</TableCell>
                    <TableCell>{r.companyName}</TableCell>
                    <TableCell>{r.mainService}</TableCell>
                    <TableCell>{r.subType}</TableCell>
                    <TableCell>{r.grade}</TableCell>
                    <TableCell>{r.purpose}</TableCell>
                    <TableCell>{r.method}</TableCell>
                    <TableCell className="whitespace-nowrap">{fmtDate(r.nextDate)}</TableCell>
                    <TableCell className="max-w-[160px] truncate">{r.comment}</TableCell>
                    <TableCell className="whitespace-nowrap">{fmtDate(r.createdDate)}</TableCell>
                    <TableCell className="max-w-[160px] truncate">{r.followupNote}</TableCell>
                    <TableCell className="max-w-[140px] truncate" title={r.managerComment ?? undefined}>{r.managerComment || "-"}</TableCell>
                    <TableCell className="max-w-[140px] truncate" title={r.smComment ?? undefined}>{r.smComment || "-"}</TableCell>
                    <TableCell>
                      <HodCommentCell value={r.hodComment} onAdd={() => { setCommentRow(r); setCommentText(""); }} />
                    </TableCell>
                  </TableRow>
                ))
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

      <Dialog open={!!commentRow} onOpenChange={(o) => !o && setCommentRow(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add HOD Comment</DialogTitle></DialogHeader>
          <Textarea rows={4} placeholder="Enter HOD comment" value={commentText} onChange={(e) => setCommentText(e.target.value)} />
          <DialogFooter>
            <Button onClick={submitComment} disabled={saving}>{saving ? "Saving..." : "Submit"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

// ─── Section 2 ────────────────────────────────────────────────────────────
interface ServiceRow {
  no: number;
  id: string;
  companyName: string;
  salePerson: string;
  report: string;
  startRating: string;
  upSelling: string;
  rfq: string;
  products: string;
  followRate: string;
  sample: string;
  order: string;
  revenue: string;
  happyAlibaba: string;
  happyWebxl: string;
  createdDate: string;
  hodComment: string | null;
}

function ServiceTeamFollowUpSection() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [startDate, setStartDate] = useState(todayMinus(30));
  const [endDate, setEndDate] = useState(todayMinus(0));
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [commentRow, setCommentRow] = useState<ServiceRow | null>(null);
  const [commentText, setCommentText] = useState("");
  const [saving, setSaving] = useState(false);
  const limit = 20;

  const applied = startDate && endDate ? { startDate, endDate } : null;

  const { data, isLoading, isError } = useQuery<{ rows: ServiceRow[]; total: number }>({
    queryKey: ["/api/reports/hod-follow-up/service/data", applied, search, page],
    enabled: !!applied,
    queryFn: () => {
      const p = new URLSearchParams({ startDate, endDate, page: String(page), limit: String(limit) });
      if (search.trim()) p.set("search", search.trim());
      return apiRequestJson("GET", `/api/reports/hod-follow-up/service/data?${p.toString()}`);
    },
  });

  const rows = data?.rows ?? [];
  const totalPages = Math.max(1, Math.ceil((data?.total ?? 0) / limit));

  async function submitComment() {
    if (!commentRow || !commentText.trim()) {
      toast({ title: "Error", description: "Please enter comment", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const res = await apiRequest("POST", `/api/reports/hod-follow-up/service/${commentRow.id}/hod-comment`, { comment: commentText.trim() });
      if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.message || "Failed to save comment");
      toast({ title: "Success", description: "HOD comment added successfully" });
      setCommentRow(null);
      setCommentText("");
      queryClient.invalidateQueries({ queryKey: ["/api/reports/hod-follow-up/service/data"] });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex flex-wrap items-end justify-between gap-3 mb-4">
          <h4 className="card-title text-[15px] font-bold text-[#495057] dark:text-zinc-300">Service Team Follow Up Report</h4>
          <div className="flex items-end gap-2">
            <div className="space-y-1.5">
              <Label className="text-xs text-gray-500">From</Label>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-gray-500">To</Label>
              <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
            <Button onClick={() => setPage(1)}>Filter</Button>
          </div>
        </div>

        <div className="mb-3 max-w-[260px]">
          <Input placeholder="Search company or person..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
        </div>

        <div className="overflow-x-auto">
          <Table className="text-[12px]">
            <TableHeader>
              <TableRow>
                <TableHead>#</TableHead>
                <TableHead>Company</TableHead>
                <TableHead>User</TableHead>
                <TableHead>Report</TableHead>
                <TableHead>Start Rating</TableHead>
                <TableHead>Up Selling</TableHead>
                <TableHead>RFQ</TableHead>
                <TableHead>Products</TableHead>
                <TableHead>Follow Rate</TableHead>
                <TableHead>Sample</TableHead>
                <TableHead>Order</TableHead>
                <TableHead>Revenue</TableHead>
                <TableHead>Happy Alibaba</TableHead>
                <TableHead>Happy Webxl</TableHead>
                <TableHead>Created Date</TableHead>
                <TableHead>HOD Comment</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {!applied ? (
                <TableRow><TableCell colSpan={16} className="text-center py-8 text-gray-500">Please select filter to see the data</TableCell></TableRow>
              ) : isLoading ? (
                <TableRow><TableCell colSpan={16} className="text-center py-8 text-gray-500">Loading...</TableCell></TableRow>
              ) : isError ? (
                <TableRow><TableCell colSpan={16} className="text-center py-8 text-rose-600">Failed to load report.</TableCell></TableRow>
              ) : rows.length === 0 ? (
                <TableRow><TableCell colSpan={16} className="text-center py-8 text-gray-500">No records found.</TableCell></TableRow>
              ) : (
                rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>{r.no}</TableCell>
                    <TableCell className="font-medium">{r.companyName}</TableCell>
                    <TableCell>{r.salePerson}</TableCell>
                    <TableCell className="max-w-[160px] truncate">{r.report}</TableCell>
                    <TableCell>{r.startRating}</TableCell>
                    <TableCell>{r.upSelling}</TableCell>
                    <TableCell>{r.rfq}</TableCell>
                    <TableCell className="max-w-[140px] truncate">{r.products}</TableCell>
                    <TableCell>{r.followRate}</TableCell>
                    <TableCell>{r.sample}</TableCell>
                    <TableCell>{r.order}</TableCell>
                    <TableCell>{r.revenue}</TableCell>
                    <TableCell>{r.happyAlibaba}</TableCell>
                    <TableCell>{r.happyWebxl}</TableCell>
                    <TableCell className="whitespace-nowrap">{fmtDate(r.createdDate)}</TableCell>
                    <TableCell>
                      <HodCommentCell value={r.hodComment} onAdd={() => { setCommentRow(r); setCommentText(""); }} />
                    </TableCell>
                  </TableRow>
                ))
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

      <Dialog open={!!commentRow} onOpenChange={(o) => !o && setCommentRow(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add HOD Comment</DialogTitle></DialogHeader>
          <Textarea rows={4} placeholder="Enter HOD comment" value={commentText} onChange={(e) => setCommentText(e.target.value)} />
          <DialogFooter>
            <Button onClick={submitComment} disabled={saving}>{saving ? "Saving..." : "Submit"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

export default function HodFollowUpReport() {
  return (
    <div className="p-6 space-y-6">
      <h4 className="mb-0 font-size-18 text-xl font-bold text-[#495057] dark:text-zinc-300">Follow Up Report</h4>
      <SaleTeamsFollowUpSection />
      <ServiceTeamFollowUpSection />
    </div>
  );
}
