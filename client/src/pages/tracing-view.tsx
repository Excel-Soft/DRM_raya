import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { getAuthHeader } from "@/lib/queryClient";
import { Link } from "wouter";

type TracingRecord = {
  id: string;
  company_name: string;
  account_holder?: string;
  email?: string;
  phone?: string;
  mobile?: string;
  ntn?: string;
  cnic?: string;
  grade?: string;
  status?: string;
  source?: string;
  pool_type?: string;
  owner_user_id?: string;
  last_followup_date?: string;
  expires_at?: string;
  service_types?: string[];
  company_id?: string;
  person_name?: string;
  title?: string;
  designation?: string;
  business_line?: string;
  address?: string;
  city?: string;
  country?: string;
  website?: string;
  rc_link?: string;
  crm_id?: string;
  crm_date?: string;
  created_at?: string;
};

export default function TracingView({ params }: { params: { id: string } }) {
  const { toast } = useToast();
  const id = params?.id;

  const { data, isLoading, error } = useQuery<{ success: boolean; data: TracingRecord }>({
    queryKey: [`/api/sales/tracing/${id}`],
    queryFn: async () => {
      const res = await fetch(`/api/sales/tracing/${id}`, { headers: getAuthHeader() });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Failed to load record");
      }
      return res.json();
    },
    enabled: !!id,
  });

  useEffect(() => {
    if (error) {
      toast({ title: "Failed to load record", description: (error as Error).message, variant: "destructive" });
    }
  }, [error, toast]);

  const record = data?.data;

  return (
    <div className="flex-1 overflow-auto p-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">Tracing Record</h1>
        <Link href="/sales/tracing">
          <a className="text-emerald-600 hover:underline text-sm">Back to Tracing</a>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{record?.company_name || "Record details"}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {isLoading && <p className="text-muted-foreground">Loading...</p>}
          {!isLoading && !record && <p className="text-muted-foreground">Not found.</p>}
          {record && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Field label="Company ID" value={record.company_id || "-"} />
              <Field label="Account Holder" value={record.account_holder || "-"} />
              <Field label="Email" value={record.email || "-"} />
              <Field label="Phone" value={record.phone || record.mobile || "-"} />
              <Field label="NTN/CNIC" value={record.ntn || record.cnic || "-"} />
              <Field label="Grade" value={record.grade || "-"} />
              <Field label="Status" value={record.status || "-"} />
              <Field label="Source" value={record.source || "-"} />
              <Field label="Pool Type" value={record.pool_type || "-"} />
              <Field label="Person" value={record.person_name || "-"} />
              <Field label="Designation" value={record.designation || "-"} />
              <Field label="Business Line" value={record.business_line || "-"} />
              <Field label="Address" value={[record.address, record.city, record.country].filter(Boolean).join(", ") || "-"} />
              <Field label="Website" value={record.website || "-"} />
              <Field label="RC Link" value={record.rc_link || "-"} />
              <Field label="CRM ID" value={record.crm_id || "-"} />
              <Field
                label="Created At"
                value={record.created_at ? new Date(record.created_at).toLocaleString() : "-"}
              />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs uppercase text-muted-foreground">{label}</div>
      <div className="text-sm font-medium">{value}</div>
    </div>
  );
}
