import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequestJson } from "@/lib/queryClient";
import { Card, CardContent } from "@/components/ui/card";
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

type EventRow = {
  id: string;
  meeting_type: string | null;
  person_name: string | null;
  status: string | null;
  start_time: string | null;
  end_time: string | null;
  total_duration_seconds: number | null;
  meeting_date: string | null;
  company_name: string | null;
};

type EventResponse = {
  rows: EventRow[];
  total: number;
  page: number;
  pageSize: number;
};

function fmtTime(value: string | null): string {
  if (!value) return "-";
  const d = new Date(value);
  if (isNaN(d.getTime())) return "-";
  return d.toISOString().slice(0, 16).replace("T", " ");
}

function fmtDuration(seconds: number | null): string {
  if (!seconds || seconds <= 0) return "-";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${h}h ${m}m ${s}s`;
}

export default function EventReport() {
  const [eventSearch, setEventSearch] = useState("");
  const [selectedEvent, setSelectedEvent] = useState("");
  const [tableSearch, setTableSearch] = useState("");
  const [entries, setEntries] = useState("10");
  const [applied, setApplied] = useState(false);

  const query = useQuery<EventResponse>({
    queryKey: ["/api/reports/event", selectedEvent, applied],
    enabled: applied,
    queryFn: async () => {
      const params = new URLSearchParams({ page: "1", pageSize: "200" });
      if (selectedEvent) params.set("eventType", selectedEvent);
      return apiRequestJson("GET", `/api/reports/event?${params.toString()}`);
    },
  });

  const allRows = query.data?.rows ?? [];
  const pageSize = Number(entries) || 10;
  const search = tableSearch.trim().toLowerCase();
  const filtered = search
    ? allRows.filter((r) =>
        [r.meeting_type, r.company_name, r.person_name, r.status]
          .some((v) => (v || "").toLowerCase().includes(search)),
      )
    : allRows;
  const rows = filtered.slice(0, pageSize);

  return (
    <div className="flex-1 overflow-auto bg-[#f4f6f9] min-h-screen">
      <div className="p-4 max-w-[1600px] mx-auto space-y-6">

        {/* Header */}
        <h1 className="text-[17px] font-bold text-[#555] uppercase tracking-wide">
          WEB EXCELS EVENTS REPORT
        </h1>

        {/* Filter Card */}
        <Card className="border-none shadow-sm bg-white rounded-sm">
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row items-end gap-6 max-w-2xl">
              <div className="flex flex-col gap-2 w-full md:w-[400px]">
                <Label className="text-[13px] font-bold text-[#555]">Event Type (optional)</Label>
                <Input
                  placeholder="Filter by event/meeting type..."
                  value={eventSearch}
                  onChange={(e) => { setEventSearch(e.target.value); setSelectedEvent(e.target.value); }}
                  className="h-9 bg-white border-slate-200 text-[#555] text-[13px] focus-visible:ring-0"
                />
              </div>

              <Button
                onClick={() => setApplied(true)}
                className="bg-[#00a65a] hover:bg-[#008d4c] text-white px-8 h-9 font-semibold rounded-sm"
              >
                View
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Data Table Card */}
        <Card className="border-none shadow-sm bg-white rounded-sm">
          <CardContent className="p-6 space-y-4">
            <h2 className="text-[15px] font-bold text-[#555] mb-2">Event List</h2>

            {/* Toolbar */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <span className="text-xs text-[#555]">Show</span>
                <Select value={entries} onValueChange={setEntries}>
                  <SelectTrigger className="h-8 w-[70px] bg-white border-slate-300 text-xs text-[#555] focus:ring-0">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="10">10</SelectItem>
                    <SelectItem value="25">25</SelectItem>
                    <SelectItem value="50">50</SelectItem>
                    <SelectItem value="100">100</SelectItem>
                  </SelectContent>
                </Select>
                <span className="text-xs text-[#555]">entries</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-[#555]">Search:</span>
                <Input
                  value={tableSearch}
                  onChange={(e) => setTableSearch(e.target.value)}
                  className="h-8 w-[200px] bg-white border-slate-300 text-xs focus-visible:ring-0"
                />
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto border border-slate-100 rounded-sm">
              <Table className="w-full text-[13px] whitespace-nowrap">
                <TableHeader>
                  <TableRow className="border-b-0 bg-[#d9f2e6] hover:bg-[#d9f2e6]">
                    <TableHead className="py-3 px-3 font-bold text-[#333] text-left text-xs">#</TableHead>
                    <TableHead className="py-3 px-3 font-bold text-[#333] text-left text-xs">Event Type</TableHead>
                    <TableHead className="py-3 px-3 font-bold text-[#333] text-left text-xs">Company</TableHead>
                    <TableHead className="py-3 px-3 font-bold text-[#333] text-left text-xs">Person</TableHead>
                    <TableHead className="py-3 px-3 font-bold text-[#333] text-left text-xs">Status</TableHead>
                    <TableHead className="py-3 px-3 font-bold text-[#333] text-left text-xs">Start Time</TableHead>
                    <TableHead className="py-3 px-3 font-bold text-[#333] text-left text-xs">End Time</TableHead>
                    <TableHead className="py-3 px-3 font-bold text-[#333] text-left text-xs">Total Time</TableHead>
                    <TableHead className="py-3 px-3 font-bold text-[#333] text-left text-xs">Event Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="bg-white">
                  {!applied ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                        Click 'View' to load the events report.
                      </TableCell>
                    </TableRow>
                  ) : query.isLoading ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                        Loading...
                      </TableCell>
                    </TableRow>
                  ) : query.isError ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center text-[#d9534f] py-8">
                        Could not load the events report. Please try again.
                      </TableCell>
                    </TableRow>
                  ) : rows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                        No events found.
                      </TableCell>
                    </TableRow>
                  ) : (
                    rows.map((item, idx) => (
                      <TableRow key={item.id} className="border-b border-slate-100 hover:bg-[#f8f9fa] transition-colors">
                        <TableCell className="py-4 px-3 text-[#555]">{idx + 1}</TableCell>
                        <TableCell className="py-4 px-3 text-[#555]">{item.meeting_type || "-"}</TableCell>
                        <TableCell className="py-4 px-3 text-[#555]">{item.company_name || "-"}</TableCell>
                        <TableCell className="py-4 px-3 text-[#555]">{item.person_name || "-"}</TableCell>
                        <TableCell className="py-4 px-3 text-[#555]">{item.status || "-"}</TableCell>
                        <TableCell className="py-4 px-3 text-[#555]">{fmtTime(item.start_time)}</TableCell>
                        <TableCell className="py-4 px-3 text-[#555]">{fmtTime(item.end_time)}</TableCell>
                        <TableCell className="py-4 px-3 text-[#555]">{fmtDuration(item.total_duration_seconds)}</TableCell>
                        <TableCell className="py-4 px-3 text-[#555]">{fmtTime(item.meeting_date)}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Info */}
            <div className="flex items-center justify-between mt-4">
              <div className="text-xs text-[#555]">
                Showing {rows.length} of {filtered.length} entries
              </div>
            </div>

          </CardContent>
        </Card>
      </div>
    </div>
  );
}
