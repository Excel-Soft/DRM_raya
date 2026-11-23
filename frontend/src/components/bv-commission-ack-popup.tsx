import { useMutation, useQuery } from "@tanstack/react-query";
import { Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { apiRequestJson, queryClient } from "@/lib/queryClient";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

type PendingCommission = {
  id: string;
  commMonth: number;
  commYear: number;
  totalComm: string | number;
  totalReward: string | number;
  abReward: string | number | null;
  rewardComment: string | null;
  finalPayAmount: string | number | null;
};

const money = (v: unknown) => Number(v ?? 0).toLocaleString();

// App-wide (mounted once in App.tsx, same pattern as PenaltyAcknowledgementPopup):
// once HOD/Account verify a salesperson's BV commission on the BV Report, the
// salesperson sees this on any page until they acknowledge it.
export function BvCommissionAckPopup() {
  const { toast } = useToast();
  const pendingQuery = useQuery<{ records: PendingCommission[] }>({
    queryKey: ["/api/bv-commission-verifications/pending-mine"],
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  });

  const ackMutation = useMutation({
    mutationFn: async (id: string) => apiRequestJson("POST", `/api/bv-commission-verifications/${id}/confirm`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bv-commission-verifications/pending-mine"] });
      queryClient.invalidateQueries({ queryKey: ["/api/bv-commission-verifications"] });
      toast({ title: "Commission acknowledged" });
    },
    onError: (error: any) => {
      toast({ title: "Failed to acknowledge", description: error?.message || "Please try again", variant: "destructive" });
    },
  });

  const pending = pendingQuery.data?.records ?? [];
  if (pending.length === 0) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-md rounded-xl bg-background border border-border shadow-2xl">
        <div className="px-5 py-4 border-b border-border">
          <h2 className="text-[15px] font-bold">
            {pending.length === 1 ? "Your BV commission was verified" : `${pending.length} BV commissions were verified`}
          </h2>
          <p className="text-[12px] text-muted-foreground mt-0.5">Please review and acknowledge.</p>
        </div>
        <div className="max-h-[60vh] overflow-y-auto divide-y divide-border">
          {pending.map((p) => {
            const reward = Number(p.totalReward ?? 0) + Number(p.abReward ?? 0);
            return (
              <div key={p.id} className="px-5 py-4 space-y-2">
                <div className="text-[13px] font-bold">
                  {MONTHS[p.commMonth - 1] ?? p.commMonth} {p.commYear}
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[12px]">
                  <span className="text-muted-foreground">Total Comm</span>
                  <span className="text-right font-semibold">{money(p.totalComm)}</span>
                  <span className="text-muted-foreground">Reward</span>
                  <span className="text-right font-semibold">{money(reward)}</span>
                  {p.abReward != null && Number(p.abReward) !== 0 && (
                    <>
                      <span className="text-muted-foreground pl-2">incl. Reward AB</span>
                      <span className="text-right">{money(p.abReward)}</span>
                    </>
                  )}
                  <span className="text-muted-foreground font-bold">Final Amount</span>
                  <span className="text-right font-bold text-emerald-600">{money(p.finalPayAmount)}</span>
                </div>
                {p.rewardComment && <p className="text-[11px] text-muted-foreground">{p.rewardComment}</p>}
                <Button
                  size="sm"
                  disabled={ackMutation.isPending}
                  onClick={() => ackMutation.mutate(p.id)}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-9"
                >
                  {ackMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4 mr-1" />}
                  Acknowledge
                </Button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
