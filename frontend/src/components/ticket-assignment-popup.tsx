import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Check, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { apiRequestJson, queryClient } from "@/lib/queryClient";

type PendingAssignment = {
  id: string;
  subject: string;
  priority: string;
  status: string;
  customer?: { companyName?: string } | null;
};

// Sticky "you've been assigned a ticket" popup — shown app-wide (mounted once
// in App.tsx) for ANY authenticated role, since a ticket's "Person" can be
// anyone. Deliberately not built on the shared Dialog: no close button, no
// escape-to-dismiss, no overlay-click-to-dismiss — it only goes away once
// every pending assignment has been Accepted or Rejected.
export function TicketAssignmentPopup() {
  const { toast } = useToast();
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const pendingQuery = useQuery<PendingAssignment[]>({
    queryKey: ["/api/support/tickets/my-assignments/pending"],
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  });

  const respondMutation = useMutation({
    mutationFn: async ({ id, action, reason }: { id: string; action: "accept" | "reject"; reason?: string }) =>
      apiRequestJson("POST", `/api/support/tickets/${id}/${action}`, action === "reject" ? { reason } : undefined),
    onSuccess: (_data, { action }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/support/tickets/my-assignments/pending"] });
      queryClient.invalidateQueries({ queryKey: ["/api/support/tickets/my-assignments/accepted"] });
      queryClient.invalidateQueries({ queryKey: ["/api/support/tickets"] });
      toast({ title: action === "accept" ? "Ticket accepted" : "Ticket rejected" });
      setRejectingId(null);
      setRejectReason("");
    },
    onError: (error: any) => {
      toast({ title: "Failed to respond", description: error?.message || "Please try again", variant: "destructive" });
    },
  });

  const pending = pendingQuery.data ?? [];
  if (pending.length === 0) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-md rounded-xl bg-background border border-border shadow-2xl">
        <div className="px-5 py-4 border-b border-border">
          <h2 className="text-[15px] font-bold">
            {pending.length === 1 ? "New ticket assigned to you" : `${pending.length} new tickets assigned to you`}
          </h2>
          <p className="text-[12px] text-muted-foreground mt-0.5">Accept or reject to continue.</p>
        </div>
        <div className="max-h-[60vh] overflow-y-auto divide-y divide-border">
          {pending.map((t) => {
            const isRejecting = rejectingId === t.id;
            return (
              <div key={t.id} className="px-5 py-4 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[13px] font-bold">{t.customer?.companyName || "No company linked"}</span>
                  <span className="text-[11px] font-bold uppercase text-rose-600">{t.priority}</span>
                </div>
                <p className="text-[12px] text-muted-foreground">{t.subject}</p>

                {isRejecting ? (
                  <div className="space-y-2 pt-1">
                    <textarea
                      autoFocus
                      value={rejectReason}
                      onChange={(e) => setRejectReason(e.target.value)}
                      placeholder="Why are you rejecting this? (required)"
                      rows={2}
                      className="w-full rounded-md border border-border bg-transparent p-2 text-[12px] resize-none focus:outline-none focus:ring-2 focus:ring-rose-500/30"
                    />
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="destructive"
                        disabled={respondMutation.isPending || !rejectReason.trim()}
                        onClick={() => respondMutation.mutate({ id: t.id, action: "reject", reason: rejectReason.trim() })}
                        className="flex-1 font-bold h-9"
                      >
                        {respondMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirm Reject"}
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={respondMutation.isPending}
                        onClick={() => { setRejectingId(null); setRejectReason(""); }}
                        className="flex-1 font-bold h-9"
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 pt-1">
                    <Button
                      size="sm"
                      disabled={respondMutation.isPending}
                      onClick={() => respondMutation.mutate({ id: t.id, action: "accept" })}
                      className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-9"
                    >
                      {respondMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4 mr-1" />}
                      Accept
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={respondMutation.isPending}
                      onClick={() => setRejectingId(t.id)}
                      className="flex-1 font-bold h-9"
                    >
                      <X className="h-4 w-4 mr-1" />
                      Reject
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
