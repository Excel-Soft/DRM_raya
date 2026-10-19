// Events report — the real eventreport.php: pick ONE event from "Select Event",
// then see which companies attended it (Present/Absent + whether it resulted in
// a Sale), plus that event's speaker/topic/timing. Backed by GET
// /api/reports/event/attendance?eventId=X, which reads the real drm.events +
// drm.event_speakers + drm.event_attendees tables. Distinct from the Stage 8
// multi-event dashboard this page used to show (dateFrom/dateTo/type/status
// filters over /api/reports/event) — that answered a different question
// (internal event/duty planning) and had zero live usage; this page now
// matches what eventreport.php's own form and output table actually do.
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequestJson } from "@/lib/queryClient";
import { Card, CardContent } from "@/components/ui/card";
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

type EventOption = { id: string; name: string | null };

type AttendanceRow = {
  rowNumber: number;
  eventType: string | null;
  company: string | null;
  esTime: string | null;
  eeTime: string | null;
  location: string | null;
  speaker: string | null;
  topic: string | null;
  speakerStartTime: string | null;
  speakerEndTime: string | null;
  attendanceStatus: string;
  resultedInSale: boolean;
  eventDate: string | null;
};

type AttendanceReportResponse = {
  event: { name: string | null; amount: number };
  rows: AttendanceRow[];
  total: number;
  cost: number;
};

function fmtTime(value: string | null): string {
  if (!value) return "-";
  const [h, m] = value.split(":").map((n) => Number(n));
  if (isNaN(h) || isNaN(m)) return value;
  const period = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${String(h12).padStart(2, "0")}:${String(m).padStart(2, "0")} ${period}`;
}

function totalTime(start: string | null, end: string | null): string {
  if (!start || !end) return "-";
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  if ([sh, sm, eh, em].some((n) => isNaN(n))) return "-";
  let minutes = eh * 60 + em - (sh * 60 + sm);
  if (minutes < 0) minutes += 24 * 60;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}h ${m}m`;
}

function fmtDate(value: string | null): string {
  if (!value) return "-";
  const d = new Date(value);
  if (isNaN(d.getTime())) return "-";
  return d.toISOString().slice(0, 10);
}

