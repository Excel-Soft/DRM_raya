import { useState, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Check, Loader2, MessageSquareWarning } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { apiRequestJson, queryClient } from "@/lib/queryClient";

function safeDate(v: string | null | undefined) {
  if (!v) return "—";
  const d = new Date(v);
  return isNaN(d.getTime()) ? "—" : d.toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" });
}

type PendingPenalty = {
  id: string;
  penaltyHead: string;
  reason: string;
  amount: string | number;
  penaltyDate: string;
  addedByName?: string | null;
};

// Sticky "you have a penalty to review" popup — shown app-wide (mounted once
// in App.tsx) for ANY authenticated role. Mirrors ticket-assignment-popup.tsx:
// no close button, no escape-to-dismiss, no overlay-click-to-dismiss — it
// only goes away once every pending penalty has been Accepted or Disputed.
export function PenaltyAcknowledgementPopup() {
  const { toast } = useToast();
  const [disputingId, setDisputingId] = useState<string | null>(null);
  const [disputeReason, setDisputeReason] = useState("");

  const pendingQuery = useQuery<{ penalties: PendingPenalty[] }>({
    queryKey: ["/api/penalties/pending-acknowledgement"],
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  });

  const respondMutation = useMutation({
    mutationFn: async ({ id, action, reason }: { id: string; action: "accept" | "dispute"; reason?: string }) =>
      action === "accept"
        ? apiRequestJson("PATCH", `/api/penalties/${id}/acknowledge`, {})
        : apiRequestJson("PATCH", `/api/penalties/${id}/dispute`, { reason }),
    onSuccess: (_data, { action }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/penalties/pending-acknowledgement"] });
      queryClient.invalidateQueries({ queryKey: ["/api/penalties"] });
      toast({ title: action === "accept" ? "Penalty confirmed" : "Penalty rejected — sent for review" });
      setDisputingId(null);
      setDisputeReason("");
    },
    onError: (error: any) => {
      toast({ title: "Failed to respond", description: error?.message || "Please try again", variant: "destructive" });
    },
  });

  const pending = pendingQuery.data?.penalties ?? [];

  useEffect(() => {
    if (pending.length > 0) {
      void queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
    }
  }, [pending.length, queryClient]);

  if (pending.length === 0) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-md rounded-xl bg-background border border-border shadow-2xl">
        <div className="px-5 py-4 border-b border-border">
          <h2 className="text-[15px] font-bold">
            {pending.length === 1 ? "A penalty was recorded against you" : `${pending.length} penalties were recorded against you`}
          </h2>
          <p className="text-[12px] text-muted-foreground mt-0.5">Confirm the penalty, or reject it with a reason.</p>
        </div>
        <div className="max-h-[60vh] overflow-y-auto divide-y divide-border">
          {pending.map((p) => {
            const isDisputing = disputingId === p.id;
            return (
              <div key={p.id} className="px-5 py-4 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[13px] font-bold">{p.penaltyHead}</span>
                  <span className="text-[13px] font-bold text-rose-600">PKR {Number(p.amount || 0).toLocaleString()}</span>
                </div>
                <p className="text-[12px] text-muted-foreground">{p.reason}</p>
                <p className="text-[11px] text-muted-foreground">
                  {safeDate(p.penaltyDate)}{p.addedByName ? ` · Added by ${p.addedByName}` : ""}
                </p>

                {isDisputing ? (
                  <div className="space-y-2 pt-1">
                    <textarea
                      autoFocus
                      value={disputeReason}
                      onChange={(e) => setDisputeReason(e.target.value)}
                      placeholder="Why are you rejecting this? (required)"
                      rows={2}
                      className="w-full rounded-md border border-border bg-transparent p-2 text-[12px] resize-none focus:outline-none focus:ring-2 focus:ring-rose-500/30"
                    />
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="destructive"
                        disabled={respondMutation.isPending || !disputeReason.trim()}
                        onClick={() => respondMutation.mutate({ id: p.id, action: "dispute", reason: disputeReason.trim() })}
                        className="flex-1 font-bold h-9"
                      >
                        {respondMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Submit Rejection"}
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={respondMutation.isPending}
                        onClick={() => { setDisputingId(null); setDisputeReason(""); }}
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
                      onClick={() => respondMutation.mutate({ id: p.id, action: "accept" })}
                      className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-9"
                    >
                      {respondMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4 mr-1" />}
                      Confirm
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={respondMutation.isPending}
                      onClick={() => setDisputingId(p.id)}
                      className="flex-1 font-bold h-9"
                    >
                      <MessageSquareWarning className="h-4 w-4 mr-1" />
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
