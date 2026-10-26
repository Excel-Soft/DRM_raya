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

const CITIES = [
  "Sialkot-Webexcels",
  "Lahore",
  "Karachi",
  "Lahore-Raya",
  "Lahore-GulBerg",
  "Sialkot-Welc",
  "Gujranwala branch",
  "Wazirabad Branch",
  "Faisalabad Branch",
];

type GmRow = {
  id: string;
  memberId: string | null;
  companyName: string | null;
  package: string | null;
  kwa: string | null;
  psa: string | null;
  packagePriceUsd: number | null;
  discount: number | null;
  extraDiscount: number | null;
  method: string | null;
  payDate: string | null;
  bvSubmitDate: string | null;
  bvDate: string | null;
  person: string | null;
  rcNew: string | null;
  accountantStatus: string | null;
  hodStatus: string | null;
  gmCreationDate: string | null;
  hodApprovedDate: string | null;
  lastUpdateDate: string | null;
};

export function GmReportPage() {
  const [selectedUser, setSelectedUser] = useState("all");
  const [selectedCity, setSelectedCity] = useState("all");
  const [selectedPackage, setSelectedPackage] = useState("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [qWise, setQWise] = useState(false);
  const [abPayDate, setAbPayDate] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showEntries, setShowEntries] = useState("10");
  const [fetchParams, setFetchParams] = useState<{ userId: string; from: string; to: string } | null>(null);

  const { data: users = [] } = useQuery<any[]>({
    queryKey: ["/api/account/users-list"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/account/users-list");
      if (!res.ok) return [];
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    },
  });

  const { data: packagesData } = useQuery<{ packages: any[] }>({
    queryKey: ["gm-packages"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/gm-packages");
      if (!res.ok) return { packages: [] };
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });
  const gmPackages = packagesData?.packages || [];

  const groupedUsers = useMemo(() => {
    const grouped: Record<string, any[]> = {};
    users.forEach((u: any) => {
      const role = u.role || "Unassigned Role";
      (grouped[role] ||= []).push(u);
    });
    return Object.entries(grouped).map(([role, members]) => ({ role, members })).sort((a, b) => a.role.localeCompare(b.role));
  }, [users]);

  const { data: reportData, isLoading } = useQuery<any>({
    queryKey: ["/api/reports/gm", fetchParams],
    queryFn: async () => {
      if (!fetchParams) return null;
      const params = new URLSearchParams();
      if (fetchParams.from) params.set("from", fetchParams.from);
      if (fetchParams.to) params.set("to", fetchParams.to);
      if (fetchParams.userId !== "all") params.set("userId", fetchParams.userId);
      params.set("onlyAccountApproved", "true");
      const res = await apiRequest("GET", `/api/reports/gm?${params}`);
      return res.json();
    },
    enabled: !!fetchParams,
  });

  const details: GmRow[] = reportData?.details || [];
  const filteredDetails = details.filter((item) => !searchQuery || item.companyName?.toLowerCase().includes(searchQuery.toLowerCase()));
  const displayLimit = parseInt(showEntries) || 10;
  const displayedData = filteredDetails.slice(0, displayLimit);

  const fmt = (v: string | null) => (v ? format(new Date(v), "yyyy-MM-dd") : "-");
  const fmtDt = (v: string | null) => (v ? format(new Date(v), "yyyy-MM-dd HH:mm:ss") : "-");

  const columns = useMemo((): DataTableColumn<GmRow>[] => [
    { id: "member", header: "Member Id", cell: (r) => r.memberId || "-" },
    { id: "company", header: "Company", cell: (r) => <span className="font-medium">{r.companyName || "-"}</span> },
    { id: "package", header: "Package", cell: (r) => r.package || "-" },
    { id: "kwa", header: "KWA", cell: (r) => r.kwa || "-" },
    { id: "psa", header: "PSA", cell: (r) => r.psa || "-" },
    { id: "pa", header: "P.A", cell: (r) => r.packagePriceUsd ?? "-" },
    { id: "discount", header: "Discount", cell: (r) => r.discount ?? "-" },
    { id: "extra", header: "Extra Discount", cell: (r) => r.extraDiscount ?? "-" },
    { id: "method", header: "Method", cell: (r) => r.method || "-" },
    { id: "pay", header: "Pay Date", cell: (r) => fmt(r.payDate) },
    { id: "bvSubmit", header: "BV Submit", cell: (r) => fmtDt(r.bvSubmitDate) },
    { id: "bvDate", header: "BV Date", cell: (r) => fmt(r.bvDate) },
    { id: "person", header: "Person", cell: (r) => r.person || "-" },
    { id: "rcNew", header: "Rc/New", cell: (r) => r.rcNew || "-" },
    { id: "accountant", header: "Accountant", cell: (r) => r.accountantStatus || "-" },
    { id: "hod", header: "Hod", cell: (r) => r.hodStatus || "-" },
    { id: "gmCreate", header: "GM Creation Date", cell: (r) => fmtDt(r.gmCreationDate) },
    { id: "hodApproved", header: "HOD Approval Date", cell: (r) => fmtDt(r.hodApprovedDate) },
    { id: "lastUpdate", header: "Last Update Date", cell: (r) => fmtDt(r.lastUpdateDate) },
  ], []);

  return (
    <ReportsShell title="GM System">
      <DrmSection title="Filters">
        <div className="grid grid-cols-1 items-end gap-4 md:grid-cols-6">
          <div className="space-y-2">
            <div className="mb-1 flex items-center gap-2">
              <label className="text-xs font-semibold text-zinc-600 dark:text-zinc-400">Select User</label>
              <div className="flex items-center gap-1">
                <Checkbox id="gm-qwise" checked={qWise} onCheckedChange={(c) => setQWise(c === true)} />
                <label htmlFor="gm-qwise" className="text-[10px] text-zinc-500">
                  Q Wise
                </label>
              </div>
              <div className="flex items-center gap-1">
                <Checkbox id="gm-abpay" checked={abPayDate} onCheckedChange={(c) => setAbPayDate(c === true)} />
                <label htmlFor="gm-abpay" className="text-[10px] text-zinc-500">
                  Ab Pay Date
                </label>
              </div>
            </div>
            <Select value={selectedUser} onValueChange={setSelectedUser}>
              <SelectTrigger id="gm-user">
                <SelectValue placeholder="Choose…" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Users</SelectItem>
                {groupedUsers.map(({ role, members }) => (
                  <SelectGroup key={role}>
                    <SelectLabel>{role}</SelectLabel>
                    {members.map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.full_name}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Field id="gm-city" label="Select City">
            <Select value={selectedCity} onValueChange={setSelectedCity}>
              <SelectTrigger id="gm-city">
                <SelectValue placeholder="Choose…" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Cities</SelectItem>
                {CITIES.map((city) => (
                  <SelectItem key={city} value={city.toLowerCase().replace(/\s+/g, "-")}>
                    {city}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field id="gm-package" label="Select Package">
            <Select value={selectedPackage} onValueChange={setSelectedPackage}>
              <SelectTrigger id="gm-package">
                <SelectValue placeholder="Choose…" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Packages</SelectItem>
                {gmPackages.map((pkg: any) => (
                  <SelectItem key={pkg.id} value={pkg.name}>
                    {pkg.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field id="gm-start" label="Start Date">
            <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </Field>
          <Field id="gm-end" label="End Date">
            <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </Field>
        </div>
        <div className="mt-4">
          <Button type="button" variant="primary" onClick={() => setFetchParams({ userId: selectedUser, from: startDate, to: endDate })}>
            View
          </Button>
        </div>
      </DrmSection>

      <DrmSection
        title="GM View"
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
        <DataTable columns={columns} rows={displayedData} rowKey={(row) => row.id} loading={isLoading} emptyMessage="No entries found" className="min-w-[1800px]" />
      </DrmSection>
    </ReportsShell>
  );
}