export default function EventReport() {
  const [selectedEvent, setSelectedEvent] = useState("");
  const [applied, setApplied] = useState<string | null>(null);

  const { data: eventsData } = useQuery<{ data: EventOption[] }>({
    queryKey: ["/api/events", "picker"],
    queryFn: async () => apiRequestJson("GET", "/api/events?pageSize=200"),
  });
  const eventOptions = eventsData?.data ?? [];

  const query = useQuery<AttendanceReportResponse>({
    queryKey: ["/api/reports/event/attendance", applied],
    enabled: !!applied,
    queryFn: async () => apiRequestJson("GET", `/api/reports/event/attendance?eventId=${applied}`),
  });

  const handleView = () => {
    if (!selectedEvent) return;
    setApplied(selectedEvent);
  };

  const rows = query.data?.rows ?? [];
  const cost = query.data?.cost ?? 0;

  return (
    <div className="flex-1 overflow-auto bg-[#f4f6f9] dark:bg-zinc-950 min-h-screen">
      <div className="p-4 max-w-[1600px] mx-auto space-y-6">

        {/* Header */}
        <h1 className="text-[17px] font-bold text-[#555] dark:text-zinc-300 uppercase tracking-wide">
          WEB EXCELS EVENTS REPORT
        </h1>

        {/* Filter Card */}
        <Card className="border-none shadow-sm bg-white dark:bg-zinc-900 rounded-sm">
          <CardContent className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
              <div className="flex flex-col gap-2 md:col-span-2">
                <Label className="text-[13px] font-bold text-[#555] dark:text-zinc-300">Select Event</Label>
                <Select value={selectedEvent} onValueChange={setSelectedEvent}>
                  <SelectTrigger className="h-9 bg-white dark:bg-zinc-900 border-slate-200 text-[#555] dark:text-zinc-300 text-[13px] focus:ring-0">
                    <SelectValue placeholder="Choose..." />
                  </SelectTrigger>
                  <SelectContent>
                    {eventOptions.length === 0 ? (
                      <div className="px-2 py-1.5 text-sm text-muted-foreground">No events found</div>
                    ) : (
                      eventOptions.map((ev) => (
                        <SelectItem key={ev.id} value={ev.id}>
                          {ev.name || "(unnamed event)"}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Button
                  onClick={handleView}
                  disabled={!selectedEvent}
                  className="bg-[#00a65a] hover:bg-[#008d4c] text-white px-8 h-9 font-semibold rounded-sm"
                >
                  View
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Data Table Card */}
        <Card className="border-none shadow-sm bg-white dark:bg-zinc-900 rounded-sm overflow-hidden">
          <div className="border-b border-slate-100 dark:border-zinc-800 py-4 px-6 bg-white dark:bg-zinc-900">
            <h2 className="text-[15px] font-bold text-[#555] dark:text-zinc-300">Event List</h2>
          </div>
          <CardContent className="p-4">
            <div className="overflow-x-auto">
              <Table className="w-full text-[13px] whitespace-nowrap">
                <TableHeader>
                  <TableRow className="border-b-0 bg-[#d9f2e6] dark:bg-zinc-900 hover:bg-[#d9f2e6] dark:hover:bg-zinc-900">
                    <TableHead className="py-3 px-3 font-bold text-[#333] dark:text-zinc-300 text-left">#</TableHead>
                    <TableHead className="py-3 px-3 font-bold text-[#333] dark:text-zinc-300 text-left">Event Type</TableHead>
                    <TableHead className="py-3 px-3 font-bold text-[#333] dark:text-zinc-300 text-left">Company</TableHead>
                    <TableHead className="py-3 px-3 font-bold text-[#333] dark:text-zinc-300 text-left">ES Time</TableHead>
                    <TableHead className="py-3 px-3 font-bold text-[#333] dark:text-zinc-300 text-left">EE Time</TableHead>
                    <TableHead className="py-3 px-3 font-bold text-[#333] dark:text-zinc-300 text-left">Location</TableHead>
                    <TableHead className="py-3 px-3 font-bold text-[#333] dark:text-zinc-300 text-left">Speaker</TableHead>
                    <TableHead className="py-3 px-3 font-bold text-[#333] dark:text-zinc-300 text-left">Topic</TableHead>
                    <TableHead className="py-3 px-3 font-bold text-[#333] dark:text-zinc-300 text-left">Start Time</TableHead>
                    <TableHead className="py-3 px-3 font-bold text-[#333] dark:text-zinc-300 text-left">End Time</TableHead>
                    <TableHead className="py-3 px-3 font-bold text-[#333] dark:text-zinc-300 text-left">Total Time</TableHead>
                    <TableHead className="py-3 px-3 font-bold text-[#333] dark:text-zinc-300 text-left">Present/Absent</TableHead>
                    <TableHead className="py-3 px-3 font-bold text-[#333] dark:text-zinc-300 text-left">Sale</TableHead>
                    <TableHead className="py-3 px-3 font-bold text-[#333] dark:text-zinc-300 text-left">Event Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="bg-white dark:bg-zinc-900">
                  {!applied ? (
                    <TableRow>
                      <TableCell colSpan={14} className="text-center text-muted-foreground py-8">
                        Please select an event and click 'View' to display the data.
                      </TableCell>
                    </TableRow>
                  ) : query.isLoading ? (
                    <TableRow>
                      <TableCell colSpan={14} className="text-center text-muted-foreground py-8">
                        Loading...
                      </TableCell>
                    </TableRow>
                  ) : query.isError ? (
                    <TableRow>
                      <TableCell colSpan={14} className="text-center text-[#d9534f] dark:text-red-400 py-8">
                        Could not load the events report. Please try again.
                      </TableCell>
                    </TableRow>
                  ) : rows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={14} className="text-center text-muted-foreground py-8">
                        No attendees recorded for this event.
                      </TableCell>
                    </TableRow>
                  ) : (
                    rows.map((item) => (
                      <TableRow key={item.rowNumber} className="border-b border-slate-100 dark:border-zinc-800 hover:bg-[#f8f9fa] dark:hover:bg-zinc-800 transition-colors">
                        <TableCell className="py-4 px-3 text-[#555] dark:text-zinc-300">{item.rowNumber}</TableCell>
                        <TableCell className="py-4 px-3 text-[#555] dark:text-zinc-300">{item.eventType || "-"}</TableCell>
                        <TableCell className="py-4 px-3 text-[#555] dark:text-zinc-300">{item.company || "-"}</TableCell>
                        <TableCell className="py-4 px-3 text-[#555] dark:text-zinc-300">{fmtTime(item.esTime)}</TableCell>
                        <TableCell className="py-4 px-3 text-[#555] dark:text-zinc-300">{fmtTime(item.eeTime)}</TableCell>
                        <TableCell className="py-4 px-3 text-[#555] dark:text-zinc-300">{item.location || "-"}</TableCell>
                        <TableCell className="py-4 px-3 text-[#555] dark:text-zinc-300">{item.speaker || "-"}</TableCell>
                        <TableCell className="py-4 px-3 text-[#555] dark:text-zinc-300">{item.topic || "-"}</TableCell>
                        <TableCell className="py-4 px-3 text-[#555] dark:text-zinc-300">{fmtTime(item.speakerStartTime)}</TableCell>
                        <TableCell className="py-4 px-3 text-[#555] dark:text-zinc-300">{fmtTime(item.speakerEndTime)}</TableCell>
                        <TableCell className="py-4 px-3 text-[#555] dark:text-zinc-300">{totalTime(item.speakerStartTime, item.speakerEndTime)}</TableCell>
                        <TableCell className="py-4 px-3 text-[#555] dark:text-zinc-300">{item.attendanceStatus}</TableCell>
                        <TableCell className="py-4 px-3 text-[#555] dark:text-zinc-300">{item.resultedInSale ? "Yes" : "No"}</TableCell>
                        <TableCell className="py-4 px-3 text-[#555] dark:text-zinc-300">{fmtDate(item.eventDate)}</TableCell>
                      </TableRow>
                    ))
                  )}
                  {applied && !query.isLoading && rows.length > 0 && (
                    <TableRow className="bg-slate-50 dark:bg-zinc-800/50">
                      <TableCell className="py-4 px-3 font-bold text-[#555] dark:text-zinc-300">Total</TableCell>
                      <TableCell className="py-4 px-3" />
                      <TableCell className="py-4 px-3 font-bold text-[#555] dark:text-zinc-300">{rows.length}</TableCell>
                      <TableCell className="py-4 px-3 font-bold text-[#555] dark:text-zinc-300">Cost</TableCell>
                      <TableCell className="py-4 px-3 font-bold text-[#555] dark:text-zinc-300">{cost}</TableCell>
                      <TableCell className="py-4 px-3" colSpan={9} />
                    </TableRow>
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
