"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { Checkbox } from "@/components/ui/legacy/checkbox";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/legacy/select";
import { apiRequest } from "@/lib/query/query-client";
import { ReportsShell, DrmSection } from "@/modules/reports/reports-ui";

type BvRow = {
  id: string;
  companyName: string | null;
  package: string | null;
  method: string | null;
  bvSubmit: string | null;
  personName: string | null;
  rcNew: string | null;
  date: string | null;
};

type FetchParams = { userId: string; from: string; to: string; pendingBv: boolean };

export function BvPendingEcncReportPage() {
  const [selectedUser, setSelectedUser] = useState("all");
  const [selectedType, setSelectedType] = useState("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [pendingBv, setPendingBv] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showEntries, setShowEntries] = useState("10");
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

  const { data: reportData, isLoading } = useQuery<any>({
    queryKey: ["/api/reports/bv", "pending", fetchParams],
    queryFn: async () => {
      if (!fetchParams) return null;
      const params = new URLSearchParams();
      params.set("scope", "pending");
      if (fetchParams.pendingBv) params.set("pendingOnly", "true");
      if (fetchParams.from) params.set("from", fetchParams.from);
      if (fetchParams.to) params.set("to", fetchParams.to);
      if (fetchParams.userId !== "all") params.set("userId", fetchParams.userId);
      const res = await apiRequest("GET", `/api/reports/bv?${params}`);
      return res.json();
    },
    enabled: !!fetchParams,
  });

  const handleView = () => setFetchParams({ userId: selectedUser, from: startDate, to: endDate, pendingBv });

  const handlePendingBvChange = (checked: boolean) => {
    setPendingBv(checked);
    setFetchParams((prev) => (prev ? { ...prev, pendingBv: checked } : prev));
  };

  const details: BvRow[] = reportData?.details || [];
  const filteredDetails = details.filter((item) => {
    if (searchQuery && !item.companyName?.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    if (selectedType !== "all" && item.rcNew?.toLowerCase() !== selectedType.toLowerCase()) return false;
    return true;
  });
  const displayLimit = parseInt(showEntries) || 10;
  const displayedData = filteredDetails.slice(0, displayLimit);

  const columns = useMemo((): DataTableColumn<BvRow>[] => [
    { id: "company", header: "Company", cell: (r) => <span className="font-medium">{r.companyName || "-"}</span> },
    { id: "package", header: "Package", cell: (r) => r.package || "-" },
    { id: "method", header: "Method", cell: (r) => r.method || "-" },
    { id: "bvSubmit", header: "BV Submit", cell: (r) => (r.bvSubmit ? format(new Date(r.bvSubmit), "yyyy-MM-dd") : "-") },
    { id: "person", header: "Person", cell: (r) => r.personName || "-" },
    { id: "rcNew", header: "Rc/New", cell: (r) => r.rcNew || "-" },
    { id: "date", header: "Date", cell: (r) => (r.date ? format(new Date(r.date), "yyyy-MM-dd HH:mm:ss") : "-") },
  ], []);

  return (
    <ReportsShell title="BV Check System">
      <DrmSection title="Filters">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Field id="bve-user" label="Select User" className="flex-1">
                <Select value={selectedUser} onValueChange={setSelectedUser}>
                  <SelectTrigger id="bve-user">
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
              <div className="flex items-center gap-1.5 pb-0.5">
                <Checkbox id="bve-pending" checked={pendingBv} onCheckedChange={(c) => handlePendingBvChange(c === true)} />
                <label htmlFor="bve-pending" className="text-xs text-zinc-500">
                  Pending Bv
                </label>
              </div>
            </div>
            <Field id="bve-type" label="Select Type">
              <Select value={selectedType} onValueChange={setSelectedType}>
                <SelectTrigger id="bve-type">
                  <SelectValue placeholder="Choose…" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="New">New</SelectItem>
                  <SelectItem value="Renew">Renew</SelectItem>
                  <SelectItem value="Expire">Expire</SelectItem>
                  <SelectItem value="Rc/Up">Rc/Up</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </div>
          <Field id="bve-start" label="Start Date">
            <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </Field>
          <Field id="bve-end" label="End Date">
            <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </Field>
        </div>
        <div className="mt-4">
          <Button type="button" variant="primary" onClick={handleView}>
            View
          </Button>
        </div>
      </DrmSection>

      <DrmSection
        title="BV View"
        actions={
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
              Show
              <select
                className="h-8 rounded-md border border-zinc-300 bg-white px-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                value={showEntries}
                onChange={(e) => setShowEntries(e.target.value)}
              >
                {["10", "25", "50", "100"].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
              entries
            </label>
            <Input type="search" placeholder="Search…" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="h-8 w-52" />
          </div>
        }
      >
        <DataTable columns={columns} rows={displayedData} rowKey={(row) => row.id} loading={isLoading} emptyMessage="No entries found" className="min-w-[900px]" />
      </DrmSection>
    </ReportsShell>
  );
}
