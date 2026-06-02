import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { apiRequest } from "@/lib/queryClient";
import { Check, X, ShieldAlert } from "lucide-react";

export function ProductPostingApprovalsWidget({ role }: { role: "HOD" | "Account Manager" }) {
    const queryClient = useQueryClient();
    const [rejectId, setRejectId] = useState<string | null>(null);
    const [rejectReason, setRejectReason] = useState("");

    const { data: invoicesData, isLoading } = useQuery({
        queryKey: ["/api/invoices"],
        queryFn: async () => {
            const res = await apiRequest("GET", "/api/invoices");
            return res.json();
        }
    });

    const approveMutation = useMutation({
        mutationFn: async ({ id, action, reason }: { id: string, action: string, reason?: string }) => {
            await apiRequest("PUT", `/api/invoices/${id}/approve`, { action, reason });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
            setRejectId(null);
            setRejectReason("");
        }
    });

    const invoices = invoicesData?.data || [];

    // Filter invoices based on which role is viewing the queue
    const targetStatus = role === "HOD" ? "PENDING_HOD" : "PENDING_ACCOUNT";
    const pendingInvoices = invoices.filter((inv: any) => inv.status === targetStatus);

    if (isLoading) return <div>Loading approvals...</div>;

    return (
        <Card className="col-span-1 border shadow-sm">
            <CardHeader className="pb-2 bg-slate-50 border-b dark:bg-zinc-900">
                <CardTitle className="text-base font-bold flex items-center gap-2">
                    <ShieldAlert className="h-4 w-4 text-primary" />
                    {role} Invoice Approvals
                </CardTitle>
                <CardDescription className="text-xs">
                    Review and approve pending product posting invoices.
                </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
                <div className="max-h-[400px] overflow-auto">
                    {pendingInvoices.length === 0 ? (
                        <div className="p-4 text-center text-sm text-muted-foreground">
                            No pending invoices at this stage.
                        </div>
                    ) : (
                        pendingInvoices.map((inv: any) => (
                            <div key={inv.id} className="flex flex-col p-4 border-b hover:bg-slate-50 transition-colors dark:hover:bg-zinc-800">
                                <div className="flex justify-between items-center mb-2">
                                    <span className="text-sm font-semibold">INV-{inv.id.substring(0, 6)}</span>
                                    <span className="text-sm text-emerald-600 font-bold">${inv.amount}</span>
                                </div>

                                {rejectId === inv.id ? (
                                    <div className="flex flex-col gap-2 mt-2">
                                        <Input
                                            size={1}
                                            className="h-8 text-xs"
                                            placeholder="Reason for rejection..."
                                            value={rejectReason}
                                            onChange={e => setRejectReason(e.target.value)}
                                        />
                                        <div className="flex gap-2 justify-end">
                                            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setRejectId(null)}>Cancel</Button>
                                            <Button variant="destructive" size="sm" className="h-7 text-xs"
                                                onClick={() => approveMutation.mutate({ id: inv.id, action: "REJECT", reason: rejectReason })}
                                                disabled={approveMutation.isPending || !rejectReason}
                                            >Confirm Reject</Button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex gap-2 justify-end mt-2">
                                        <Button
                                            variant="outline" size="sm" className="h-7 text-xs text-red-600 border-red-200 hover:bg-red-50"
                                            onClick={() => setRejectId(inv.id)}
                                        >
                                            <X className="h-3 w-3 mr-1" /> Reject
                                        </Button>
                                        <Button
                                            variant="default" size="sm" className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700"
                                            onClick={() => approveMutation.mutate({ id: inv.id, action: "APPROVE" })}
                                            disabled={approveMutation.isPending}
                                        >
                                            <Check className="h-3 w-3 mr-1" /> Approve
                                        </Button>
                                    </div>
                                )}
                            </div>
                        ))
                    )}
                </div>
            </CardContent>
        </Card>
    );
}
