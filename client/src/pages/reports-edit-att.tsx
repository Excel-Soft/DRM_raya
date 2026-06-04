import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequestJson, queryClient } from "@/lib/queryClient";
import { isManagerialRole } from "@/lib/role-utils";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";

type AttendanceEdit = {
  id: string;
  user_id: string;
  attendance_date: string;
  field: string;
  before_value: string | null;
  after_value: string | null;
  reason: string;
  status: string;
  rejection_reason: string | null;
  employee_name: string | null;
  requested_by_name: string | null;
  reviewed_by_name: string | null;
  created_at: string;
};

function formatDate(value: string | null) {
  if (!value) return "-";
  const d = new Date(value);
  return isNaN(d.getTime()) ? "-" : d.toLocaleDateString();
}

export default function EditAtt() {
  const { toast } = useToast();
  const [search, setSearch] = useState("");

  const user = {
    userId: sessionStorage.getItem("userId") || "",
    roleId: sessionStorage.getItem("userRole") || "",
  };
  const isManager = isManagerialRole(user.roleId);

  const editsQuery = useQuery<{ edits: AttendanceEdit[] }>({
    queryKey: ["/api/attendance/edits"],
    queryFn: async () => apiRequestJson("GET", "/api/attendance/edits"),
  });

  const approve = useMutation({
    mutationFn: async (id: string) =>
      apiRequestJson("PATCH", `/api/attendance/edits/${id}/approve`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/attendance/edits"] });
      toast({ title: "Request approved" });
    },
    onError: () => {
      toast({ title: "Unable to approve", description: "You may not have permission, or the request is no longer pending.", variant: "destructive" });
    },
  });

  const reject = useMutation({
    mutationFn: async (id: string) => {
      const rejectionReason = window.prompt("Reason for rejection:");
      if (!rejectionReason || !rejectionReason.trim()) {
        throw new Error("cancelled");
      }
      return apiRequestJson("PATCH", `/api/attendance/edits/${id}/reject`, { rejectionReason: rejectionReason.trim() });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/attendance/edits"] });
      toast({ title: "Request rejected" });
    },
    onError: (err: any) => {
      if (err?.message === "cancelled") return;
      toast({ title: "Unable to reject", description: "You may not have permission, or the request is no longer pending.", variant: "destructive" });
    },
  });

  const edits = editsQuery.data?.edits ?? [];
  const term = search.trim().toLowerCase();
  const filtered = term
    ? edits.filter((e) =>
        (e.employee_name || "").toLowerCase().includes(term) ||
        (e.field || "").toLowerCase().includes(term) ||
        (e.status || "").toLowerCase().includes(term))
    : edits;

  function statusBadge(status: string) {
    const s = status.toLowerCase();
    const cls =
      s === "approved" ? "bg-[#e8f5e9] text-[#00a65a]" :
      s === "rejected" ? "bg-[#fdecea] text-[#d9534f]" :
      "bg-[#fff8e1] text-[#b8860b]";
    return <span className={`px-2 py-0.5 rounded text-xs font-semibold ${cls}`}>{status}</span>;
  }

  return (
    <div className="flex-1 overflow-auto bg-[#f4f6f9] min-h-screen">
      <div className="p-4 max-w-[1600px] mx-auto space-y-6">
        <div className="flex items-center gap-2 mb-4">
          <h1 className="text-[17px] font-bold text-[#555] uppercase">ATTENDANCE EDIT REQUESTS</h1>
        </div>

        <Card className="border-none shadow-sm bg-white rounded-sm">
          <CardContent className="p-4 space-y-4">

            <div className="flex items-center justify-between">
              <p className="text-xs text-slate-500">
                {isManager
                  ? "Review and approve or reject attendance edit requests."
                  : "Your attendance edit requests and their status."}
              </p>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-500">Search:</span>
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-[200px] h-8 bg-white border-slate-300 rounded-sm text-xs focus-visible:ring-0 focus-visible:border-slate-400"
                />
              </div>
            </div>

            <div className="overflow-x-auto border border-slate-100 mt-4">
              <Table className="w-full text-[13px] whitespace-nowrap">
                <TableHeader>
                  <TableRow className="border-b border-slate-200 hover:bg-transparent bg-[#fdf3db]">
                    <TableHead className="py-2.5 px-3 font-bold text-[#555] text-left text-xs">Employee</TableHead>
                    <TableHead className="py-2.5 px-3 font-bold text-[#555] text-left text-xs">Date</TableHead>
                    <TableHead className="py-2.5 px-3 font-bold text-[#555] text-left text-xs">Field</TableHead>
                    <TableHead className="py-2.5 px-3 font-bold text-[#555] text-left text-xs">Before</TableHead>
                    <TableHead className="py-2.5 px-3 font-bold text-[#555] text-left text-xs">After</TableHead>
                    <TableHead className="py-2.5 px-3 font-bold text-[#555] text-left text-xs">Reason</TableHead>
                    <TableHead className="py-2.5 px-3 font-bold text-[#555] text-left text-xs">Requested By</TableHead>
                    <TableHead className="py-2.5 px-3 font-bold text-[#555] text-left text-xs">Status</TableHead>
                    {isManager && (
                      <TableHead className="py-2.5 px-3 font-bold text-[#555] text-center text-xs">Actions</TableHead>
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody className="bg-white">
                  {editsQuery.isLoading ? (
                    <TableRow>
                      <TableCell colSpan={isManager ? 9 : 8} className="text-center text-muted-foreground py-8">Loading...</TableCell>
                    </TableRow>
                  ) : editsQuery.isError ? (
                    <TableRow>
                      <TableCell colSpan={isManager ? 9 : 8} className="text-center text-[#d9534f] py-8">
                        Could not load attendance edit requests.
                      </TableCell>
                    </TableRow>
                  ) : filtered.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={isManager ? 9 : 8} className="text-center text-muted-foreground py-8">
                        No attendance edit requests found.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filtered.map((e) => (
                      <TableRow key={e.id} className="border-b border-slate-100 hover:bg-[#f1f3f5] transition-colors">
                        <TableCell className="py-3 px-3 text-[#555] font-semibold">{e.employee_name || "-"}</TableCell>
                        <TableCell className="py-3 px-3 text-[#555]">{formatDate(e.attendance_date)}</TableCell>
                        <TableCell className="py-3 px-3 text-[#555]">{e.field}</TableCell>
                        <TableCell className="py-3 px-3 text-[#555]">{e.before_value ?? "-"}</TableCell>
                        <TableCell className="py-3 px-3 text-[#555]">{e.after_value ?? "-"}</TableCell>
                        <TableCell className="py-3 px-3 text-[#555] max-w-[240px] truncate" title={e.reason}>{e.reason}</TableCell>
                        <TableCell className="py-3 px-3 text-[#555]">{e.requested_by_name || "-"}</TableCell>
                        <TableCell className="py-3 px-3">{statusBadge(e.status)}</TableCell>
                        {isManager && (
                          <TableCell className="py-3 px-3 text-center">
                            {e.status === "Pending" ? (
                              <div className="flex items-center justify-center gap-2">
                                <Button
                                  size="sm"
                                  onClick={() => approve.mutate(e.id)}
                                  disabled={approve.isPending}
                                  className="h-7 px-3 bg-[#00a65a] hover:bg-[#008d4c] text-white text-xs rounded-sm"
                                >
                                  Approve
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => reject.mutate(e.id)}
                                  disabled={reject.isPending}
                                  className="h-7 px-3 border-[#d9534f] text-[#d9534f] hover:bg-[#fdecea] text-xs rounded-sm"
                                >
                                  Reject
                                </Button>
                              </div>
                            ) : (
                              <span className="text-xs text-slate-400">
                                {e.reviewed_by_name ? `by ${e.reviewed_by_name}` : "-"}
                              </span>
                            )}
                          </TableCell>
                        )}
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

          </CardContent>
        </Card>
      </div>
    </div>
  );
}
