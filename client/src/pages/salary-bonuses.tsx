import { useMemo, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequestJson, queryClient } from "@/lib/queryClient";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

// ---------------------------------------------------------------------------
// Types mirror the server bonus shapes (drm.employee_bonuses + joined names).
// ---------------------------------------------------------------------------
type Bonus = {
  id: string;
  user_id: string;
  period_month: number;
  period_year: number;
  amount: string | number | null;
  reason: string | null;
  status: string;
  approved_by_user_id: string | null;
  approved_at: string | null;
  created_by_user_id: string | null;
  created_at: string;
  employee_name: string | null;
  employee_department: string | null;
  employee_branch: string | null;
  approved_by_name: string | null;
  created_by_name: string | null;
};

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const now = new Date();

// UI-only role gating (server enforces the real rules). Bonus management is
// limited to admin/super_hod, accounts, and HR — the same set as salary edit.
function canManageBonus() {
  const r = (sessionStorage.getItem("userRole") || "").toLowerCase().replace(/\s+/g, "_");
  const full = r.includes("super_admin") || r.includes("administrator") || r === "admin" || r.includes("super_hod");
  const accounts = r.includes("account");
  const hr = /\bhr\b/.test(r) || r.includes("hr_") || r === "hr" || r.includes("human_resource");
  return full || accounts || hr;
}

