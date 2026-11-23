import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, apiRequestJson, queryClient } from "@/lib/queryClient";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { normalizeRole } from "@/lib/role-utils";
import { format, differenceInMinutes } from "date-fns";
import { Calendar as CalendarIcon, Pencil } from "lucide-react";
import { RoleGroupedUserSelect } from "@/components/role-grouped-user-select";

// Old DRM "Attendence System" page. Options "All Female" / "All Male" list every
// old user of that gender (like the old select); a single user also shows the
// old "Salary Distribution Found" box.
const GENDER_OPTIONS = [
  { value: "Female", label: "All Female" },
  { value: "Male", label: "All Male" },
];
const isGenderValue = (v: string | null | undefined) => v === "Female" || v === "Male";

// Roles that save the old modal directly (backend: OLD_VIEW_DIRECT_SAVE_ROLES);
// everyone else submits an "old_view" edit request for approval.
const DIRECT_SAVE_ROLES = ["admin", "super_hod", "hod", "account_manager"];
const TIME_RE = /^([01]?\d|2[0-3]):[0-5]\d$/;
const LATE_RE = /^\d{1,3}:[0-5]?\d$/;

type SalaryDistribution = {
  status: "success" | "error";
  message?: string;
  total_users: number;
  salary_users: Array<{ user_id: string; name: string | null }>;
};

// Old "Attendance" modal: Name (read-only), Time In, Time Out, late/absent.
type EditForm = {
  userId: string;
  name: string;
  date: string;
  timeIn: string;
  timeOut: string;
  lateAbsent: string;
  reason: string;
  original: { timeIn: string; timeOut: string; lateAbsent: string };
};

function parseApiError(err: any): { status: number | null; body: any } {
  const msg = String(err?.message ?? "");
  const m = msg.match(/^(\d{3}):\s*([\s\S]*)$/);
  if (!m) return { status: null, body: null };
  let body: any = m[2];
  try { body = JSON.parse(m[2]); } catch { /* keep raw text */ }
  return { status: Number(m[1]), body };
}

