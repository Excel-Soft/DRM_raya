// Reception report — reads GET /api/reports/reception which returns reception
// meetings from drm.meetings as { data, total, page, pageSize }. Filters:
// dateFrom/dateTo (start/end date), status, userId + pagination. Columns adapt
// to meeting fields. Renders real-or-empty data only.
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequestJson } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type ReceptionRow = {
  id: string;
  meeting_type: string | null;
  person_name: string | null;
  status: string | null;
  meeting_date: string | null;
  scheduled_time: string | null;
  start_time: string | null;
  end_time: string | null;
  total_duration_seconds: number | null;
  created_at: string | null;
  company_name: string | null;
};

type ReceptionResponse = {
  data: ReceptionRow[];
  total: number;
  page: number;
  pageSize: number;
};

function fmtDate(value: string | null): string {
  if (!value) return "-";
  const d = new Date(value);
  if (isNaN(d.getTime())) return "-";
  return d.toISOString().slice(0, 10);
}

function fmtTime(value: string | null): string {
  if (!value) return "-";
  const d = new Date(value);
  if (!isNaN(d.getTime())) return d.toISOString().slice(11, 16);
  return value;
}

function fmtDuration(seconds: number | null): string {
  if (!seconds || seconds <= 0) return "-";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${h}h ${m}m ${s}s`;
}

const STATUS_OPTIONS = ["scheduled", "in_progress", "completed", "cancelled"] as const;

export default function ReceptionReport() {
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [status, setStatus] = useState("all");
  const [user, setUser] = useState("all");
  const [page, setPage] = useState(1);
  const [applied, setApplied] = useState<{
    startDate: string;
    endDate: string;
    status: string;
    user: string;
  } | null>(null);

  const { data: users = [] } = useQuery<any[]>({
    queryKey: ["/api/account/users-list"],
    queryFn: async () => apiRequestJson("GET", "/api/account/users-list"),
  });

  const report = useQuery<ReceptionResponse>({
    queryKey: ["/api/reports/reception", applied, page],
    enabled: !!applied,
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page), pageSize: "50" });
      if (applied?.user && applied.user !== "all") params.set("userId", applied.user);
      if (applied?.status && applied.status !== "all") params.set("status", applied.status);
      if (applied?.startDate) params.set("startDate", applied.startDate);
      if (applied?.endDate) params.set("endDate", applied.endDate);
      return apiRequestJson("GET", `/api/reports/reception?${params.toString()}`);
    },
  });

  const handleView = () => {
    setPage(1);
    setApplied({ startDate, endDate, status, user });
  };

  const rows = report.data?.data ?? [];
  const total = report.data?.total ?? 0;
  const pageSize = report.data?.pageSize ?? 50;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="flex-1 overflow-auto bg-[#f4f6f9] min-h-screen">
      <div className="p-4 max-w-[1600px] mx-auto space-y-6">

        {/* Header */}
        <h1 className="text-[17px] font-bold text-[#555] uppercase tracking-wide">
          RECEPTION REPORT
        </h1>

        {/* Filter Card */}
        <Card className="border-none shadow-sm bg-white rounded-sm">
          <CardContent className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">

              {/* Select User */}
              <div className="flex flex-col gap-2">
                <Label className="text-[13px] font-bold text-[#555]">Select User</Label>
                <Select value={user} onValueChange={setUser}>
                  <SelectTrigger className="h-9 bg-white border-slate-200 text-[#555] text-[13px] focus:ring-0">
                    <SelectValue placeholder="Choose..." />
                  </SelectTrigger>
                  <SelectContent className="max-h-[300px]">
                    <SelectItem value="all">All Users</SelectItem>
                    {users.map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.full_name} {u.role ? `(${u.role})` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Status */}
              <div className="flex flex-col gap-2">
                <Label className="text-[13px] font-bold text-[#555]">Status</Label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger className="h-9 bg-white border-slate-200 text-[#555] text-[13px] focus:ring-0">
                    <SelectValue placeholder="All" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    {STATUS_OPTIONS.map((st) => (
                      <SelectItem key={st} value={st}>{st}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Start Date */}
              <div className="flex flex-col gap-2">
                <Label className="text-[13px] font-bold text-[#555]">Start Date</Label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="h-9 bg-white border-slate-200 text-[#555] text-[13px] focus-visible:ring-0"
                />
              </div>

              {/* End Date */}
              <div className="flex flex-col gap-2">
                <Label className="text-[13px] font-bold text-[#555]">End Date</Label>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="h-9 bg-white border-slate-200 text-[#555] text-[13px] focus-visible:ring-0"
                />
              </div>
            </div>

            <div className="mt-6">
              <Button
                onClick={handleView}
                className="bg-[#00a65a] hover:bg-[#008d4c] text-white px-8 h-9 font-semibold rounded-sm"
              >
                View
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Report Table Card */}
        <Card className="border-none shadow-sm bg-white rounded-sm overflow-hidden">
          <CardHeader className="border-b border-slate-100 py-4 px-6 bg-white">
            <CardTitle className="text-[15px] font-bold text-[#555]">
              View Reception Report
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <div className="overflow-x-auto">
              <Table className="w-full text-[13px] whitespace-nowrap">
                <TableHeader>
                  <TableRow className="border-b-0 bg-[#d9f2e6] hover:bg-[#d9f2e6]">
                    <TableHead className="py-3 px-4 font-bold text-[#333] text-left">Company</TableHead>
                    <TableHead className="py-3 px-4 font-bold text-[#333] text-left">Person</TableHead>
                    <TableHead className="py-3 px-4 font-bold text-[#333] text-left">Meeting Type</TableHead>
                    <TableHead className="py-3 px-4 font-bold text-[#333] text-left">Date</TableHead>
                    <TableHead className="py-3 px-4 font-bold text-[#333] text-left">Start</TableHead>
                    <TableHead className="py-3 px-4 font-bold text-[#333] text-left">End</TableHead>
                    <TableHead className="py-3 px-4 font-bold text-[#333] text-left">Duration</TableHead>
                    <TableHead className="py-3 px-4 font-bold text-[#333] text-left">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="bg-white">
                  {!applied ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                        Set your filters and click View to load the reception report.
                      </TableCell>
                    </TableRow>
                  ) : report.isLoading ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                        Loading...
                      </TableCell>
                    </TableRow>
                  ) : report.isError ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center text-[#d9534f] py-8">
                        Could not load the reception report. Please try again.
                      </TableCell>
                    </TableRow>
                  ) : rows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                        No reception records found.
                      </TableCell>
                    </TableRow>
                  ) : (
                    rows.map((item) => (
                      <TableRow key={item.id} className="border-b border-slate-100 hover:bg-[#f8f9fa] transition-colors">
                        <TableCell className="py-3 px-4 text-[#555]">{item.company_name || "-"}</TableCell>
                        <TableCell className="py-3 px-4 text-[#555]">{item.person_name || "-"}</TableCell>
                        <TableCell className="py-3 px-4 text-[#555]">{item.meeting_type || "-"}</TableCell>
                        <TableCell className="py-3 px-4 text-[#555]">{fmtDate(item.meeting_date)}</TableCell>
                        <TableCell className="py-3 px-4 text-[#555]">{fmtTime(item.start_time)}</TableCell>
                        <TableCell className="py-3 px-4 text-[#555]">{fmtTime(item.end_time)}</TableCell>
                        <TableCell className="py-3 px-4 text-[#555]">{fmtDuration(item.total_duration_seconds)}</TableCell>
                        <TableCell className="py-3 px-4 text-[#555]">{item.status || "-"}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Pagination */}
            {applied && !report.isLoading && !report.isError && total > 0 && (
              <div className="flex items-center justify-between mt-4">
                <div className="text-xs text-[#555]">
                  Showing {rows.length} of {total} entries — page {page} of {totalPages}
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    className="h-8 px-3 text-xs border-slate-300 text-[#555]"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    className="h-8 px-3 text-xs border-slate-300 text-[#555]"
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
