// Old DRM "SALARY MAKE" page (salary-make=<attendance_month id>-<user_id>) as a
// dialog: Team VAS table + the Employee Salary form with live totals. Submit
// stores the slip as the employee's line in the period's "Salary Make" run.
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequestJson, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";

type MakeInput = {
  grossSalary: number; present: number; unpaidLeave: number; cuttingMin: number;
  pendingLeave: number; pendingLeaveRupees: number; vas: number | null; vasBonus: number;
  bonus5: number; alibabaBonus: number; projectBonus: number; pppBonus: number; postingBonus: number;
  overtimeMin: number; overtimeRs: number; reward: number; loan: number;
  unpaidHoliday: number; paidHoliday: number; penalty: number; halfLeave: number;
};

type MakeResponse = {
  userId: string; legacyUserId: string | null; name: string; attendanceMonthId: string | null;
  month: number; year: number; hasAttendance: boolean; input: MakeInput;
  teamVas: { userId: string; name: string; amount: number }[]; teamVasTotal: number;
  postingLinks: number; loanRemaining: number;
  oldSlip: { id: string; totalSalary: number } | null;
  existingRun: { id: string; status: string } | null;
};

type Form = Record<keyof MakeInput, string>;

/** Same formula as the server (services/old-salary-compute.service.ts computeSalaryMake). */
export function computeSalaryMake(f: Form) {
  const n = (k: keyof MakeInput) => Number(f[k]) || 0;
  const gross = n("grossSalary");
  const perDay = gross / 30;
  const perMin = perDay / 8 / 60;
  const totalCutting =
    n("unpaidLeave") * perDay + Math.max(0, n("cuttingMin")) * perMin + n("halfLeave") * perDay / 2 + n("penalty") + n("loan");
  const basicSalaryCutting = gross - totalCutting + n("penalty");
  const total = gross - totalCutting
    + n("vasBonus") + n("bonus5") + n("alibabaBonus") + n("projectBonus") + n("pppBonus") + n("postingBonus")
    + n("overtimeRs") + n("reward") + n("pendingLeaveRupees") + (n("paidHoliday") - n("unpaidHoliday")) * perDay;
  return {
    totalCutting: Math.round(totalCutting * 100) / 100,
    basicSalaryCutting: Math.round(basicSalaryCutting * 100) / 100,
    totalSalary: Math.round(total),
  };
}

const FIELDS: { key: keyof MakeInput; label: (d: MakeResponse) => string; readOnly?: boolean }[] = [
  { key: "grossSalary", label: () => "Gross Salary" },
  { key: "present", label: () => "Present Days" },
  { key: "unpaidLeave", label: () => "Unpaid Leave" },
  { key: "cuttingMin", label: () => "Cutting Min" },
  { key: "pendingLeave", label: () => "Pending Leave" },
  { key: "pendingLeaveRupees", label: () => "Pending Leave Rupees" },
  { key: "vas", label: () => "VAS" },
  { key: "vasBonus", label: () => "VAS Bonus" },
  { key: "bonus5", label: () => "5 % Bonus" },
  { key: "alibabaBonus", label: () => "Alibaba Bonus" },
  { key: "projectBonus", label: () => "Project Bonus" },
  { key: "pppBonus", label: () => "PPP Bonus" },
  { key: "postingBonus", label: (d) => `Product Posting Bonus(${d.postingLinks})` },
  { key: "overtimeMin", label: () => "Over Time Min" },
  { key: "overtimeRs", label: () => "Over Time Rs" },
  { key: "reward", label: () => "Reward" },
  { key: "loan", label: (d) => `Instalment/Loan(${d.loanRemaining})` },
];

const toForm = (i: MakeInput): Form =>
  Object.fromEntries(Object.entries(i).map(([k, v]) => [k, v === null || v === undefined ? "" : String(v)])) as Form;

