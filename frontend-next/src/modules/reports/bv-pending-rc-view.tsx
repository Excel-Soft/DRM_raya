"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/legacy/select";
import { apiRequest } from "@/lib/query/query-client";
import { ReportsShell, DrmSection } from "@/modules/reports/reports-ui";

type PendingBvRow = {
  srNo: number;
  memberId: string;
  companyId: string;
  companyName: string;
  persons: string;
  type: string;
};

// This report does not yet have a backend data source in legacy either
// (frontend/src/pages/reports-bv-pending-rc.tsx hardcodes an empty
// REPORT_DATA array with the same note) — rendering an honest empty state
// here rather than fabricating rows neither the legacy page nor any API
// actually produces.
const REPORT_DATA: PendingBvRow[] = [];

export function BvPendingRcReportPage() {
  const { data: allUsers = [] } = useQuery<any[]>({
    queryKey: ["/api/users"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/users");
      if (!res.ok) return [];
      const data = await res.json();
      return data.users || [];
    },
  });

  const groupedUsers = useMemo(() => {
    const grouped: Record<string, any[]> = {};
    allUsers.forEach((u) => {
      const role = u.role || "Unassigned Role";
      (grouped[role] ||= []).push(u);
    });
    return Object.entries(grouped).map(([role, users]) => ({ role, users })).sort((a, b) => a.role.localeCompare(b.role));
  }, [allUsers]);

  const [user, setUser] = useState("all");
  const [searchText, setSearchText] = useState("");

  const columns = useMemo((): DataTableColumn<PendingBvRow>[] => [
    { id: "n", header: "Sr. No", cell: (r) => r.srNo },
    { id: "member", header: "Member ID", cell: (r) => r.memberId },
    { id: "companyId", header: "Company ID", cell: (r) => r.companyId },
    { id: "company", header: "Company Name", cell: (r) => <span className="uppercase">{r.companyName}</span> },
    { id: "persons", header: "Persons", cell: (r) => r.persons },
    { id: "type", header: "Type", cell: (r) => r.type },
  ], []);

  return (
    <ReportsShell title="Pending BV Report">
      <DrmSection title="Search & Filter Options" description="Select user and search text to filter records.">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Field id="pbv-user" label="Select User">
            <Select value={user} onValueChange={setUser}>
              <SelectTrigger id="pbv-user">
                <SelectValue placeholder="Choose…" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                {groupedUsers.map((group) => (
                  <SelectGroup key={group.role}>
                    <SelectLabel>{group.role}</SelectLabel>
                    {group.users.map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.fullName || u.name || u.username}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field id="pbv-search" label="Search Text">
            <Input placeholder="Company ID/Name/Member ID…" value={searchText} onChange={(e) => setSearchText(e.target.value)} />
          </Field>
        </div>
      </DrmSection>

      <DrmSection title="Post View — Pending BV Records" description={`Total Records: ${REPORT_DATA.length}`}>
        <DataTable
          columns={columns}
          rows={REPORT_DATA}
          rowKey={(row) => String(row.srNo)}
          emptyMessage="No pending BV records to display. This report is not yet connected to a live data source."
          className="min-w-[900px]"
        />
      </DrmSection>
    </ReportsShell>
  );
}
