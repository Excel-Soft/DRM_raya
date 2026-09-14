import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface PenaltyRow {
    id: string;
    employeeId: string;
    employeeName: string | null;
    penaltyHead: string;
    reason: string | null;
    amount: string | number;
    penaltyDate: string;
    approvalStatus: "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";
    status: "ACTIVE" | "VOIDED";
    employeeAcknowledgedAt: string | null;
    hodRemarks: string | null;
}
interface ListResult {
    data: PenaltyRow[];
    pagination?: { page: number; limit: number; total: number; totalPages: number };
}
interface CurrentUser {
    id: string;
}

function approvalBadgeVariant(status: PenaltyRow["approvalStatus"]) {
    switch (status) {
        case "APPROVED":
            return "default" as const;
        case "REJECTED":
            return "destructive" as const;
        case "CANCELLED":
            return "outline" as const;
        default:
            return "secondary" as const;
    }
}

const safeDate = (v: string | null | undefined) => {
    if (!v) return "—";
    const d = new Date(v);
    return isNaN(d.getTime()) ? "—" : d.toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" });
};

export default function ServiceMyPenalties() {
    const { toast } = useToast();

    const meQuery = useQuery<CurrentUser>({
        queryKey: ["/api/auth/me"],
        queryFn: async () => {
            const res = await apiRequest("GET", "/api/auth/me");
            if (!res.ok) throw new Error("Failed to load current user");
            return res.json();
        },
    });
    const selfId = meQuery.data?.id;

    const listQuery = useQuery<ListResult>({
        queryKey: ["/api/penalties", "self", selfId],
        queryFn: async () => {
            const p = new URLSearchParams();
            p.set("employeeId", String(selfId));
            p.set("limit", "100");
            const res = await apiRequest("GET", `/api/penalties?${p.toString()}`);
            if (!res.ok) throw new Error("Failed to load penalties");
            return res.json();
        },
        enabled: !!selfId,
    });

    const rows = listQuery.data?.data ?? [];

    const acknowledgeMutation = useMutation({
        mutationFn: async (id: string) => {
            const res = await apiRequest("PATCH", `/api/penalties/${id}/acknowledge`);
            const json = await res.json();
            if (!res.ok) throw new Error(json?.message || "Failed to acknowledge penalty");
            return json;
        },
        onSuccess: () => {
            toast({ title: "Penalty acknowledged" });
            queryClient.invalidateQueries({ queryKey: ["/api/penalties", "self", selfId] });
        },
        onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
    });

    return (
        <div className="bg-[#f8fafc] font-sans p-4 min-h-screen dark:bg-zinc-950">
            <div className="mb-6 flex items-center gap-1">
                <h2 className="text-[17px] font-bold text-[#475569] uppercase tracking-tight dark:text-zinc-400">MY PENALTIES</h2>
            </div>

            <Card className="border-slate-100 dark:border-zinc-800">
                <CardHeader>
                    <CardTitle className="text-base text-gray-600 dark:text-zinc-300">Penalties filed against me</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="overflow-x-auto border border-slate-100 rounded dark:border-zinc-800">
                        <Table>
                            <TableHeader className="bg-[#f1f5f9] dark:bg-zinc-800">
                                <TableRow className="border-b border-slate-200 hover:bg-[#f1f5f9] dark:hover:bg-zinc-800 dark:border-zinc-800">
                                    <TableHead className="text-[12px] font-bold text-[#475569] py-4 whitespace-nowrap border-r border-slate-200 dark:text-zinc-400 dark:border-zinc-800">Head</TableHead>
                                    <TableHead className="text-[12px] font-bold text-[#475569] py-4 whitespace-nowrap border-r border-slate-200 w-[25%] dark:text-zinc-400 dark:border-zinc-800">Reason</TableHead>
                                    <TableHead className="text-[12px] font-bold text-[#475569] py-4 whitespace-nowrap border-r border-slate-200 dark:text-zinc-400 dark:border-zinc-800">Amount</TableHead>
                                    <TableHead className="text-[12px] font-bold text-[#475569] py-4 whitespace-nowrap border-r border-slate-200 dark:text-zinc-400 dark:border-zinc-800">Date</TableHead>
                                    <TableHead className="text-[12px] font-bold text-[#475569] py-4 whitespace-nowrap border-r border-slate-200 dark:text-zinc-400 dark:border-zinc-800">Status</TableHead>
                                    <TableHead className="text-[12px] font-bold text-[#475569] py-4 whitespace-nowrap w-[14%] dark:text-zinc-400">Acknowledge</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {!selfId || listQuery.isLoading ? (
                                    <TableRow className="hover:bg-transparent border-b border-slate-100 dark:border-zinc-800">
                                        <TableCell colSpan={6} className="text-center py-4 text-[13px] text-slate-500 font-medium dark:text-zinc-400">
                                            Loading...
                                        </TableCell>
                                    </TableRow>
                                ) : rows.length === 0 ? (
                                    <TableRow className="hover:bg-transparent border-b border-slate-100 dark:border-zinc-800">
                                        <TableCell colSpan={6} className="text-center py-4 text-[13px] text-slate-500 font-medium dark:text-zinc-400">
                                            No penalties on record
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    rows.map((row) => {
                                        const acknowledged = !!row.employeeAcknowledgedAt;
                                        const voided = row.status === "VOIDED";
                                        return (
                                            <TableRow key={row.id} className="hover:bg-transparent border-b border-slate-100 text-[13px] font-medium text-[#475569] h-12 dark:text-zinc-400 dark:border-zinc-800">
                                                <TableCell className="py-2 border-r border-slate-100 dark:border-zinc-800">{row.penaltyHead || "—"}</TableCell>
                                                <TableCell className="py-2 border-r border-slate-100 dark:border-zinc-800">{row.reason || "—"}</TableCell>
                                                <TableCell className="py-2 border-r border-slate-100 dark:border-zinc-800">{row.amount ?? "—"}</TableCell>
                                                <TableCell className="py-2 border-r border-slate-100 dark:border-zinc-800">{safeDate(row.penaltyDate)}</TableCell>
                                                <TableCell className="py-2 border-r border-slate-100 dark:border-zinc-800">
                                                    <Badge variant={approvalBadgeVariant(row.approvalStatus)}>
                                                        {voided ? "VOIDED" : row.approvalStatus}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="py-2">
                                                    {voided ? (
                                                        <span className="text-slate-400 dark:text-zinc-500">—</span>
                                                    ) : acknowledged ? (
                                                        <Badge variant="outline">Acknowledged</Badge>
                                                    ) : (
                                                        <Button
                                                            size="sm"
                                                            disabled={acknowledgeMutation.isPending}
                                                            onClick={() => acknowledgeMutation.mutate(row.id)}
                                                            className="bg-[#059669] hover:bg-[#047857] text-white h-8 px-3 text-[12px]"
                                                        >
                                                            Acknowledge
                                                        </Button>
                                                    )}
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
