import { useMutation, useQuery } from "@tanstack/react-query";
import { Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { apiRequestJson, queryClient } from "@/lib/queryClient";

type PendingReview = {
  id: string;
  subject: string;
  priority: string;
  status: string;
  customer?: { companyName?: string } | null;
  assignedTo?: { name?: string } | null;
};

// Sticky "complaint submitted for review" popup — shown app-wide (mounted
// once in App.tsx) for whoever created the ticket (usually the complaint
// manager). Mirrors ticket-assignment-popup.tsx: no close button, no
// escape/overlay dismiss — it only goes away once every submission is
// approved.
export function TicketReviewPopup() {
  const { toast } = useToast();

  const pendingQuery = useQuery<PendingReview[]>({
    queryKey: ["/api/support/tickets/my-submissions/pending-review"],
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  });

  const approveMutation = useMutation({
    mutationFn: async (id: string) => apiRequestJson("POST", `/api/support/tickets/${id}/approve`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/support/tickets/my-submissions/pending-review"] });
      queryClient.invalidateQueries({ queryKey: ["/api/support/tickets"] });
      toast({ title: "Complaint approved" });
    },
    onError: (error: any) => {
      toast({ title: "Failed to approve", description: error?.message || "Please try again", variant: "destructive" });
    },
  });

  const pending = pendingQuery.data ?? [];
  if (pending.length === 0) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-md rounded-xl bg-background border border-border shadow-2xl">
        <div className="px-5 py-4 border-b border-border">
          <h2 className="text-[15px] font-bold">
            {pending.length === 1 ? "A complaint was submitted for review" : `${pending.length} complaints submitted for review`}
          </h2>
          <p className="text-[12px] text-muted-foreground mt-0.5">Approve to close it out.</p>
        </div>
        <div className="max-h-[60vh] overflow-y-auto divide-y divide-border">
          {pending.map((t) => (
            <div key={t.id} className="px-5 py-4 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[13px] font-bold">{t.customer?.companyName || "No company linked"}</span>
                <span className="text-[11px] font-bold uppercase text-rose-600">{t.priority}</span>
              </div>
              <p className="text-[12px] text-muted-foreground">{t.subject}</p>
              {t.assignedTo?.name && (
                <p className="text-[11px] text-muted-foreground">Submitted by <span className="font-bold">{t.assignedTo.name}</span></p>
              )}
              <Button
                size="sm"
                disabled={approveMutation.isPending}
                onClick={() => approveMutation.mutate(t.id)}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-9"
              >
                {approveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4 mr-1" />}
                OK / Approve
              </Button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
