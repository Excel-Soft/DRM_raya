"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { apiRequest } from "@/lib/query/query-client";
import { OfficeAccountShell, DrmSection } from "@/modules/office-account/office-account-ui";

interface BusinessCustomerRow {
  id: string;
  companyName: string | null;
  phone: string | null;
  cnic: string | null;
  ntn: string | null;
  createdAt: string | null;
  totalPaid: string;
  totalDue: string;
}

function formatDollar(amount: string | null): string {
  if (!amount) return "$ 0.00";
  const num = parseFloat(amount) || 0;
  return `$ ${num.toLocaleString("en-US", { minimumFractionDigits: 2 })}`;
}

export function BusinessCustomersPage() {
  const [companyName, setCompanyName] = useState("");
  const [phone, setPhone] = useState("");
  const [cnic, setCnic] = useState("");
  const [date, setDate] = useState("");

  const { data: customers = [], isLoading, isError, refetch } = useQuery<BusinessCustomerRow[]>({
    queryKey: ["/api/office/business-customers"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/office/business-customers");
      if (!res.ok) throw new Error("Failed to load business customers");
      return res.json();
    },
  });

  const filtered = useMemo(() => {
    return (Array.isArray(customers) ? customers : []).filter((c) => {
      if (companyName && !c.companyName?.toLowerCase().includes(companyName.toLowerCase())) return false;
      if (phone && !c.phone?.includes(phone)) return false;
      if (cnic && !c.cnic?.includes(cnic) && !c.ntn?.includes(cnic)) return false;
      if (date && c.createdAt) {
        const customerDate = new Date(c.createdAt).toISOString().split("T")[0];
        if (customerDate !== date) return false;
      }
      return true;
    });
  }, [customers, companyName, phone, cnic, date]);

  const columns: DataTableColumn<BusinessCustomerRow>[] = [
    { id: "name", header: "Name", cell: (r) => <span className="font-medium">{r.companyName}</span> },
    { id: "paid", header: "Amount Paid", cell: (r) => formatDollar(r.totalPaid) },
    { id: "due", header: "Amount Due", cell: (r) => formatDollar(r.totalDue) },
  ];

  return (
    <OfficeAccountShell title="Business Customer">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <div className="lg:col-span-4 xl:col-span-3">
          <DrmSection title="Filters">
            <div className="space-y-4">
              <Field id="bc-company" label="Company Name">
                <Input id="bc-company" value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="Company name" />
              </Field>
              <Field id="bc-phone" label="Phone">
                <Input id="bc-phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone" />
              </Field>
              <Field id="bc-cnic" label="CNIC">
                <Input id="bc-cnic" value={cnic} onChange={(e) => setCnic(e.target.value)} placeholder="Enter NTN/CNIC" />
              </Field>
              <Field id="bc-date" label="Select Date">
                <Input id="bc-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              </Field>
            </div>
          </DrmSection>
        </div>

        <div className="lg:col-span-8 xl:col-span-9">
          <DrmSection title="Customer List">
            <DataTable
              columns={columns}
              rows={filtered}
              rowKey={(r) => r.id}
              loading={isLoading}
              error={isError ? "Failed to load business customers." : null}
              onRetry={() => refetch()}
              emptyMessage="No records found."
            />
          </DrmSection>
        </div>
      </div>
    </OfficeAccountShell>
  );
}
