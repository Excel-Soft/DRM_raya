import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

export default function BvReportNew() {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const statusOptions = ["Draft", "Submitted", "Approved", "Rejected"] as const;

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

  const isValidUuid = (val: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);
  const trimmedCustomer = customerId.trim();
  const { data: customerOptions = [] } = useQuery({
    queryKey: ["/api/customers", trimmedCustomer],
    enabled: trimmedCustomer.length >= 2,
    queryFn: async () => {
      const res = await apiRequest(
        "GET",
        `/api/customers?search=${encodeURIComponent(trimmedCustomer)}&page=1&pageSize=15`
      );
      const data = await res.json();
      return (data?.customers as any[]) ?? [];
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const trimmedTitle = title.trim();
      const safeStatus = statusOptions.includes(status as typeof statusOptions[number]) ? status : "Draft";
      const body: any = {
        title: trimmedTitle,
        customerId: customerId || null,
        status: safeStatus,
        reportDate,
        summary: summary.trim() || null,
        notes: notes.trim() || null,
        totalTasks: totalTasks ?? 0,
        valueSold: valueSold ?? 0,
        successRate: successRate ?? 0,
        followUpsDone: followUpsDone ?? 0,
        missedLeads: missedLeads ?? 0,
      };
      console.debug("[BV Report] submitting payload", {
        ...body,
        summary: body.summary ? `(len ${body.summary.length})` : null,
        notes: body.notes ? `(len ${body.notes.length})` : null,
      });
      const res = await apiRequest("POST", "/api/bv-reports", body);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "BV Report created" });
      queryClient.invalidateQueries({
        predicate: (q) =>
          Array.isArray(q.queryKey) &&
          q.queryKey.some((k) => typeof k === "string" && k.includes("/api/reports")),
      });
      queryClient.invalidateQueries({ queryKey: ["/api/bv-reports"] });
      navigate("/reports/bv");
    },
    onError: (err: any) => {
      const msg = err?.message || err?.error || "Failed to create BV report";
      const detail = err?.error === "INVALID_CUSTOMER"
        ? "Customer not found. Pick an existing customer from the list or leave the field blank."
        : undefined;
      toast({ title: "Error", description: detail ? `${msg}. ${detail}` : msg, variant: "destructive" });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (title.trim().length < 2) {
      toast({ title: "Title is required", description: "Please enter at least 2 characters.", variant: "destructive" });
      return;
    }
    if (trimmedCustomer && !isValidUuid(trimmedCustomer)) {
      toast({
        title: "Customer ID is invalid",
        description: "Select a customer from the list or clear the field to leave it blank.",
        variant: "destructive",
      });
      return;
    }
    createMutation.mutate();
  };

  return (
    <div className="p-6">
      <Card className="max-w-3xl mx-auto">
        <CardHeader>
          <CardTitle>Create BV Report</CardTitle>
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
                <Input
                  list="bv-status-options"
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  placeholder="Draft / Submitted"
                />
                <datalist id="bv-status-options">
                  {statusOptions.map(option => (
                    <option key={option} value={option} />
                  ))}
                </datalist>
              </div>
              <div>
                <Label>Customer ID (optional)</Label>
                <Input
                  list="bv-customer-options"
                  value={customerId}
                  onChange={(e) => setCustomerId(e.target.value)}
                  placeholder="UUID of customer"
                />
                <datalist id="bv-customer-options">
                  {customerOptions.map((c: any) => (
                    <option
                      key={c.id}
                      value={c.id}
                    >{`${c.companyName || c.accountName || "Customer"} • ${c.email || c.phone || ""}`}</option>
                  ))}
                </datalist>
              </div>
              <div>
                <Label>Report Date</Label>
                <Input
                  type="date"
                  value={reportDate}
                  onChange={(e) => setReportDate(e.target.value)}
                />
              </div>
              <div>
                <Label>Total Tasks</Label>
                <Input
                  type="number"
                  min={0}
                  value={totalTasks ?? ""}
                  onChange={(e) => setTotalTasks(e.target.value ? Number(e.target.value) : undefined)}
                />
              </div>
              <div>
                <Label>Value Sold</Label>
                <Input
                  type="number"
                  step="0.01"
                  min={0}
                  value={valueSold ?? ""}
                  onChange={(e) => setValueSold(e.target.value ? Number(e.target.value) : undefined)}
                />
              </div>
              <div>
                <Label>Success Rate (%)</Label>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={successRate ?? ""}
                  onChange={(e) => setSuccessRate(e.target.value ? Number(e.target.value) : undefined)}
                />
              </div>
              <div>
                <Label>Follow-ups Done</Label>
                <Input
                  type="number"
                  min={0}
                  value={followUpsDone ?? ""}
                  onChange={(e) => setFollowUpsDone(e.target.value ? Number(e.target.value) : undefined)}
                />
              </div>
              <div>
                <Label>Missed Leads</Label>
                <Input
                  type="number"
                  min={0}
                  value={missedLeads ?? ""}
                  onChange={(e) => setMissedLeads(e.target.value ? Number(e.target.value) : undefined)}
                />
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

            <Button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700 text-white" disabled={createMutation.isPending}>
              {createMutation.isPending ? "Saving..." : "Create BV Report"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
