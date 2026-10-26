"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { Badge } from "@/components/ui/badge";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { apiRequest } from "@/lib/query/query-client";
import { OfficeAccountShell, DrmSection } from "@/modules/office-account/office-account-ui";

interface OfficeVasRow {
  id: string;
  companyName: string | null;
  amount: string | null;
  currency: string | null;
  method: string | null;
  vasDate: string | null;
  createdAt: string | null;
}

function formatCurrency(amount: string | null, currency = "PKR"): string {
  if (!amount) return "-";
  const num = parseFloat(amount) || 0;
  return `${currency} ${num.toLocaleString("en-US", { minimumFractionDigits: 2 })}`;
}

export function OfficeVasPage() {
  const [tempStartDate, setTempStartDate] = useState("");
  const [tempEndDate, setTempEndDate] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const { data: vasEntries = [], isLoading, isError, refetch } = useQuery<OfficeVasRow[]>({
    queryKey: ["/api/office/vas", startDate, endDate],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (startDate) params.set("startDate", startDate);
      if (endDate) params.set("endDate", endDate);
      const res = await apiRequest("GET", `/api/office/vas?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to load VAS records");
      return res.json();
    },
  });

  const columns: DataTableColumn<OfficeVasRow>[] = [
    { id: "no", header: "#", cell: (r) => vasEntries.indexOf(r) + 1 },
    { id: "company", header: "Company", cell: (r) => <span className="font-medium">{r.companyName}</span> },
    { id: "amount", header: "Amount", cell: (r) => formatCurrency(r.amount, r.currency ?? "PKR") },
    {
      id: "method",
      header: "Method",
      cell: (r) =>
        r.method && r.method !== "-" ? (
          <Badge variant="neutral" className="bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-200">
            {r.method}
          </Badge>
        ) : (
          <span className="text-zinc-400">-</span>
        ),
    },
    { id: "date", header: "Date", cell: (r) => (r.vasDate ? format(new Date(r.vasDate), "dd-MM-yyyy") : "-") },
  ];

  return (
    <OfficeAccountShell title="Office Vas">
      <DrmSection title="Filters">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Field id="vas-start" label="Start Date">
            <Input id="vas-start" type="date" value={tempStartDate} onChange={(e) => setTempStartDate(e.target.value)} />
          </Field>
          <Field id="vas-end" label="End Date">
            <Input id="vas-end" type="date" value={tempEndDate} onChange={(e) => setTempEndDate(e.target.value)} />
          </Field>
        </div>
        <div className="mt-4">
          <Button onClick={() => { setStartDate(tempStartDate); setEndDate(tempEndDate); }}>View</Button>
        </div>
      </DrmSection>

      <DrmSection title="VAS View">
        <DataTable
          columns={columns}
          rows={vasEntries}
          rowKey={(r) => r.id}
          loading={isLoading}
          error={isError ? "Failed to load VAS records. Please try again." : null}
          onRetry={() => refetch()}
          emptyMessage="No records found."
        />
      </DrmSection>
    </OfficeAccountShell>
  );
}