export function SalaryMakeDialog({
  open, onClose, userId, month, year, canSubmit,
}: { open: boolean; onClose: () => void; userId: string | null; month: number; year: number; canSubmit: boolean }) {
  const { toast } = useToast();
  const [form, setForm] = useState<Form | null>(null);

  const data = useQuery<MakeResponse>({
    queryKey: ["/api/salary/make", userId, month, year],
    queryFn: async () => apiRequestJson("GET", `/api/salary/make?month=${month}&year=${year}&userId=${encodeURIComponent(userId!)}`),
    enabled: open && !!userId,
  });
  useEffect(() => {
    if (data.data) setForm(toForm(data.data.input));
  }, [data.data]);
  useEffect(() => { if (!open) setForm(null); }, [open]);

  const calc = useMemo(() => (form ? computeSalaryMake(form) : null), [form]);

  const submit = useMutation({
    mutationFn: async () => {
      if (!form || !userId) throw new Error("local: Nothing to save");
      const body: Record<string, unknown> = { month, year, userId };
      for (const [k, v] of Object.entries(form)) body[k] = v === "" ? null : Number(v);
      return apiRequestJson("POST", "/api/salary/make", body);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/salary/preview"] });
      queryClient.invalidateQueries({ queryKey: ["/api/salary/runs"] });
      toast({ title: "Salary saved", description: `${data.data?.name} — Total Salary ${calc?.totalSalary}` });
      onClose();
    },
    onError: (err: any) => {
      let detail = "Could not save the salary.";
      const m = String(err?.message ?? "").match(/^\d{3}:\s*([\s\S]*)$/);
      if (m) { try { detail = JSON.parse(m[1])?.error || detail; } catch { /* keep */ } }
      toast({ title: "Save failed", description: detail, variant: "destructive" });
    },
  });

  const d = data.data;
  const set = (k: keyof MakeInput, v: string) => setForm((f) => (f ? { ...f, [k]: v } : f));
  const box = "h-8 text-[12.5px] rounded-sm";
  const ro = "h-8 text-[12.5px] rounded-sm bg-slate-100 dark:bg-zinc-800";

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-[1100px] w-[95vw] max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="uppercase">Salary Make</DialogTitle>
        </DialogHeader>
        {data.isLoading || !form || !d ? (
          <div className="py-10 text-center text-sm text-slate-500">{data.isError ? "Could not load the salary form." : "Loading…"}</div>
        ) : (
          <div className="space-y-5 text-[12.5px]">
            <div>
              <h3 className="font-bold text-[#555] dark:text-zinc-300 mb-1">Team VAS</h3>
              <table className="w-full max-w-[520px] border border-slate-200 dark:border-zinc-800">
                <thead className="bg-[#f4f6f9] dark:bg-zinc-800">
                  <tr><th className="text-left px-2 py-1.5">Name</th><th className="text-left px-2 py-1.5">Amount</th></tr>
                </thead>
                <tbody>
                  {d.teamVas.map((t) => (
                    <tr key={t.userId} className="border-t border-slate-100 dark:border-zinc-800">
                      <td className="px-2 py-1">{t.name}</td><td className="px-2 py-1">{t.amount}</td>
                    </tr>
                  ))}
                  <tr className="border-t border-slate-200 dark:border-zinc-700 font-bold">
                    <td className="px-2 py-1">Total</td><td className="px-2 py-1">{d.teamVasTotal}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div>
              <h3 className="font-bold text-[#555] dark:text-zinc-300 mb-2">Employee Salary</h3>
              {d.existingRun && (
                <p className="mb-2 text-[#b8860b]">This employee's salary for {month}/{d.year} is already in a salary run ({d.existingRun.status}).</p>
              )}
              {!d.hasAttendance && (
                <p className="mb-2 text-[#b8860b]">No attendance month for {month}/{d.year} — attendance values are 0.</p>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="space-y-1">
                  <Label className="text-[11px] text-slate-500">Name</Label>
                  <Input value={d.name} readOnly className={ro} />
                </div>
                {FIELDS.map((f) => (
                  <div key={f.key} className="space-y-1">
                    <Label className="text-[11px] text-slate-500">{f.label(d)}</Label>
                    <Input type="number" step="any" value={form[f.key]} onChange={(e) => set(f.key, e.target.value)} className={box} />
                  </div>
                ))}
                <div className="space-y-1">
                  <Label className="text-[11px] text-slate-500">Basic Salary Cutting</Label>
                  <Input value={calc?.basicSalaryCutting ?? 0} readOnly className={ro} />
                </div>
                <div className="space-y-1">
                  <Label className="text-[11px] text-slate-500" title="Unpaid Leave × Gross/30 + Cutting Min × Gross/30/8/60 + Half Leave × Gross/60 + Penalty + Loan">Total Cutting</Label>
                  <Input value={calc?.totalCutting ?? 0} readOnly className={ro} />
                </div>
                {(["unpaidHoliday", "paidHoliday", "penalty", "halfLeave"] as (keyof MakeInput)[]).map((k) => (
                  <div key={k} className="space-y-1">
                    <Label className="text-[11px] text-slate-500">
                      {k === "unpaidHoliday" ? "Unpaid Holiday" : k === "paidHoliday" ? "Paid Holiday" : k === "penalty" ? "Penalty" : "Half Leave"}
                    </Label>
                    <Input type="number" step="any" value={form[k]} onChange={(e) => set(k, e.target.value)} className={box} />
                  </div>
                ))}
                <div className="space-y-1">
                  <Label className="text-[11px] text-slate-500" title="Gross − Total Cutting + bonuses + Over Time Rs + Reward + Pending Leave Rs + (Paid − Unpaid Holiday) × Gross/30">Total Salary</Label>
                  <Input value={calc?.totalSalary ?? 0} readOnly className={`${ro} font-bold`} />
                </div>
              </div>
              {d.oldSlip && (
                <p className="mt-2 text-[11px] text-slate-500">Old DRM slip #{d.oldSlip.id} for this month: Total Salary {Math.round(d.oldSlip.totalSalary)}.</p>
              )}
              <div className="mt-4 flex gap-2">
                <Button
                  onClick={() => submit.mutate()}
                  disabled={!canSubmit || submit.isPending || !!d.existingRun}
                  className="h-9 px-6 bg-[#556ee6] hover:bg-[#485ec4] text-white font-semibold rounded-sm"
                >
                  {submit.isPending ? "Saving…" : "Submit"}
                </Button>
                <Button variant="outline" onClick={onClose} className="h-9 px-4 rounded-sm">Close</Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
