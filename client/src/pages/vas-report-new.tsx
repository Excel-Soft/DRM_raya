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

export default function VasReportNew() {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();

  const [title, setTitle] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [status, setStatus] = useState("Draft");
  const [reportDate, setReportDate] = useState(new Date().toISOString().slice(0, 10));
  const [summary, setSummary] = useState("");
  const [notes, setNotes] = useState("");
  const [totalTasks, setTotalTasks] = useState<number | undefined>(undefined);
  const [valueSold, setValueSold] = useState<number | undefined>(undefined);
  const [successRate, setSuccessRate] = useState<number | undefined>(undefined);
  const [followUpsDone, setFollowUpsDone] = useState<number | undefined>(undefined);
  const [missedLeads, setMissedLeads] = useState<number | undefined>(undefined);

  const createMutation = useMutation({
    mutationFn: async () => {
      const body: any = {
        title: title || null,
        customerId: customerId || null,
        status,
        reportDate,
        summary: summary || null,
        notes: notes || null,
        totalTasks: totalTasks ?? 0,
        valueSold: valueSold ?? 0,
        successRate: successRate ?? 0,
        followUpsDone: followUpsDone ?? 0,
        missedLeads: missedLeads ?? 0,
      };
      const res = await apiRequest("POST", "/api/vas-reports", body);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "VAS Report created" });
      queryClient.invalidateQueries({ queryKey: ["/api/reports", "vas"] });
      queryClient.invalidateQueries({ predicate: (q) => Array.isArray(q.queryKey) && q.queryKey.includes("/api/reports") });
      navigate("/reports/vas");
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err?.message || "Failed to create VAS report", variant: "destructive" });
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
          <CardTitle>Create VAS Report</CardTitle>
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
                <Label>Total Tasks</Label>
                <Input type="number" value={totalTasks ?? ""} onChange={(e) => setTotalTasks(e.target.value ? Number(e.target.value) : undefined)} />
              </div>
              <div>
                <Label>Value Sold</Label>
                <Input type="number" step="0.01" value={valueSold ?? ""} onChange={(e) => setValueSold(e.target.value ? Number(e.target.value) : undefined)} />
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
