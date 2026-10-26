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
import { useToast } from "@/lib/hooks/use-legacy-toast";
import { ReportsShell, DrmSection } from "@/modules/reports/reports-ui";

type DiagnoseRow = {
  id: string;
  createDate: string | null;
  companyName: string | null;
  personName: string | null;
  startRating: string | null;
  upSalling: string | null;
  rfq: string | null;
  products: string | null;
  followRate: string | null;
  sample: string | null;
  orderInfo: string | null;
  revenue: string | null;
  happyAlibaba: string | null;
  happyWebxl: string | null;
  report: string | null;
};

type AppliedFilters = { userId: string; startDate: string; endDate: string };

export function DiagnoseReportPage() {
  const { toast } = useToast();
  const [selectedUser, setSelectedUser] = useState("All");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [applied, setApplied] = useState<AppliedFilters | null>(null);
  const [exporting, setExporting] = useState(false);

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

  const { data: reportData, isLoading } = useQuery<{ rows: DiagnoseRow[] }>({
    queryKey: ["/api/reports/diagnose", applied],
    queryFn: async () => {
      if (!applied) return { rows: [] };
      const params = new URLSearchParams();
      params.set("userId", applied.userId || "all");
      if (applied.startDate) params.set("startDate", applied.startDate);
      if (applied.endDate) params.set("endDate", applied.endDate);
      const res = await apiRequest("GET", `/api/reports/diagnose?${params}`);
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        toast({ title: body?.error || "Failed to load the diagnose report.", variant: "destructive" });
        return { rows: [] };
      }
      return body;
    },
    enabled: !!applied,
  });

  const handleExport = async () => {
    if (!applied) return;
    setExporting(true);
    try {
      const params = new URLSearchParams();
      params.set("userId", applied.userId || "all");
      if (applied.startDate) params.set("startDate", applied.startDate);
      if (applied.endDate) params.set("endDate", applied.endDate);
      const res = await apiRequest("GET", `/api/reports/diagnose/export?${params}`);
      if (!res.ok) throw new Error(String(res.status));
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "diagnose_report.csv";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      toast({ title: "Export failed", variant: "destructive" });
    } finally {
      setExporting(false);
    }
  };

  const rows = reportData?.rows ?? [];

  const columns = useMemo((): DataTableColumn<DiagnoseRow>[] => [
    { id: "create", header: "Create", cell: (r) => (r.createDate ? format(new Date(r.createDate), "dd-MM-yyyy hh:mm a") : "-") },
    { id: "company", header: "Company", cell: (r) => <span className="font-medium">{r.companyName || "-"}</span> },
    { id: "person", header: "Person", cell: (r) => r.personName || "-" },
    { id: "startRating", header: "Start Rating", cell: (r) => r.startRating || "-" },
    { id: "upSalling", header: "Up Salling", cell: (r) => r.upSalling || "-" },
    { id: "rfq", header: "Rfq", cell: (r) => r.rfq || "-" },
    { id: "products", header: "Products", cell: (r) => r.products || "-" },
    { id: "followRate", header: "Follow Rate", cell: (r) => r.followRate || "-" },
    { id: "sample", header: "Sample", cell: (r) => r.sample || "-" },
    { id: "order", header: "Order", cell: (r) => r.orderInfo || "-" },
    { id: "revenue", header: "Revenue", cell: (r) => r.revenue || "-" },
    { id: "alibaba", header: "Happy Alibaba", cell: (r) => r.happyAlibaba || "-" },
    { id: "webxl", header: "Happy Webxl", cell: (r) => r.happyWebxl || "-" },
    { id: "report", header: "Report Send", cell: (r) => r.report || "-" },
  ], []);

  return (
    <ReportsShell
      title="Diagnose Report"
      actions={
        <Button type="button" variant="primary" disabled={!applied || exporting || rows.length === 0} onClick={handleExport}>
          {exporting ? "Exporting…" : "Export CSV"}
        </Button>
      }
    >
      <DrmSection title="Filters">
        <div className="grid grid-cols-1 items-end gap-4 md:grid-cols-3">
          <Field id="dg-person" label="Person">
            <Select value={selectedUser} onValueChange={setSelectedUser}>
              <SelectTrigger id="dg-person">
                <SelectValue placeholder="Choose…" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="All">All</SelectItem>
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
          <Field id="dg-start" label="Start">
            <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </Field>
          <Field id="dg-end" label="End">
            <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </Field>
        </div>
        <div className="mt-4">
          <Button type="button" variant="primary" onClick={() => setApplied({ userId: selectedUser, startDate, endDate })}>
            View
          </Button>
        </div>
      </DrmSection>

      <DrmSection title="GM View">
        <DataTable
          columns={columns}
          rows={rows}
          rowKey={(row) => row.id}
          loading={!!applied && isLoading}
          emptyMessage={!applied ? "Choose a person and date range, then click View." : "No follow-up records found for these filters."}
          className="min-w-[1400px]"
        />
      </DrmSection>
    </ReportsShell>
  );
}