export default function AttendanceReport() {
  const { toast } = useToast();
  const [selectedUser, setSelectedUser] = useState<string>("");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [fetchParams, setFetchParams] = useState<{ userId: string; startDate: string; endDate: string } | null>(null);
  const [page, setPage] = useState(1);
  const [editForm, setEditForm] = useState<EditForm | null>(null);
  const PAGE_SIZE = 50;
  const canSaveDirect = DIRECT_SAVE_ROLES.includes(normalizeRole(sessionStorage.getItem("userRole") || ""));

  // Fetch users for the dropdown
  const { data: users = [] } = useQuery<any[]>({
    queryKey: ["/api/account/users-list"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/account/users-list");
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      // A non-2xx body is JSON too (e.g. {error:"..."}) — guard so a
      // permission/server error can never be .forEach'd as if it were the
      // user array and crash the whole page.
      return Array.isArray(data) ? data : [];
    }
  });

  // Old func.php 'get_user_salary': shown as soon as a single user is chosen.
  const singleUser = selectedUser && !isGenderValue(selectedUser) ? selectedUser : "";
  const { data: salaryDist } = useQuery<SalaryDistribution | null>({
    queryKey: ["/api/attendance/salary-distribution", singleUser],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/attendance/salary-distribution?userId=${encodeURIComponent(singleUser)}`);
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!singleUser,
  });

  // Fetch attendance records based on selected params
  const { data: attendanceData = { records: [] }, isLoading } = useQuery<any>({
    queryKey: ["/api/attendance", fetchParams, page],
    queryFn: async () => {
      if (!fetchParams) return { records: [] };
      const { userId, startDate, endDate } = fetchParams;
      let url = `/api/attendance?page=${page}&pageSize=${PAGE_SIZE}&`;
      if (userId) url += `userId=${encodeURIComponent(userId)}&`;
      if (startDate) url += `startDate=${startDate}&`;
      if (endDate) url += `endDate=${endDate}`;

      const res = await apiRequest("GET", url);
      return res.json();
    },
    enabled: !!fetchParams
  });

  const saveEdit = useMutation({
    mutationFn: async (vars: { f: EditForm; overrideReason?: string }) => {
      const { f } = vars;
      const timeIn = f.timeIn.trim();
      const timeOut = f.timeOut.trim();
      const lateAbsent = f.lateAbsent.trim().toLowerCase() === "true" ? "True" : f.lateAbsent.trim();
      if (timeIn && !TIME_RE.test(timeIn)) throw new Error("local: Time In must be HH:MM (e.g. 09:00)");
      if (timeOut && !TIME_RE.test(timeOut)) throw new Error("local: Time Out must be HH:MM (e.g. 18:00)");
      if (lateAbsent !== "True" && !LATE_RE.test(lateAbsent)) {
        throw new Error("local: late/absent must be H:M (e.g. 0:37) or True");
      }
      const values = { timeIn, timeOut, lateAbsent };
      if (canSaveDirect) {
        return apiRequestJson(
          "PATCH",
          `/api/attendance/old-view/${encodeURIComponent(f.userId)}/${f.date}`,
          vars.overrideReason ? { ...values, overrideReason: vars.overrideReason } : values,
        );
      }
      if (!f.reason.trim()) throw new Error("local: A reason is required");
      return apiRequestJson("POST", "/api/attendance/edits", {
        userId: f.userId,
        attendanceDate: f.date,
        field: "old_view",
        beforeValue: JSON.stringify(f.original),
        afterValue: JSON.stringify(values),
        reason: f.reason.trim(),
      });
    },
    onSuccess: () => {
      if (canSaveDirect) {
        queryClient.invalidateQueries({ queryKey: ["/api/attendance"] });
        queryClient.invalidateQueries({ queryKey: ["/api/attendance/monthly-sheet"] });
        toast({ title: "Attendance updated", description: "Monthly totals were recalculated." });
      } else {
        queryClient.invalidateQueries({ queryKey: ["/api/attendance/edits"] });
        toast({ title: "Edit request submitted", description: "It is listed under Reports → Edit Attendance for approval." });
      }
      setEditForm(null);
    },
    onError: (err: any, vars) => {
      const msg = String(err?.message || "");
      if (msg.startsWith("local: ")) {
        toast({ title: msg.slice(7), variant: "destructive" });
        return;
      }
      const { status, body } = parseApiError(err);
      if (status === 423 && body?.salaryLocked && !vars.overrideReason && normalizeRole(sessionStorage.getItem("userRole") || "") === "admin") {
        const reason = window.prompt(
          "This employee's salary for that month is finalized/locked.\nEnter an admin override reason to apply this change anyway:",
        );
        if (reason && reason.trim()) saveEdit.mutate({ f: vars.f, overrideReason: reason.trim() });
        return;
      }
      toast({
        title: "Could not save attendance",
        description: body?.error || "Please check the fields and try again.",
        variant: "destructive",
      });
    },
  });

  const handleView = () => {
    setFetchParams({ userId: selectedUser, startDate, endDate });
    setPage(1);
  };
  const total = Number(attendanceData?.total ?? attendanceData?.records?.length ?? 0);
  const totalPages = Math.max(1, Number(attendanceData?.totalPages) || Math.ceil(total / PAGE_SIZE));
  const genderView = attendanceData?.mode === "gender" || isGenderValue(fetchParams?.userId);
  const colCount = genderView ? 8 : 9;
  const totals = attendanceData?.totals as
    | { totalLateMinutes: number; totalLateLabel: string; totalCuttingAmount: number }
    | null
    | undefined;

  const calculateLate = (timeIn: string | null) => {
    if (!timeIn) return "-";
    const checkInDate = new Date(timeIn);
    const expectedCheckIn = new Date(checkInDate);
    expectedCheckIn.setHours(9, 0, 0, 0); // Assuming 09:00 AM is the check-in time

    if (checkInDate > expectedCheckIn) {
      const diffMinutes = differenceInMinutes(checkInDate, expectedCheckIn);
      const hours = Math.floor(diffMinutes / 60);
      const minutes = diffMinutes % 60;
      return `${hours}:${minutes}`;
    }
    return "0:0";
  };

  const openEdit = (record: any) => {
    const original = {
      timeIn: record.timeInText ?? "",
      timeOut: record.timeOutText ?? "",
      lateAbsent: record.lateAbsentLabel ?? "",
    };
    setEditForm({
      userId: record.userId,
      name: record.name ?? "",
      date: record.dateText ?? (record.date ? format(new Date(record.date), "yyyy-MM-dd") : ""),
      ...original,
      reason: "",
      original,
    });
  };

  const handleSave = () => {
    if (!editForm) return;
    if (!window.confirm("Are you sure to Update Attendance?")) return;
    saveEdit.mutate({ f: editForm });
  };

  const cell = "py-3 px-3 text-slate-600 dark:text-zinc-400 font-medium";

  return (
    <div className="p-6 max-w-[1600px] mx-auto space-y-6">
      <h1 className="text-xl font-bold text-slate-700 dark:text-zinc-200 uppercase tracking-widest mb-6">
        ATTENDANCE SYSTEM
      </h1>

      <Card className="border-none shadow-sm dark:bg-zinc-900">
        <CardContent className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-600 dark:text-zinc-400">Select User</label>
              <RoleGroupedUserSelect
                users={users}
                value={selectedUser}
                onChange={setSelectedUser}
                extraOptions={GENDER_OPTIONS}
                placeholder="Choose..."
                className="bg-white dark:bg-zinc-800"
              />
              {singleUser && salaryDist?.status === "success" && (
                <div className="rounded border border-sky-200 bg-sky-50 dark:border-sky-900 dark:bg-sky-950/40 p-3 text-xs text-slate-700 dark:text-zinc-300">
                  <div className="font-bold text-sky-700 dark:text-sky-300">Salary Distribution Found</div>
                  <div className="mt-1 font-semibold">Total Users Found: {salaryDist.total_users}</div>
                  <ul className="mt-1 space-y-0.5">
                    {salaryDist.salary_users.map((u) => (
                      <li key={u.user_id}>ID: {u.user_id} - Name: {u.name ?? ""}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            <div className="space-y-2 relative">
              <label className="text-sm font-semibold text-slate-600 dark:text-zinc-400">Start Date</label>
              <div className="relative">
                <Input
                  type="date"
                  className="bg-white dark:bg-zinc-800 pl-3 pr-10"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
                <CalendarIcon className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
              </div>
            </div>

            <div className="space-y-2 relative">
              <label className="text-sm font-semibold text-slate-600 dark:text-zinc-400">End Date</label>
              <div className="relative">
                <Input
                  type="date"
                  className="bg-white dark:bg-zinc-800 pl-3 pr-10"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
                <CalendarIcon className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
              </div>
            </div>
          </div>

          <div className="mt-6">
            <Button
              onClick={handleView}
              className="bg-[#00a65a] hover:bg-[#008d4c] text-white font-medium px-8"
            >
              View
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="border-none shadow-sm dark:bg-zinc-900 mt-6">
        <div className="p-4 border-b border-slate-100 dark:border-zinc-800">
          <h2 className="font-semibold text-slate-700 dark:text-zinc-300">Attendance View</h2>
        </div>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-center whitespace-nowrap">
              <thead className="bg-red-100/70 dark:bg-red-900/20 text-slate-700 dark:text-zinc-300">
                <tr>
                  <th className="py-3 px-3 font-bold">Name</th>
                  <th className="py-3 px-3 font-bold">Net Salary</th>
                  <th className="py-3 px-3 font-bold">Drm Time</th>
                  <th className="py-3 px-3 font-bold">Time In</th>
                  <th className="py-3 px-3 font-bold">Time Out</th>
                  <th className="py-3 px-3 font-bold">Late / Absent</th>
                  <th className="py-3 px-3 font-bold">Cutting Min RS</th>
                  <th className="py-3 px-3 font-bold">Date</th>
                  {!genderView && <th className="py-3 px-3 font-bold">Action</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                {isLoading ? (
                  <tr>
                    <td colSpan={colCount} className="py-8 text-slate-500">Loading attendance data...</td>
                  </tr>
                ) : !attendanceData.records || attendanceData.records.length === 0 ? (
                  <tr>
                    <td colSpan={colCount} className="py-8 text-slate-500">No records found. Please select a user and date range.</td>
                  </tr>
                ) : (
                  attendanceData.records.map((record: any) => (
                    <tr key={`${record.source ?? ""}-${record.id}`} className="hover:bg-slate-50/50 dark:hover:bg-zinc-800/50 transition-colors bg-slate-50/30 dark:bg-zinc-900">
                      {/* Old-DRM rows carry the old page's own text (Pakistan time, late/absent
                          label); new-app rows fall back to formatting the timestamps. */}
                      <td className={cell}>{record.name ?? ""}</td>
                      <td className={cell}>{record.netSalary ?? ""}</td>
                      <td className={cell}>{record.drmTime ?? ""}</td>
                      <td className={cell}>
                        {record.timeInText ?? (record.timeIn ? format(new Date(record.timeIn), 'HH:mm') : '-')}
                      </td>
                      <td className={cell}>
                        {record.timeOutText ?? (record.timeOut ? format(new Date(record.timeOut), 'HH:mm') : '-')}
                      </td>
                      <td className={cell}>
                        {record.lateAbsentLabel ?? (record.status === "Absent" ? "Absent" : calculateLate(record.timeIn))}
                      </td>
                      <td className={cell}>{record.cuttingLabel ?? ""}</td>
                      <td className={cell}>
                        {record.dateText ?? (record.date ? format(new Date(record.date), 'yyyy-MM-dd') : '-')}
                      </td>
                      {!genderView && (
                        <td className={cell}>
                          {record.userId ? (
                            <button
                              type="button"
                              onClick={() => openEdit(record)}
                              className="text-[#00a65a] hover:text-[#008d4c]"
                              title="Request an attendance edit"
                              aria-label="Edit attendance"
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                          ) : null}
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
              {/* Old single-user footer: Total ... late total under Late / Absent, RS total
                  under Cutting Min RS (the old Ramzan cells were always blank). */}
              {!genderView && totals && attendanceData.records?.length > 0 && (
                <tfoot>
                  <tr className="bg-[#f8f9fa] dark:bg-zinc-800 font-bold text-slate-700 dark:text-zinc-200">
                    <td className="py-3 px-3">Total</td>
                    <td />
                    <td />
                    <td />
                    <td />
                    <td className="py-3 px-3">{totals.totalLateLabel} ({totals.totalLateMinutes} min)</td>
                    <td className="py-3 px-3">RS {totals.totalCuttingAmount}</td>
                    <td />
                    <td />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
          {total > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-3 p-4 text-sm text-slate-500">
              <span>
                Showing {(page - 1) * PAGE_SIZE + 1} to {Math.min(page * PAGE_SIZE, total)} of {total} {genderView ? "rows" : "days"}
              </span>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>Previous</Button>
                <span>Page {page} of {totalPages}</span>
                <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>Next</Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pencil: the old "Attendance" modal. Admin / Super HOD / HOD / Account
          Manager save directly (day + month totals recalculated); other roles
          submit it as an edit request for approval. */}
      <Dialog open={!!editForm} onOpenChange={(open) => { if (!open) setEditForm(null); }}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>Attendance</DialogTitle>
          </DialogHeader>
          {editForm && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 py-2">
              <div className="space-y-1">
                <Label className="text-xs font-semibold text-slate-500">Name</Label>
                <Input value={editForm.name} readOnly className="h-8 text-xs" />
                <p className="text-[11px] text-slate-400">{editForm.date}</p>
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-semibold text-slate-500">Time In</Label>
                <Input
                  value={editForm.timeIn}
                  placeholder="09:00"
                  onChange={(e) => setEditForm((f) => (f ? { ...f, timeIn: e.target.value } : f))}
                  className="h-8 text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-semibold text-slate-500">Time Out</Label>
                <Input
                  value={editForm.timeOut}
                  placeholder="18:00"
                  onChange={(e) => setEditForm((f) => (f ? { ...f, timeOut: e.target.value } : f))}
                  className="h-8 text-xs"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-semibold text-slate-500">late/absent</Label>
                <Input
                  value={editForm.lateAbsent}
                  placeholder="0"
                  onChange={(e) => setEditForm((f) => (f ? { ...f, lateAbsent: e.target.value } : f))}
                  className="h-8 text-xs"
                />
              </div>
              {!canSaveDirect && (
                <div className="space-y-1 sm:col-span-2">
                  <Label className="text-xs font-semibold text-slate-500">
                    Reason <span className="text-[#d9534f] dark:text-red-400">*</span>
                  </Label>
                  <Textarea
                    value={editForm.reason}
                    onChange={(e) => setEditForm((f) => (f ? { ...f, reason: e.target.value } : f))}
                    placeholder="Your change is sent for approval. Why is it needed?"
                    className="text-xs min-h-[64px]"
                  />
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditForm(null)} className="h-8 px-4 text-xs">Close</Button>
            <Button
              onClick={handleSave}
              disabled={saveEdit.isPending}
              className="h-8 px-4 bg-[#556ee6] hover:bg-[#485ec4] text-white text-xs font-bold shadow-sm"
            >
              {saveEdit.isPending ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
