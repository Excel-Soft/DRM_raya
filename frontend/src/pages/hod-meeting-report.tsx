import { Fragment, useState } from "react";
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
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { apiRequest, apiRequestJson } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

/**
 * Rebuild of a legacy PHP admin report (sale_meeting_report.php, supplied by
 * the user as a spec — ran on a different MySQL system with webxl_hod_meeting
 * and numeric roleId 2/25/48). Real implementation against the current
 * drm.* schema:
 *   1. Meetings — the legacy "meeting" concept (start/end time, the manager
 *      who logged it, type, detail, department/HOD comment) maps directly
 *      onto the already-live drm.meetings table (used elsewhere for "Team
 *      Meeting" start/stop tracking). Dep.Comment/HOD Comment are new
 *      columns added by the backend route (dept_comment/hod_comment).
 *   2. Activities — Sales-Manager -> agent hierarchy (the legacy PHP only
 *      ever iterates roleId 2/25, i.e. Sales, never Service), reusing the
 *      same per-user method/appointment/grade aggregation the dashboard's
 *      Activities widget uses, merged with per-person meeting time/comments
 *      from drm.meetings for the selected range. The legacy TT-Time/D-Time
 *      split has no backing concept here; Spent is talk+appointment minutes
 *      and Free = max(0, 480 - Spent), matching the legacy 8-hour-day math.
 */

