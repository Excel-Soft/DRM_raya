import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Pencil } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequestJson, queryClient } from "@/lib/queryClient";

// Old DRM "edit-att" ATTENDANCE REPORT: one row per employee for a month, from the monthly
// attendance totals (late minutes, leaves). Formula in /api/attendance/monthly-sheet.

type SheetRow = {
  userId: string;
  name: string;
  branch: string | null;
  lateHour: number;
  lateMin: number;
  halfLeave: number;
  leaves: number;
  netSalary: number;
  paidLeave: number;
  offDays: number;
  earnDays: number;
  absents: number;
  absentsRs: number;
  lateTotal: number;
  relaxation: number;
  cuttingMin: number;
  cuttingRs: number;
  perDay: number;
  totalCutting: number;
  totalSalary: number;
};

const fmt = (n: number) => Math.round(Number(n || 0)).toLocaleString();

function monthOf(offset: number) {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() + offset);
  return { month: d.getMonth() + 1, year: d.getFullYear() };
}

export function MonthlyAttendanceSheet({ canEdit }: { canEdit: boolean }) {
  const { toast } = useToast();
  const [which, setWhich] = useState<"current" | "last">("current");
  const { month, year } = which === "current" ? monthOf(0) : monthOf(-1);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput.trim()), 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  const { data, isLoading, isFetching } = useQuery<{ rows: SheetRow[] }>({
    queryKey: ["/api/attendance/monthly-sheet", month, year, search],
    queryFn: () =>
      apiRequestJson(
        "GET",
        `/api/attendance/monthly-sheet?month=${month}&year=${year}${search ? `&search=${encodeURIComponent(search)}` : ""}`,
      ),
    placeholderData: (prev) => prev,
  });
  const rows = data?.rows ?? [];

  const [editRow, setEditRow] = useState<SheetRow | null>(null);
  const [form, setForm] = useState({ leaves: "0", halfLeave: "0", lateHour: "0", lateMin: "0" });
  const openEdit = (r: SheetRow) => {
    setEditRow(r);
    setForm({
      leaves: String(r.leaves ?? 0),
      halfLeave: String(r.halfLeave ?? 0),
      lateHour: String(r.lateHour ?? 0),
      lateMin: String(r.lateMin ?? 0),
    });
  };
  const saveMutation = useMutation({
    mutationFn: () =>
      apiRequestJson("PATCH", `/api/attendance/monthly-sheet/${editRow!.userId}`, {
        month, year,
        leaves: Number(form.leaves),
        halfLeave: Number(form.halfLeave),
        lateHour: Number(form.lateHour),
        lateMin: Number(form.lateMin),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/attendance/monthly-sheet"] });
      setEditRow(null);
      toast({ title: "Saved", description: "Monthly attendance updated" });
    },
    onError: (e: any) => toast({ title: "Could not save", description: e?.message || "Failed", variant: "destructive" }),
  });

  const preview = useMemo(() => {
    if (!editRow) return null;
    const net = editRow.netSalary;
    const off = Number(form.leaves || 0) + Number(form.halfLeave || 0) / 2;
    const absents = Math.max(0, off - 1);
    const late = Number(form.lateHour || 0) * 60 + Number(form.lateMin || 0);
    const cut = Math.max(0, late - editRow.relaxation) * (net / 30 / 8 / 60);
    const total = Math.round(absents * (net / 30) + cut);
    return { total, salary: Math.round(net - total) };
  }, [editRow, form]);

  const th = "text-left px-3 py-3 text-[12px] font-bold text-slate-700 whitespace-nowrap dark:text-zinc-300";
  const td = "px-3 py-3 text-[12px] text-slate-700 whitespace-nowrap dark:text-zinc-300";

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-sm shadow-sm p-4 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {(["last", "current"] as const).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setWhich(k)}
              className={`px-2 py-1 text-[12px] rounded-sm font-medium ${
                which === k ? "bg-[#00a65a] text-white" : "bg-emerald-50 text-[#00a65a] hover:bg-emerald-100 dark:bg-zinc-800"
              }`}
            >
              {k === "last" ? "Last Month" : "Current Month"}
            </button>
          ))}
          <span className="text-[12px] text-slate-500 dark:text-zinc-400 ml-2">
            {String(month).padStart(2, "0")} / {year} · {rows.length} employees
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-slate-500">Search:</span>
          <Input className="h-8 w-56 text-sm" value={searchInput} onChange={(e) => setSearchInput(e.target.value)} />
        </div>
      </div>

      <div className="overflow-x-auto border rounded-sm dark:border-zinc-800">
        <table className="w-full">
          <thead className="bg-[#fcf3e3] dark:bg-zinc-800">
            <tr>
              <th className={th}>Name</th>
              <th className={th}>Net Salary</th>
              <th className={th}>Paid Leave</th>
              <th className={th}>Earn Days</th>
              <th className={th}>Absents Days</th>
              <th className={th}>Absents RS</th>
              <th className={th}>Total Late Min</th>
              <th className={th}>Cutting Min</th>
              <th className={th}>Cutting Min RS</th>
              <th className={th}>Per Day RS</th>
              <th className={th}>Total Cutting</th>
              <th className={th}>Total Salary</th>
              <th className={th}>Month / Year</th>
              {canEdit && <th className={th}>Salary</th>}
            </tr>
          </thead>
          <tbody className={isFetching && !isLoading ? "opacity-60" : ""}>
            {isLoading ? (
              <tr><td colSpan={14} className="text-center py-8 text-sm text-slate-400">Loading...</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={14} className="text-center py-8 text-sm text-slate-400">No attendance for this month.</td></tr>
            ) : (
              rows.map((r) => (
                <tr key={r.userId} className="border-t even:bg-slate-50/60 dark:border-zinc-800 dark:even:bg-zinc-800/40">
                  <td className={`${td} font-semibold`}>{r.name}</td>
                  <td className={`${td} font-semibold`}>{fmt(r.netSalary)}</td>
                  <td className={td}>{r.paidLeave}</td>
                  <td className={td}>26 - {r.offDays}={r.earnDays}</td>
                  <td className={td}>{r.absents}</td>
                  <td className={td}>{fmt(r.absentsRs)}</td>
                  <td className={td}>{r.lateTotal}</td>
                  <td className={td}>{r.lateTotal} - {r.relaxation} = {r.cuttingMin}</td>
                  <td className={td}>{fmt(r.cuttingRs)}</td>
                  <td className={td}>{fmt(r.perDay)}</td>
                  <td className={td}>{fmt(r.totalCutting)}</td>
                  <td className={`${td} font-semibold`}>{fmt(r.totalSalary)}</td>
                  <td className={td}>{month} / {year}</td>
                  {canEdit && (
                    <td className={td}>
                      <button type="button" title="Edit" onClick={() => openEdit(r)} className="text-slate-400 hover:text-slate-700">
                        <Pencil className="h-4 w-4" />
                      </button>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Dialog open={!!editRow} onOpenChange={(o) => !o && setEditRow(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Attendance — {editRow?.name} ({month}/{year})</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            {([
              ["leaves", "Leaves (days)"],
              ["halfLeave", "Half Leaves"],
              ["lateHour", "Late Hours"],
              ["lateMin", "Late Minutes (0-59)"],
            ] as const).map(([k, label]) => (
              <div key={k}>
                <Label className="text-xs">{label}</Label>
                <Input
                  type="number"
                  min={0}
                  className="mt-1 h-9"
                  value={form[k]}
                  onChange={(e) => setForm((f) => ({ ...f, [k]: e.target.value }))}
                />
              </div>
            ))}
          </div>
          {preview && (
            <p className="text-xs text-slate-500">
              Net {fmt(editRow!.netSalary)} − cutting {fmt(preview.total)} = <b>{fmt(preview.salary)}</b>
            </p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditRow(null)}>Cancel</Button>
            <Button className="bg-[#00a65a] hover:bg-[#008d4c]" disabled={saveMutation.isPending} onClick={() => saveMutation.mutate()}>
              {saveMutation.isPending ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
