import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useLocation, useRoute } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { RouteInvalidId, RouteNotFound } from "@/components/route-states";
import { PageBreadcrumb } from "@/components/page-breadcrumb";

type LoanReport = {
  id: string;
  title: string | null;
  status: string;
  customerId?: string | null;
  reportDate: string;
  summary?: string | null;
  notes?: string | null;
  successRate?: number | null;
  followUpsDone?: number | null;
  missedLeads?: number | null;
  totalApplications?: number | null;
  approvedLoans?: number | null;
  rejectedLoans?: number | null;
  pendingLoans?: number | null;
  totalLoanAmount?: number | null;
  disbursedAmount?: number | null;
};

export default function LoanReportEdit() {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [, params] = useRoute<{ id: string }>("/reports/loan/:id/edit");
  const id = params?.id;

  const [title, setTitle] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [status, setStatus] = useState("Draft");
  const [reportDate, setReportDate] = useState(new Date().toISOString().slice(0, 10));
  const [summary, setSummary] = useState("");
  const [notes, setNotes] = useState("");
  const [successRate, setSuccessRate] = useState<number | undefined>(undefined);
  const [followUpsDone, setFollowUpsDone] = useState<number | undefined>(undefined);
  const [missedLeads, setMissedLeads] = useState<number | undefined>(undefined);
  const [totalApplications, setTotalApplications] = useState<number | undefined>(undefined);
  const [approvedLoans, setApprovedLoans] = useState<number | undefined>(undefined);
  const [rejectedLoans, setRejectedLoans] = useState<number | undefined>(undefined);
  const [pendingLoans, setPendingLoans] = useState<number | undefined>(undefined);
  const [totalLoanAmount, setTotalLoanAmount] = useState<number | undefined>(undefined);
  const [disbursedAmount, setDisbursedAmount] = useState<number | undefined>(undefined);

  const { isLoading, isError } = useQuery({
    queryKey: ["loan-report", id],
    enabled: !!id,
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/loan-reports/${id}`);
      const data = (await res.json()) as { data: LoanReport };
      const r = data.data;
      setTitle(r.title || "");
      setCustomerId(r.customerId || "");
      setStatus(r.status || "Draft");
      setReportDate(r.reportDate?.slice(0, 10) || new Date().toISOString().slice(0, 10));
      setSummary(r.summary || "");
      setNotes(r.notes || "");
      setSuccessRate(r.successRate ?? undefined);
      setFollowUpsDone(r.followUpsDone ?? undefined);
      setMissedLeads(r.missedLeads ?? undefined);
      setTotalApplications(r.totalApplications ?? undefined);
      setApprovedLoans(r.approvedLoans ?? undefined);
      setRejectedLoans(r.rejectedLoans ?? undefined);
      setPendingLoans(r.pendingLoans ?? undefined);
      setTotalLoanAmount(r.totalLoanAmount ?? undefined);
      setDisbursedAmount(r.disbursedAmount ?? undefined);
      return data;
    },
  });

  const updateMutation = useMutation({
    mutationFn: async () => {
      const body: any = {
        title: title || null,
        customerId: customerId || undefined,
        status,
        reportDate,
        summary: summary || null,
        notes: notes || null,
        successRate: successRate ?? 0,
        followUpsDone: followUpsDone ?? 0,
        missedLeads: missedLeads ?? 0,
        totalApplications: totalApplications ?? 0,
        approvedLoans: approvedLoans ?? 0,
        rejectedLoans: rejectedLoans ?? 0,
        pendingLoans: pendingLoans ?? 0,
        totalLoanAmount: totalLoanAmount ?? 0,
        disbursedAmount: disbursedAmount ?? 0,
      };
      const res = await apiRequest("PUT", `/api/loan-reports/${id}`, body);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Loan Report updated" });
      navigate("/reports/loan");
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err?.message || "Failed to update Loan report", variant: "destructive" });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateMutation.mutate();
  };

  if (!id) {
    return (
      <div className="p-6">
        <RouteInvalidId
          message="This loan report link is missing a valid id. Open it from the Loan Reports list."
          actionLabel="Back to Loan Reports"
          actionHref="/reports/loan"
        />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="p-6">
        <RouteNotFound
          message="This loan report could not be found or you don't have access to it."
          actionLabel="Back to Loan Reports"
          actionHref="/reports/loan"
        />
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="max-w-3xl mx-auto">
        <PageBreadcrumb
          items={[
            { label: "Dashboard", href: "/" },
            { label: "Reports" },
            { label: "Loan Reports", href: "/reports/loan" },
            { label: "Edit" },
          ]}
          title="Edit Loan Report"
        />
      </div>
      <Card className="max-w-3xl mx-auto">
        <CardHeader>
          <CardTitle>Edit Loan Report</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="py-10 text-center text-muted-foreground">Loading...</div>
          ) : (
            <form className="space-y-4" onSubmit={handleSubmit}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Title</Label>
                  <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Report title" />
                </div>
                <div>
                  <Label>Status</Label>
                  <Input value={status} onChange={(e) => setStatus(e.target.value)} />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Customer ID</Label>
                  <Input value={customerId} onChange={(e) => setCustomerId(e.target.value)} placeholder="customer uuid" />
                </div>
                <div>
                  <Label>Report Date</Label>
                  <Input type="date" value={reportDate} onChange={(e) => setReportDate(e.target.value)} />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Success Rate (%)</Label>
                  <Input type="number" step="0.01" value={successRate ?? ""} onChange={(e) => setSuccessRate(e.target.value ? Number(e.target.value) : undefined)} />
                </div>
                <div>
                  <Label>Follow-ups Done</Label>
                  <Input type="number" value={followUpsDone ?? ""} onChange={(e) => setFollowUpsDone(e.target.value ? Number(e.target.value) : undefined)} />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Missed Leads</Label>
                  <Input type="number" value={missedLeads ?? ""} onChange={(e) => setMissedLeads(e.target.value ? Number(e.target.value) : undefined)} />
                </div>
                <div>
                  <Label>Total Loan Applications</Label>
                  <Input type="number" value={totalApplications ?? ""} onChange={(e) => setTotalApplications(e.target.value ? Number(e.target.value) : undefined)} />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Approved Loans</Label>
                  <Input type="number" value={approvedLoans ?? ""} onChange={(e) => setApprovedLoans(e.target.value ? Number(e.target.value) : undefined)} />
                </div>
                <div>
                  <Label>Rejected Loans</Label>
                  <Input type="number" value={rejectedLoans ?? ""} onChange={(e) => setRejectedLoans(e.target.value ? Number(e.target.value) : undefined)} />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Pending Loans</Label>
                  <Input type="number" value={pendingLoans ?? ""} onChange={(e) => setPendingLoans(e.target.value ? Number(e.target.value) : undefined)} />
                </div>
                <div>
                  <Label>Total Loan Amount</Label>
                  <Input type="number" step="0.01" value={totalLoanAmount ?? ""} onChange={(e) => setTotalLoanAmount(e.target.value ? Number(e.target.value) : undefined)} />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Disbursed Amount</Label>
                  <Input type="number" step="0.01" value={disbursedAmount ?? ""} onChange={(e) => setDisbursedAmount(e.target.value ? Number(e.target.value) : undefined)} />
                </div>
              </div>
              <div>
                <Label>Summary</Label>
                <Textarea value={summary} onChange={(e) => setSummary(e.target.value)} placeholder="Summary" />
              </div>
              <div>
                <Label>Notes</Label>
                <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes" />
              </div>
              <div className="flex justify-end">
                <Button type="submit" disabled={updateMutation.isPending}>
                  {updateMutation.isPending ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