function fmt(n: number) {
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function statusBadge(status: string) {
  const s = status.toUpperCase();
  const cls = s === "APPROVED"
    ? "bg-[#dff0d8] text-[#3c763d]"
    : s === "REJECTED"
    ? "bg-[#f2dede] text-[#a94442]"
    : "bg-[#fcf8e3] text-[#8a6d3b]";
  return <span className={`inline-block px-2 py-0.5 rounded-sm text-[11px] font-semibold ${cls}`}>{s}</span>;
}

export default function SalaryBonuses() {
  const { toast } = useToast();
  const canManage = useMemo(canManageBonus, []);

  const [month, setMonth] = useState(String(now.getMonth() + 1));
  const [year, setYear] = useState(String(now.getFullYear()));
  const [statusFilter, setStatusFilter] = useState("all");

  // New-bonus form state.
  const [formEmployee, setFormEmployee] = useState("");
  const [formMonth, setFormMonth] = useState(String(now.getMonth() + 1));
  const [formYear, setFormYear] = useState(String(now.getFullYear()));
  const [formAmount, setFormAmount] = useState("");
  const [formReason, setFormReason] = useState("");

  const years = Array.from({ length: 6 }, (_, i) => String(now.getFullYear() - i));

  const employeesQuery = useQuery<{ users: { id: string; fullName: string }[] }>({
    queryKey: ["/api/users", "salary-bonuses"],
    queryFn: async () => apiRequestJson("GET", "/api/users"),
    enabled: canManage,
  });
  const employees = employeesQuery.data?.users ?? [];

  const qs = useMemo(() => {
    const p = new URLSearchParams({ month, year });
    if (statusFilter !== "all") p.set("status", statusFilter);
    return p.toString();
  }, [month, year, statusFilter]);

  const bonusesQuery = useQuery<{ bonuses: Bonus[] }>({
    queryKey: ["/api/salary/bonuses", qs],
    queryFn: async () => apiRequestJson("GET", `/api/salary/bonuses?${qs}`),
    enabled: canManage,
  });
  const bonuses = bonusesQuery.data?.bonuses ?? [];

  function describeError(err: any, fallback: string) {
    const msg = String(err?.message || "");
    if (/403/.test(msg)) return "You are not authorized for this action.";
    if (/404/.test(msg)) return "The employee or bonus could not be found.";
    if (/409/.test(msg)) return "Only pending bonuses can be changed.";
    if (/400/.test(msg)) return "Please check the values and try again.";
    return fallback;
  }

  const createBonus = useMutation({
    mutationFn: async () =>
      apiRequestJson("POST", "/api/salary/bonuses", {
        userId: formEmployee,
        month: Number(formMonth),
        year: Number(formYear),
        amount: Number(formAmount) || 0,
        reason: formReason.trim() || null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/salary/bonuses"] });
      setFormAmount("");
      setFormReason("");
      toast({ title: "Bonus added", description: "It is now pending approval." });
    },
    onError: (err: any) => {
      toast({ title: "Unable to add bonus", description: describeError(err, "Could not create the bonus."), variant: "destructive" });
    },
  });

  const setStatus = useMutation({
    mutationFn: async (vars: { id: string; status: "APPROVED" | "REJECTED" }) =>
      apiRequestJson("PATCH", `/api/salary/bonuses/${vars.id}/status`, { status: vars.status }),
    onSuccess: (_d, vars) => {
      queryClient.invalidateQueries({ queryKey: ["/api/salary/bonuses"] });
      toast({ title: `Bonus ${vars.status.toLowerCase()}`, description: "Status updated." });
    },
    onError: (err: any) => {
      toast({ title: "Action failed", description: describeError(err, "Could not update the bonus."), variant: "destructive" });
    },
  });

  const removeBonus = useMutation({
    mutationFn: async (id: string) => apiRequestJson("DELETE", `/api/salary/bonuses/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/salary/bonuses"] });
      toast({ title: "Bonus removed", description: "The pending bonus was deleted." });
    },
    onError: (err: any) => {
      toast({ title: "Unable to remove bonus", description: describeError(err, "Could not delete the bonus."), variant: "destructive" });
    },
  });

  const canSubmit = formEmployee !== "" && formAmount !== "" && Number(formAmount) >= 0 && !createBonus.isPending;

  const approvedTotal = bonuses
    .filter((b) => b.status.toUpperCase() === "APPROVED")
    .reduce((a, b) => a + (Number(b.amount) || 0), 0);

  if (!canManage) {
    return (
      <div className="flex-1 overflow-auto bg-[#f4f6f9] min-h-screen">
        <div className="p-4 max-w-[1400px] mx-auto space-y-6">
          <h1 className="text-[17px] font-bold uppercase text-[#555]">EMPLOYEE BONUSES</h1>
          <Card className="border-none shadow-sm bg-white rounded-sm">
            <CardContent className="p-8 text-center text-[#d9534f] text-sm">
              You are not authorized to manage employee bonuses.
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto bg-[#f4f6f9] min-h-screen">
      <div className="p-4 max-w-[1400px] mx-auto space-y-6">
        <h1 className="text-[17px] font-bold uppercase text-[#555]">EMPLOYEE BONUSES</h1>

        {/* Create a bonus */}
        <Card className="border-none shadow-sm bg-white rounded-sm">
          <CardContent className="p-4 space-y-4">
            <h2 className="text-[13px] font-bold uppercase text-[#777]">Add Bonus</h2>
            <div className="flex flex-wrap items-end gap-4">
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs font-bold text-[#555]">Employee</Label>
                <Select value={formEmployee} onValueChange={setFormEmployee}>
                  <SelectTrigger className="h-9 w-[220px] bg-white border-slate-200 text-[13px] focus:ring-0"><SelectValue placeholder="Select employee" /></SelectTrigger>
                  <SelectContent>
                    {employees.map((e) => <SelectItem key={e.id} value={e.id}>{e.fullName || e.id}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs font-bold text-[#555]">Month</Label>
                <Select value={formMonth} onValueChange={setFormMonth}>
                  <SelectTrigger className="h-9 w-[140px] bg-white border-slate-200 text-[13px] focus:ring-0"><SelectValue /></SelectTrigger>
                  <SelectContent>{MONTHS.map((m, i) => <SelectItem key={m} value={String(i + 1)}>{m}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs font-bold text-[#555]">Year</Label>
                <Select value={formYear} onValueChange={setFormYear}>
                  <SelectTrigger className="h-9 w-[100px] bg-white border-slate-200 text-[13px] focus:ring-0"><SelectValue /></SelectTrigger>
                  <SelectContent>{years.map((y) => <SelectItem key={y} value={y}>{y}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs font-bold text-[#555]">Amount</Label>
                <Input type="number" min="0" step="0.01" value={formAmount} placeholder="0.00"
                  onChange={(e) => setFormAmount(e.target.value)}
                  className="h-9 w-[140px] bg-white border-slate-200 text-[13px] rounded-sm focus-visible:ring-0" />
              </div>
              <div className="flex flex-col gap-1.5 flex-1 min-w-[200px]">
                <Label className="text-xs font-bold text-[#555]">Reason</Label>
                <Input value={formReason} placeholder="Reason (optional)"
                  onChange={(e) => setFormReason(e.target.value)}
                  className="h-9 bg-white border-slate-200 text-[13px] rounded-sm focus-visible:ring-0" />
              </div>
              <Button onClick={() => createBonus.mutate()} disabled={!canSubmit}
                className="bg-[#00a65a] hover:bg-[#008d4c] text-white px-5 font-semibold h-9 rounded-sm">
                {createBonus.isPending ? "Adding..." : "Add Bonus"}
              </Button>
            </div>
            <p className="text-xs text-slate-500">
              New bonuses start as <b>Pending</b>. Only <b>Approved</b> bonuses for the matching
              period flow into the salary preview.
            </p>
          </CardContent>
        </Card>

        {/* Bonus list */}
        <Card className="border-none shadow-sm bg-white rounded-sm">
          <CardContent className="p-4 space-y-4">
            <div className="flex flex-wrap items-end gap-4">
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs font-bold text-[#555]">Month</Label>
                <Select value={month} onValueChange={setMonth}>
                  <SelectTrigger className="h-9 w-[150px] bg-white border-slate-200 text-[13px] focus:ring-0"><SelectValue /></SelectTrigger>
                  <SelectContent>{MONTHS.map((m, i) => <SelectItem key={m} value={String(i + 1)}>{m}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs font-bold text-[#555]">Year</Label>
                <Select value={year} onValueChange={setYear}>
                  <SelectTrigger className="h-9 w-[110px] bg-white border-slate-200 text-[13px] focus:ring-0"><SelectValue /></SelectTrigger>
                  <SelectContent>{years.map((y) => <SelectItem key={y} value={y}>{y}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs font-bold text-[#555]">Status</Label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="h-9 w-[150px] bg-white border-slate-200 text-[13px] focus:ring-0"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All statuses</SelectItem>
                    <SelectItem value="PENDING">Pending</SelectItem>
                    <SelectItem value="APPROVED">Approved</SelectItem>
                    <SelectItem value="REJECTED">Rejected</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="ml-auto text-[13px] text-[#555]">
                Approved total: <b>{fmt(approvedTotal)}</b>
              </div>
            </div>

            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-[12px]">Employee</TableHead>
                    <TableHead className="text-[12px]">Department</TableHead>
                    <TableHead className="text-[12px]">Period</TableHead>
                    <TableHead className="text-[12px] text-right">Amount</TableHead>
                    <TableHead className="text-[12px]">Reason</TableHead>
                    <TableHead className="text-[12px]">Status</TableHead>
                    <TableHead className="text-[12px]">Approved By</TableHead>
                    <TableHead className="text-[12px] text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {bonusesQuery.isLoading ? (
                    <TableRow><TableCell colSpan={8} className="text-center text-sm text-slate-500 py-6">Loading...</TableCell></TableRow>
                  ) : bonuses.length === 0 ? (
                    <TableRow><TableCell colSpan={8} className="text-center text-sm text-slate-500 py-6">No bonuses for this period.</TableCell></TableRow>
                  ) : bonuses.map((b) => {
                    const pending = b.status.toUpperCase() === "PENDING";
                    const busy = setStatus.isPending || removeBonus.isPending;
                    return (
                      <TableRow key={b.id}>
                        <TableCell className="text-[12px] font-medium">{b.employee_name || b.user_id}</TableCell>
                        <TableCell className="text-[12px]">{b.employee_department || "—"}</TableCell>
                        <TableCell className="text-[12px]">{MONTHS[b.period_month - 1]} {b.period_year}</TableCell>
                        <TableCell className="text-[12px] text-right">{fmt(Number(b.amount) || 0)}</TableCell>
                        <TableCell className="text-[12px] max-w-[220px] truncate" title={b.reason || ""}>{b.reason || "—"}</TableCell>
                        <TableCell className="text-[12px]">{statusBadge(b.status)}</TableCell>
                        <TableCell className="text-[12px]">
                          {b.approved_by_name
                            ? <>{b.approved_by_name}{b.approved_at ? <div className="text-[10px] text-slate-400">{new Date(b.approved_at).toLocaleDateString()}</div> : null}</>
                            : "—"}
                        </TableCell>
                        <TableCell className="text-[12px] text-right">
                          {pending ? (
                            <div className="flex justify-end gap-1.5">
                              <Button size="sm" disabled={busy}
                                onClick={() => setStatus.mutate({ id: b.id, status: "APPROVED" })}
                                className="bg-[#00a65a] hover:bg-[#008d4c] text-white h-7 px-2.5 text-[11px] rounded-sm">Approve</Button>
                              <Button size="sm" disabled={busy}
                                onClick={() => setStatus.mutate({ id: b.id, status: "REJECTED" })}
                                className="bg-[#dd4b39] hover:bg-[#c9302c] text-white h-7 px-2.5 text-[11px] rounded-sm">Reject</Button>
                              <Button size="sm" variant="outline" disabled={busy}
                                onClick={() => removeBonus.mutate(b.id)}
                                className="h-7 px-2.5 text-[11px] rounded-sm">Delete</Button>
                            </div>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
