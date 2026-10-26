"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { differenceInMinutes } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/legacy/select";
import { apiRequest } from "@/lib/query/query-client";
import { ReportsShell, DrmSection } from "@/modules/reports/reports-ui";

type AttendanceRecord = {
  id: string;
  timeIn: string | null;
  timeOut: string | null;
  status: string | null;
  date: string | null;
};

type UserOption = { id: string; full_name: string };

function calculateLate(timeIn: string | null) {
  if (!timeIn) return "-";
  const checkInDate = new Date(timeIn);
  const expectedCheckIn = new Date(checkInDate);
  expectedCheckIn.setHours(9, 0, 0, 0);
  if (checkInDate > expectedCheckIn) {
    const diffMinutes = differenceInMinutes(checkInDate, expectedCheckIn);
    return `${Math.floor(diffMinutes / 60)}:${diffMinutes % 60}`;
  }
  return "0:0";
}

export function AttendanceReportPage() {
  const [selectedUser, setSelectedUser] = useState("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [fetchParams, setFetchParams] = useState<{ userId: string; startDate: string; endDate: string } | null>(null);

  const { data: users = [] } = useQuery<UserOption[]>({
    queryKey: ["/api/account/users-list"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/account/users-list");
      if (!res.ok) return [];
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    },
  });

  const { data: attendanceData, isLoading } = useQuery<{ records: AttendanceRecord[] }>({
    queryKey: ["/api/attendance", fetchParams],
    queryFn: async () => {
      if (!fetchParams) return { records: [] };
      const { userId, startDate: s, endDate: e } = fetchParams;
      let url = "/api/attendance?";
      if (userId) url += `userId=${userId}&`;
      if (s) url += `startDate=${s}&`;
      if (e) url += `endDate=${e}`;
      const res = await apiRequest("GET", url);
      if (!res.ok) return { records: [] };
      return res.json();
    },
    enabled: !!fetchParams,
  });

  const records = attendanceData?.records ?? [];

  const columns: DataTableColumn<AttendanceRecord>[] = [
    { id: "in", header: "Time In", cell: (r) => (r.timeIn ? new Date(r.timeIn).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "-") },
    { id: "out", header: "Time Out", cell: (r) => (r.timeOut ? new Date(r.timeOut).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "-") },
    { id: "late", header: "Late Absent", cell: (r) => (r.status === "Absent" ? "Absent" : calculateLate(r.timeIn)) },
    { id: "date", header: "Date", cell: (r) => (r.date ? new Date(r.date).toISOString().slice(0, 10) : "-") },
  ];

  return (
    <ReportsShell title="Attendance System">
      <DrmSection title="Filters">
        <div className="grid grid-cols-1 items-end gap-4 md:grid-cols-3">
          <Field id="att-user" label="Select User">
            <Select value={selectedUser} onValueChange={setSelectedUser}>
              <SelectTrigger id="att-user">
                <SelectValue placeholder="Choose…" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Users</SelectItem>
                {users.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field id="att-start" label="Start Date">
            <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </Field>
          <Field id="att-end" label="End Date">
            <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </Field>
        </div>
        <div className="mt-4">
          <Button type="button" variant="primary" onClick={() => setFetchParams({ userId: selectedUser, startDate, endDate })}>
            View
          </Button>
        </div>
      </DrmSection>

      <DrmSection title="Attendance View">
        <DataTable
          columns={columns}
          rows={records}
          rowKey={(row) => row.id}
          loading={isLoading}
          emptyMessage="No records found. Please select a user and date range."
          className="min-w-[700px]"
        />
      </DrmSection>
    </ReportsShell>
  );
}
