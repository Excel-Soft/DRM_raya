// Events report — switched from drm.meetings to the persisted drm.events store.
// Reads GET /api/events/report (filters: dateFrom, dateTo, type, status, venue,
// speaker) which returns { data, total, page, pageSize, totals: { attendance,
// cost } }. Rows render real-or-empty data only; CSV export operates over the
// fetched rows and includes a totals row.
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
import { Download } from "lucide-react";

type EventSpeaker = {
  id: string;
  speakerName: string | null;
  topic: string | null;
};

type EventReportRow = {
  id: string;
  name: string | null;
  eventType: string | null;
  eventDate: string | null;
  venue: string | null;
  attendeeCount: number | null;
  amount: number | null;
  status: string | null;
  speakers: EventSpeaker[];
};

type EventReportResponse = {
  data: EventReportRow[];
  total: number;
  page: number;
  pageSize: number;
  totals: { attendance: number; cost: number };
};

function fmtDate(value: string | null): string {
  if (!value) return "-";
  const d = new Date(value);
  if (isNaN(d.getTime())) return "-";
  return d.toISOString().slice(0, 10);
}

function fmtAmount(value: number | null): string {
  if (value === null || value === undefined || isNaN(Number(value))) return "-";
  return Number(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function speakerNames(speakers: EventSpeaker[]): string {
  if (!Array.isArray(speakers) || speakers.length === 0) return "-";
  return speakers
    .map((s) => (s.speakerName || "").trim())
    .filter(Boolean)
    .join(", ") || "-";
}

const STATUS_OPTIONS = ["Draft", "Completed", "Cancelled"] as const;

function csvCell(value: string | number | null): string {
  const s = value === null || value === undefined ? "" : String(value);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export default function EventReport() {
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [type, setType] = useState("");
  const [status, setStatus] = useState("all");
  const [venue, setVenue] = useState("");
  const [speaker, setSpeaker] = useState("");
  const [entries, setEntries] = useState("10");
  const [tableSearch, setTableSearch] = useState("");

  const [applied, setApplied] = useState<{
    dateFrom: string;
    dateTo: string;
    type: string;
    status: string;
    venue: string;
    speaker: string;
  } | null>(null);

  const query = useQuery<EventReportResponse>({
    queryKey: ["/api/events/report", applied],
    enabled: !!applied,
    queryFn: async () => {
      const params = new URLSearchParams({ page: "1", pageSize: "200" });
      if (applied?.dateFrom) params.set("dateFrom", applied.dateFrom);
      if (applied?.dateTo) params.set("dateTo", applied.dateTo);
      if (applied?.type) params.set("type", applied.type);
      if (applied?.status && applied.status !== "all") params.set("status", applied.status);
      if (applied?.venue) params.set("venue", applied.venue);
      if (applied?.speaker) params.set("speaker", applied.speaker);
      return apiRequestJson("GET", `/api/events/report?${params.toString()}`);
    },
  });

  const handleView = () => {
    setApplied({ dateFrom, dateTo, type, status, venue, speaker });
  };

  const allRows = query.data?.data ?? [];
  const totals = query.data?.totals ?? { attendance: 0, cost: 0 };
  const pageSize = Number(entries) || 10;
  const search = tableSearch.trim().toLowerCase();
  const filtered = search
    ? allRows.filter((r) =>
        [r.name, r.eventType, r.venue, r.status, speakerNames(r.speakers)]
          .some((v) => (v || "").toLowerCase().includes(search)),
      )
    : allRows;
  const rows = filtered.slice(0, pageSize);

  const exportCsv = () => {
    const header = ["#", "Event Name", "Type", "Event Date", "Venue", "Speakers", "Attendance", "Amount", "Status"];
    const body = filtered.map((r, idx) => [
      idx + 1,
      r.name ?? "",
      r.eventType ?? "",
      fmtDate(r.eventDate),
      r.venue ?? "",
      speakerNames(r.speakers),
      r.attendeeCount ?? 0,
      r.amount ?? 0,
      r.status ?? "",
    ]);
    const totalAttendance = filtered.reduce((sum, r) => sum + (Number(r.attendeeCount) || 0), 0);
    const totalCost = filtered.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
    const totalsRow = ["", "TOTALS", "", "", "", "", totalAttendance, totalCost, ""];
    const lines = [header, ...body, totalsRow]
      .map((cols) => cols.map(csvCell).join(","))
      .join("\n");
    const blob = new Blob([lines], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `events-report-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

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
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="flex flex-col gap-2">
                <Label className="text-[13px] font-bold text-[#555]">Start Date</Label>
                <Input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="h-9 bg-white border-slate-200 text-[#555] text-[13px] focus-visible:ring-0"
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label className="text-[13px] font-bold text-[#555]">End Date</Label>
                <Input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="h-9 bg-white border-slate-200 text-[#555] text-[13px] focus-visible:ring-0"
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label className="text-[13px] font-bold text-[#555]">Event Type</Label>
                <Input
                  placeholder="Filter by event type..."
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                  className="h-9 bg-white border-slate-200 text-[#555] text-[13px] focus-visible:ring-0"
                />
              </div>
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
              <div className="flex flex-col gap-2">
                <Label className="text-[13px] font-bold text-[#555]">Venue</Label>
                <Input
                  placeholder="Filter by venue..."
                  value={venue}
                  onChange={(e) => setVenue(e.target.value)}
                  className="h-9 bg-white border-slate-200 text-[#555] text-[13px] focus-visible:ring-0"
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label className="text-[13px] font-bold text-[#555]">Speaker</Label>
                <Input
                  placeholder="Filter by speaker..."
                  value={speaker}
                  onChange={(e) => setSpeaker(e.target.value)}
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

        {/* Data Table Card */}
        <Card className="border-none shadow-sm bg-white rounded-sm">
          <CardContent className="p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-[15px] font-bold text-[#555]">Event List</h2>
              <Button
                onClick={exportCsv}
                disabled={filtered.length === 0}
                variant="outline"
                className="h-8 px-4 text-xs font-semibold border-slate-300 text-[#555]"
              >
                <Download className="w-3.5 h-3.5 mr-2" />
                Export CSV
              </Button>
            </div>

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
                    <TableHead className="py-3 px-3 font-bold text-[#333] text-left text-xs">Event Name</TableHead>
                    <TableHead className="py-3 px-3 font-bold text-[#333] text-left text-xs">Type</TableHead>
                    <TableHead className="py-3 px-3 font-bold text-[#333] text-left text-xs">Event Date</TableHead>
                    <TableHead className="py-3 px-3 font-bold text-[#333] text-left text-xs">Venue</TableHead>
                    <TableHead className="py-3 px-3 font-bold text-[#333] text-left text-xs">Speakers</TableHead>
                    <TableHead className="py-3 px-3 font-bold text-[#333] text-right text-xs">Attendance</TableHead>
                    <TableHead className="py-3 px-3 font-bold text-[#333] text-right text-xs">Amount</TableHead>
                    <TableHead className="py-3 px-3 font-bold text-[#333] text-left text-xs">Status</TableHead>
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
                      <TableCell colSpan={9} className="text-center py-8">
                        <div className="text-[#d9534f] mb-2">Could not load the events report. Please try again.</div>
                        <Button size="sm" variant="outline" onClick={() => query.refetch()} className="h-7 px-3 text-xs">Retry</Button>
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
                        <TableCell className="py-4 px-3 text-[#555]">{item.name || "-"}</TableCell>
                        <TableCell className="py-4 px-3 text-[#555]">{item.eventType || "-"}</TableCell>
                        <TableCell className="py-4 px-3 text-[#555]">{fmtDate(item.eventDate)}</TableCell>
                        <TableCell className="py-4 px-3 text-[#555]">{item.venue || "-"}</TableCell>
                        <TableCell className="py-4 px-3 text-[#555]">{speakerNames(item.speakers)}</TableCell>
                        <TableCell className="py-4 px-3 text-[#555] text-right">{item.attendeeCount ?? 0}</TableCell>
                        <TableCell className="py-4 px-3 text-[#555] text-right">{fmtAmount(item.amount)}</TableCell>
                        <TableCell className="py-4 px-3 text-[#555]">{item.status || "-"}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
                {applied && !query.isLoading && !query.isError && filtered.length > 0 && (
                  <tfoot>
                    <TableRow className="border-t-2 border-slate-200 bg-[#f1f5f3] font-bold">
                      <TableCell colSpan={6} className="py-3 px-3 text-[#333] text-right">TOTALS</TableCell>
                      <TableCell className="py-3 px-3 text-[#333] text-right">{totals.attendance}</TableCell>
                      <TableCell className="py-3 px-3 text-[#333] text-right">{fmtAmount(totals.cost)}</TableCell>
                      <TableCell className="py-3 px-3" />
                    </TableRow>
                  </tfoot>
                )}
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