function todayMinus(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}
function fmtDateTime(v: string | null): string {
  if (!v) return "-";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? "-" : d.toLocaleString();
}
function fmtDuration(seconds: number | null): string {
  if (seconds == null) return "-";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s}s`;
}

function CommentCell({ value, onAdd }: { value: string | null | undefined; onAdd: () => void }) {
  if (value && value.trim()) {
    return <span className="text-[12px]">{value}</span>;
  }
  return (
    <button onClick={onAdd} className="text-emerald-600 hover:text-emerald-700" title="Add Comment">
      <i className="mdi mdi-plus-circle" style={{ fontSize: 18 }}>+</i>
    </button>
  );
}

// ─── Section 1: Meetings ────────────────────────────────────────────────
interface MeetingRow {
  no: number;
  id: string;
  createDate: string;
  salePerson: string;
  manager: string;
  type: string;
  detail: string;
  durationSeconds: number | null;
  status: string;
  startsAt: string | null;
  endsAt: string | null;
  deptComment: string | null;
  hodComment: string | null;
}

function MeetingsSection() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [startDate, setStartDate] = useState(todayMinus(30));
  const [endDate, setEndDate] = useState(todayMinus(0));
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [commentState, setCommentState] = useState<{ row: MeetingRow; field: "dept" | "hod" } | null>(null);
  const [commentText, setCommentText] = useState("");
  const [saving, setSaving] = useState(false);
  const limit = 20;

  const applied = startDate && endDate ? { startDate, endDate } : null;

  const { data, isLoading, isError } = useQuery<{ rows: MeetingRow[]; total: number }>({
    queryKey: ["/api/reports/hod-meeting/meetings", applied, search, page],
    enabled: !!applied,
    queryFn: () => {
      const p = new URLSearchParams({ startDate, endDate, page: String(page), limit: String(limit) });
      if (search.trim()) p.set("search", search.trim());
      return apiRequestJson("GET", `/api/reports/hod-meeting/meetings?${p.toString()}`);
    },
  });

  const rows = data?.rows ?? [];
  const totalPages = Math.max(1, Math.ceil((data?.total ?? 0) / limit));

  async function submitComment() {
    if (!commentState || !commentText.trim()) {
      toast({ title: "Error", description: "Please enter comment", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const endpoint = commentState.field === "dept" ? "dept-comment" : "hod-comment";
      const res = await apiRequest("POST", `/api/reports/hod-meeting/${commentState.row.id}/${endpoint}`, { comment: commentText.trim() });
      if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.message || "Failed to save comment");
      toast({ title: "Success", description: "Comment added successfully" });
      setCommentState(null);
      setCommentText("");
      queryClient.invalidateQueries({ queryKey: ["/api/reports/hod-meeting/meetings"] });
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
          <h4 className="card-title text-[15px] font-bold text-[#495057] dark:text-zinc-300">Meetings</h4>
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
          <Input placeholder="Search person, manager, type..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
        </div>

        <div className="overflow-x-auto">
          <Table className="text-[12px]">
            <TableHeader>
              <TableRow>
                <TableHead>#</TableHead>
                <TableHead>Create Date</TableHead>
                <TableHead>Sale Person</TableHead>
                <TableHead>Manager</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Detail</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Start</TableHead>
                <TableHead>End</TableHead>
                <TableHead>Dep.Comment</TableHead>
                <TableHead>HOD Comment</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {!applied ? (
                <TableRow><TableCell colSpan={12} className="text-center py-8 text-gray-500">Please select filter to see the data</TableCell></TableRow>
              ) : isLoading ? (
                <TableRow><TableCell colSpan={12} className="text-center py-8 text-gray-500">Loading...</TableCell></TableRow>
              ) : isError ? (
                <TableRow><TableCell colSpan={12} className="text-center py-8 text-rose-600">Failed to load meetings.</TableCell></TableRow>
              ) : rows.length === 0 ? (
                <TableRow><TableCell colSpan={12} className="text-center py-8 text-gray-500">No records found.</TableCell></TableRow>
              ) : (
                rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>{r.no}</TableCell>
                    <TableCell className="whitespace-nowrap">{fmtDateTime(r.createDate)}</TableCell>
                    <TableCell className="font-medium">{r.salePerson}</TableCell>
                    <TableCell>{r.manager}</TableCell>
                    <TableCell>{r.type}</TableCell>
                    <TableCell className="max-w-[160px] truncate">{r.detail}</TableCell>
                    <TableCell className="whitespace-nowrap">{fmtDuration(r.durationSeconds)}</TableCell>
                    <TableCell>
                      <span className={r.status === "Complete" ? "text-emerald-600 font-semibold" : "text-amber-600 font-semibold"}>{r.status}</span>
                    </TableCell>
                    <TableCell className="whitespace-nowrap">{fmtDateTime(r.startsAt)}</TableCell>
                    <TableCell className="whitespace-nowrap">{fmtDateTime(r.endsAt)}</TableCell>
                    <TableCell>
                      <CommentCell value={r.deptComment} onAdd={() => { setCommentState({ row: r, field: "dept" }); setCommentText(""); }} />
                    </TableCell>
                    <TableCell>
                      <CommentCell value={r.hodComment} onAdd={() => { setCommentState({ row: r, field: "hod" }); setCommentText(""); }} />
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

      <Dialog open={!!commentState} onOpenChange={(o) => !o && setCommentState(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{commentState?.field === "dept" ? "Add Dep. Comment" : "Add HOD Comment"}</DialogTitle></DialogHeader>
          <Textarea rows={4} placeholder="Enter comment" value={commentText} onChange={(e) => setCommentText(e.target.value)} />
          <DialogFooter>
            <Button onClick={submitComment} disabled={saving}>{saving ? "Saving..." : "Submit"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

// ─── Section 2: Activities (Sales Manager -> agent hierarchy) ──────────
interface ActivityMethod { done: number; target: number; minutes?: number }
interface MeetingActivityRow {
  userId: string;
  name: string;
  role: string;
  isManager: boolean;
  managerId: string | null;
  methods: {
    mobile: ActivityMethod; whatsapp: ActivityMethod; whCall: ActivityMethod;
    inMeeting: ActivityMethod; onsite: ActivityMethod; email: ActivityMethod;
    seminar: ActivityMethod; webinar: ActivityMethod; appointment: ActivityMethod;
    meeting: ActivityMethod; aMinus: ActivityMethod; bPlus: ActivityMethod;
  };
  totals: { activities: number; timeMinutes: number };
  meetingMinutes: number;
  meetingCount: number;
  spentMinutes: number;
  freeMinutes: number;
  latestMeetingId: string | null;
  mComment: string | null;
  deptComment: string | null;
  hodComment: string | null;
}
interface ActivitiesResponse { rows: MeetingActivityRow[] }

const METHOD_COLUMNS: { key: keyof MeetingActivityRow["methods"]; label: string }[] = [
  { key: "mobile", label: "Mob" },
  { key: "whatsapp", label: "WA" },
  { key: "onsite", label: "Site" },
  { key: "email", label: "Mail" },
  { key: "seminar", label: "Sem" },
  { key: "webinar", label: "Web" },
  { key: "appointment", label: "Apt" },
  { key: "aMinus", label: "A-" },
  { key: "bPlus", label: "B+" },
];

function MeetingActivitiesSection() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [startDate, setStartDate] = useState(todayMinus(30));
  const [endDate, setEndDate] = useState(todayMinus(0));
  const [applied, setApplied] = useState<{ start: string; end: string }>({ start: startDate, end: endDate });
  const [commentState, setCommentState] = useState<{ row: MeetingActivityRow; field: "dept" | "hod" } | null>(null);
  const [commentText, setCommentText] = useState("");
  const [saving, setSaving] = useState(false);

  const { data, isLoading, isError } = useQuery<ActivitiesResponse>({
    queryKey: ["/api/reports/hod-meeting/activities", applied],
    queryFn: () => apiRequestJson("GET", `/api/reports/hod-meeting/activities?startDate=${applied.start}&endDate=${applied.end}`),
  });
  const rows = data?.rows ?? [];

  const managers = rows.filter((r) => r.isManager);
  const groups = managers.map((m) => ({
    manager: m,
    agents: rows.filter((r) => r.managerId === m.userId),
  }));
  const assignedIds = new Set(groups.flatMap((g) => [g.manager.userId, ...g.agents.map((a) => a.userId)]));
  const ungrouped = rows.filter((r) => !assignedIds.has(r.userId));

  function subtotal(group: MeetingActivityRow[]): Record<string, number> {
    const out: Record<string, number> = { spentMinutes: 0, freeMinutes: 0, meetingMinutes: 0 };
    for (const col of METHOD_COLUMNS) out[col.key] = 0;
    for (const r of group) {
      for (const col of METHOD_COLUMNS) out[col.key] += r.methods[col.key]?.done ?? 0;
      out.spentMinutes += r.spentMinutes ?? 0;
      out.freeMinutes += r.freeMinutes ?? 0;
      out.meetingMinutes += r.meetingMinutes ?? 0;
    }
    return out;
  }
  const grandTotal = subtotal(rows);
  const colSpanAll = METHOD_COLUMNS.length + 7;

  async function submitComment() {
    if (!commentState || !commentText.trim() || !commentState.row.latestMeetingId) {
      toast({ title: "Error", description: "Please enter comment", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const endpoint = commentState.field === "dept" ? "dept-comment" : "hod-comment";
      const res = await apiRequest("POST", `/api/reports/hod-meeting/${commentState.row.latestMeetingId}/${endpoint}`, { comment: commentText.trim() });
      if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.message || "Failed to save comment");
      toast({ title: "Success", description: "Comment added successfully" });
      setCommentState(null);
      setCommentText("");
      queryClient.invalidateQueries({ queryKey: ["/api/reports/hod-meeting/activities"] });
      queryClient.invalidateQueries({ queryKey: ["/api/reports/hod-meeting/meetings"] });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  function renderRow(r: MeetingActivityRow, indent: boolean) {
    return (
      <TableRow key={r.userId} className={r.isManager ? "bg-slate-100 dark:bg-zinc-800/60 font-semibold" : ""}>
        <TableCell className={indent ? "pl-8" : "font-medium"}>{r.name}</TableCell>
        {METHOD_COLUMNS.map((c) => (
          <TableCell key={c.key} className="text-center">{r.methods[c.key]?.done ?? 0}</TableCell>
        ))}
        <TableCell className="text-center">{Math.round(r.spentMinutes)}m</TableCell>
        <TableCell className="text-center">{Math.round(r.freeMinutes)}m</TableCell>
        <TableCell className="text-center">{Math.round(r.meetingMinutes)}m</TableCell>
        <TableCell className="max-w-[140px] truncate" title={r.mComment ?? undefined}>{r.mComment || "-"}</TableCell>
        <TableCell>
          {r.latestMeetingId ? (
            <CommentCell value={r.deptComment} onAdd={() => { setCommentState({ row: r, field: "dept" }); setCommentText(""); }} />
          ) : "-"}
        </TableCell>
        <TableCell>
          {r.latestMeetingId ? (
            <CommentCell value={r.hodComment} onAdd={() => { setCommentState({ row: r, field: "hod" }); setCommentText(""); }} />
          ) : "-"}
        </TableCell>
      </TableRow>
    );
  }

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex flex-wrap items-end justify-between gap-3 mb-4">
          <h4 className="card-title text-[15px] font-bold text-[#495057] dark:text-zinc-300">Activities</h4>
          <div className="flex items-end gap-2">
            <div className="space-y-1.5">
              <Label className="text-xs text-gray-500">Start Date</Label>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-gray-500">End Date</Label>
              <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
            <Button onClick={() => setApplied({ start: startDate, end: endDate })}>View</Button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <Table className="text-[12px]">
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                {METHOD_COLUMNS.map((c) => <TableHead key={c.key} className="text-center">{c.label}</TableHead>)}
                <TableHead className="text-center">Spent</TableHead>
                <TableHead className="text-center">Free</TableHead>
                <TableHead className="text-center">M-Time</TableHead>
                <TableHead>M-Comment</TableHead>
                <TableHead>Dept-Comment</TableHead>
                <TableHead>HOD-Comment</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={colSpanAll} className="text-center py-6 text-gray-500">Loading...</TableCell></TableRow>
              ) : isError ? (
                <TableRow><TableCell colSpan={colSpanAll} className="text-center py-6 text-rose-600">Failed to load activities.</TableCell></TableRow>
              ) : rows.length === 0 ? (
                <TableRow><TableCell colSpan={colSpanAll} className="text-center py-6 text-gray-500">No records found.</TableCell></TableRow>
              ) : (
                <>
                  {groups.map((g) => {
                    const teamTotal = subtotal([g.manager, ...g.agents]);
                    return (
                      <Fragment key={g.manager.userId}>
                        {renderRow(g.manager, false)}
                        {g.agents.map((a) => renderRow(a, true))}
                        <TableRow className="font-semibold bg-gray-50 dark:bg-zinc-900">
                          <TableCell>Team Total ({g.agents.length + 1})</TableCell>
                          {METHOD_COLUMNS.map((c) => <TableCell key={c.key} className="text-center">{teamTotal[c.key]}</TableCell>)}
                          <TableCell className="text-center">{Math.round(teamTotal.spentMinutes)}m</TableCell>
                          <TableCell className="text-center">{Math.round(teamTotal.freeMinutes)}m</TableCell>
                          <TableCell className="text-center">{Math.round(teamTotal.meetingMinutes)}m</TableCell>
                          <TableCell /><TableCell /><TableCell />
                        </TableRow>
                      </Fragment>
                    );
                  })}
                  {ungrouped.map((r) => renderRow(r, false))}
                </>
              )}
            </TableBody>
            {rows.length > 0 && (
              <TableFooter>
                <TableRow className="font-bold bg-gray-100 dark:bg-zinc-800">
                  <TableCell>Grand Total ({rows.length})</TableCell>
                  {METHOD_COLUMNS.map((c) => <TableCell key={c.key} className="text-center">{grandTotal[c.key]}</TableCell>)}
                  <TableCell className="text-center">{Math.round(grandTotal.spentMinutes)}m</TableCell>
                  <TableCell className="text-center">{Math.round(grandTotal.freeMinutes)}m</TableCell>
                  <TableCell className="text-center">{Math.round(grandTotal.meetingMinutes)}m</TableCell>
                  <TableCell /><TableCell /><TableCell />
                </TableRow>
              </TableFooter>
            )}
          </Table>
        </div>
      </CardContent>

      <Dialog open={!!commentState} onOpenChange={(o) => !o && setCommentState(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{commentState?.field === "dept" ? "Add Dept Comment" : "Add HOD Comment"}</DialogTitle></DialogHeader>
          <Textarea rows={4} placeholder="Enter comment" value={commentText} onChange={(e) => setCommentText(e.target.value)} />
          <DialogFooter>
            <Button onClick={submitComment} disabled={saving}>{saving ? "Saving..." : "Submit"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

export default function HodMeetingReport() {
  return (
    <div className="p-6 space-y-6">
      <h4 className="mb-0 font-size-18 text-xl font-bold text-[#495057] dark:text-zinc-300">Follow-Up Meeting Report</h4>
      <MeetingsSection />
      <MeetingActivitiesSection />
    </div>
  );
}
