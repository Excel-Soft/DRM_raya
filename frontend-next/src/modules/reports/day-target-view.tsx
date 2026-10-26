"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { Checkbox } from "@/components/ui/legacy/checkbox";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/legacy/select";
import { apiRequest } from "@/lib/query/query-client";
import { useToast } from "@/lib/hooks/use-legacy-toast";
import { ReportsShell, DrmSection } from "@/modules/reports/reports-ui";

type DayTargetMethodRow = { method: string; total: number };
type DayTargetUserTable = { userId: string | null; userName: string; rows: DayTargetMethodRow[] };
type DayTargetReport = { tables: DayTargetUserTable[] };
type FetchParams = { userId: string; ourTeam: boolean; startDate: string; endDate: string };

export function DayTargetReportPage() {
  const { toast } = useToast();
  const [selectedUser, setSelectedUser] = useState("all");
  const [ourTeam, setOurTeam] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [fetchParams, setFetchParams] = useState<FetchParams | null>(null);

  const { data: users = [] } = useQuery<any[]>({
    queryKey: ["/api/users", { assigned: true }],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/users?assigned=true");
      const body = await res.json().catch(() => null);
      return body?.users || [];
    },
  });

  const groupedUsers = useMemo(() => {
    const grouped: Record<string, any[]> = {};
    users.forEach((u: any) => {
      const role = u.role || "Unassigned Role";
      (grouped[role] ||= []).push(u);
    });
    return Object.entries(grouped).map(([role, members]) => ({ role, members })).sort((a, b) => a.role.localeCompare(b.role));
  }, [users]);

  const { data: report, isLoading, isError } = useQuery<DayTargetReport>({
    queryKey: ["/api/reports/day-target", fetchParams],
    queryFn: async () => {
      const p = fetchParams!;
      const params = new URLSearchParams();
      params.set("startDate", p.startDate);
      params.set("endDate", p.endDate);
      if (p.userId !== "all") params.set("userId", p.userId);
      if (p.ourTeam) params.set("ourTeam", "true");
      const res = await apiRequest("GET", `/api/reports/day-target?${params}`);
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.error?.message || body?.error || "Failed to load the report.");
      return body;
    },
    enabled: !!fetchParams,
    retry: false,
  });

  const handleView = () => {
    if (!startDate || !endDate) {
      toast({ title: "Select both a start and end date.", variant: "destructive" });
      return;
    }
    setFetchParams({ userId: selectedUser, ourTeam, startDate, endDate });
  };

  const tables = report?.tables ?? [];

  return (
    <ReportsShell title="Day Activities">
      <DrmSection title="Filters">
        <div className="grid grid-cols-1 items-end gap-4 md:grid-cols-4">
          <Field id="dt-user" label="Select User">
            <Select value={selectedUser} onValueChange={setSelectedUser}>
              <SelectTrigger id="dt-user">
                <SelectValue placeholder="Choose…" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                {groupedUsers.map(({ role, members }) => (
                  <SelectGroup key={role}>
                    <SelectLabel>{role}</SelectLabel>
                    {members.filter((u) => u.fullName || u.username).map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.fullName || u.username}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <div className="flex items-center gap-2 pb-2">
            <Checkbox id="dt-our-team" checked={ourTeam} onCheckedChange={(c) => setOurTeam(c === true)} />
            <label htmlFor="dt-our-team" className="text-sm text-zinc-600 dark:text-zinc-400">
              Our Team
            </label>
          </div>
          <Field id="dt-start" label="Start Date">
            <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </Field>
          <Field id="dt-end" label="End Date">
            <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </Field>
        </div>
        <div className="mt-4">
          <Button type="button" variant="primary" onClick={handleView}>
            View
          </Button>
        </div>
      </DrmSection>

      <DrmSection title="View Report">
        {!fetchParams ? (
          <p className="py-8 text-center text-sm text-zinc-500">Choose filters and click View to load the report.</p>
        ) : isLoading ? (
          <p className="py-8 text-center text-sm text-zinc-500">Loading data…</p>
        ) : isError ? (
          <p className="py-8 text-center text-sm text-rose-600 dark:text-rose-400">Failed to load the report.</p>
        ) : tables.length === 0 ? (
          <p className="py-8 text-center text-sm text-zinc-500">No activity found for these filters.</p>
        ) : (
          <div className="space-y-4">
            {tables.map((table) => (
              <div key={table.userId ?? "all"} className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
                <table className="min-w-full divide-y divide-zinc-200 text-sm dark:divide-zinc-800">
                  <thead className="bg-zinc-50 dark:bg-zinc-950/80">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-zinc-600 dark:text-zinc-400">Method</th>
                      <th className="px-4 py-2 text-right text-xs font-semibold uppercase tracking-wide text-zinc-600 dark:text-zinc-400">{table.userName}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 bg-white dark:divide-zinc-800 dark:bg-zinc-900">
                    {table.rows.length === 0 ? (
                      <tr>
                        <td colSpan={2} className="py-6 text-center text-zinc-500">
                          No activity in this range.
                        </td>
                      </tr>
                    ) : (
                      table.rows.map((row) => (
                        <tr key={row.method}>
                          <td className="px-4 py-3 text-left">{row.method}</td>
                          <td className="px-4 py-3 text-right tabular-nums">{row.total}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        )}
      </DrmSection>
    </ReportsShell>
  );
}
