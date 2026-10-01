import { useMutation, useQuery } from "@tanstack/react-query";
import { Inbox, Loader2, Send } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { apiRequestJson, queryClient } from "@/lib/queryClient";
import { cn } from "@/lib/utils";

type AcceptedAssignment = {
  id: string;
  subject: string;
  priority: string;
  status: string;
  customer?: { companyName?: string } | null;
};

// "Complaint Box" — tickets the current user has accepted responsibility for
// (see ticket-assignment-popup.tsx for the accept/reject step before a
// ticket lands here). Reusable: drop onto any dashboard.
export function ComplaintBoxWidget() {
  const { toast } = useToast();

  const acceptedQuery = useQuery<AcceptedAssignment[]>({
    queryKey: ["/api/support/tickets/my-assignments/accepted"],
  });
  const accepted = acceptedQuery.data ?? [];

  const submitMutation = useMutation({
    mutationFn: async (id: string) => apiRequestJson("POST", `/api/support/tickets/${id}/submit`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/support/tickets/my-assignments/accepted"] });
      queryClient.invalidateQueries({ queryKey: ["/api/support/tickets"] });
      toast({ title: "Submitted for review" });
    },
    onError: (error: any) => {
      toast({ title: "Failed to submit", description: error?.message || "Please try again", variant: "destructive" });
    },
  });

  return (
    <Card className="dashboard-card overflow-hidden">
      <CardHeader className="py-4 px-6 border-b flex flex-row items-center justify-between bg-muted/5">
        <CardTitle className="text-[14px] font-bold uppercase tracking-wide">Complaint Box</CardTitle>
        <Inbox className="h-4 w-4 text-emerald-500" />
      </CardHeader>
      <CardContent className="p-4 space-y-2">
        {acceptedQuery.isLoading ? (
          <p className="text-[12px] text-muted-foreground text-center py-6">Loading...</p>
        ) : accepted.length === 0 ? (
          <p className="text-[12px] text-muted-foreground text-center py-6">No complaints assigned to you yet.</p>
        ) : (
          accepted.map((t) => (
            <div key={t.id} className="flex items-center justify-between gap-2 rounded-md border border-border/50 px-3 py-2.5">
              <div className="min-w-0">
                <p className="text-[12px] font-bold truncate">{t.customer?.companyName || "No company linked"}</p>
                <p className="text-[11px] text-muted-foreground truncate">{t.subject}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Badge
                  className={cn(
                    "border-none",
                    t.priority === "High" ? "bg-rose-50 text-rose-600" : "bg-slate-100 text-slate-600"
                  )}
                >
                  {t.status}
                </Badge>
                {t.status === "InProgress" && (
                  <Button
                    size="sm"
                    disabled={submitMutation.isPending}
                    onClick={() => submitMutation.mutate(t.id)}
                    className="h-7 px-2.5 text-[11px] bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
                  >
                    {submitMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5 mr-1" />}
                    Submit
                  </Button>
                )}
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
