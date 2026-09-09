import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

export default function LoanReportNew() {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();

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

  const createMutation = useMutation({
    mutationFn: async () => {
      const body: any = {
        title: title || null,
        customerId: customerId || null,
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
      const res = await apiRequest("POST", "/api/loan-reports", body);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Loan Report created" });
      queryClient.invalidateQueries({ queryKey: ["/api/reports", "loan"] });
      queryClient.invalidateQueries({ predicate: (q) => Array.isArray(q.queryKey) && q.queryKey.includes("/api/reports") });
      navigate("/reports/loan");
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err?.message || "Failed to create Loan report", variant: "destructive" });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate();
  };

  return (
    <div className="p-6">
      <Card className="max-w-3xl mx-auto">
        <CardHeader>
          <CardTitle>Create Loan Report</CardTitle>
        </CardHeader>
        <CardContent>
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
          <Label>Total Loan Applications</Label>
          <Input type="number" value={totalApplications ?? ""} onChange={(e) => setTotalApplications(e.target.value ? Number(e.target.value) : undefined)} />
        </div>
        <div>
          <Label>Approved Loans</Label>
          <Input type="number" value={approvedLoans ?? ""} onChange={(e) => setApprovedLoans(e.target.value ? Number(e.target.value) : undefined)} />
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label>Rejected Loans</Label>
          <Input type="number" value={rejectedLoans ?? ""} onChange={(e) => setRejectedLoans(e.target.value ? Number(e.target.value) : undefined)} />
        </div>
        <div>
          <Label>Pending Loans</Label>
          <Input type="number" value={pendingLoans ?? ""} onChange={(e) => setPendingLoans(e.target.value ? Number(e.target.value) : undefined)} />
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label>Total Loan Amount</Label>
          <Input type="number" step="0.01" value={totalLoanAmount ?? ""} onChange={(e) => setTotalLoanAmount(e.target.value ? Number(e.target.value) : undefined)} />
        </div>
        <div>
          <Label>Disbursed Amount</Label>
          <Input type="number" step="0.01" value={disbursedAmount ?? ""} onChange={(e) => setDisbursedAmount(e.target.value ? Number(e.target.value) : undefined)} />
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
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending ? "Saving..." : "Create Report"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
