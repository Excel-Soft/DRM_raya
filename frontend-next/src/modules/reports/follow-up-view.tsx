"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/legacy/select";
import { apiRequest } from "@/lib/query/query-client";
import { ReportsShell, DrmSection } from "@/modules/reports/reports-ui";

type FollowUpRow = {
  id: string;
  date: string | null;
  companyName: string | null;
  purpose: string | null;
  service: string | null;
  subService: string | null;
  method: string | null;
  note: string | null;
};

type AppliedFilters = { userId: string; method: string; startDate: string; endDate: string };

// Legacy's exact Contact Method option set (followreport.php).
const CONTACT_METHODS = ["Mobile", "OnSite Visit", "E-mail", "Fax"];

export function FollowUpReportPage() {
  const [selectedUser, setSelectedUser] = useState("all");
  const [selectedMethod, setSelectedMethod] = useState("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [applied, setApplied] = useState<AppliedFilters | null>(null);

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
    return Object.entries(grouped)
      .map(([role, members]) => ({ role, members }))
      .sort((a, b) => a.role.localeCompare(b.role));
  }, [users]);

  const { data: reportData, isLoading } = useQuery<{ rows: FollowUpRow[] }>({
    queryKey: ["/api/reports/follow-up", applied],
    queryFn: async () => {
      if (!applied) return { rows: [] };
      const params = new URLSearchParams();
      params.set("userId", applied.userId || "all");
      if (applied.method !== "all") params.set("method", applied.method);
      if (applied.startDate) params.set("startDate", applied.startDate);
      if (applied.endDate) params.set("endDate", applied.endDate);
      const res = await apiRequest("GET", `/api/reports/follow-up?${params}`);
      if (!res.ok) return { rows: [] };
      return res.json();
    },
    enabled: !!applied,
  });

  const rows = reportData?.rows ?? [];

  const columns = useMemo((): DataTableColumn<FollowUpRow>[] => [
    { id: "company", header: "Company", cell: (r) => <span className="font-medium">{r.companyName || "-"}</span> },
    { id: "purpose", header: "Purpose", cell: (r) => r.purpose || "-" },
    { id: "service", header: "Service", cell: (r) => r.service || "-" },
    { id: "sub", header: "Sub Service", cell: (r) => r.subService || "-" },
    { id: "method", header: "Method", cell: (r) => r.method || "-" },
    { id: "note", header: "Note", cell: (r) => r.note || "-" },
    { id: "date", header: "Date", cell: (r) => (r.date ? format(new Date(r.date), "yyyy-MM-dd HH:mm:ss") : "-") },
  ], []);

  return (
    <ReportsShell title="Follow Up System">
      <DrmSection title="Filters">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <Field id="fu-user" label="Select User">
            <Select value={selectedUser} onValueChange={setSelectedUser}>
              <SelectTrigger id="fu-user">
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
          <Field id="fu-method" label="Contact Method">
            <Select value={selectedMethod} onValueChange={setSelectedMethod}>
              <SelectTrigger id="fu-method">
                <SelectValue placeholder="Choose…" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                {CONTACT_METHODS.map((m) => (
                  <SelectItem key={m} value={m}>
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field id="fu-start" label="Start Date">
            <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </Field>
          <Field id="fu-end" label="End Date">
            <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </Field>
        </div>
        <div className="mt-4">
          <Button type="button" variant="primary" onClick={() => setApplied({ userId: selectedUser, method: selectedMethod, startDate, endDate })}>
            View
          </Button>
        </div>
      </DrmSection>

      <DrmSection title="View Report" description={applied && rows.length > 0 ? `Total: ${rows.length}` : undefined}>
        <DataTable
          columns={columns}
          rows={rows}
          rowKey={(row) => row.id}
          loading={!!applied && isLoading}
          emptyMessage={applied ? "No entries found" : "Choose filters and click View to load the report."}
          className="min-w-[900px]"
        />
      </DrmSection>
    </ReportsShell>
  );
}
