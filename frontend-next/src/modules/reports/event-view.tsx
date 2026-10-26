"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/legacy/select";
import { apiRequest } from "@/lib/query/query-client";
import { ReportsShell, DrmSection } from "@/modules/reports/reports-ui";

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
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

function fmtDate(value: string | null): string {
  if (!value) return "-";
  const d = new Date(value);
  return isNaN(d.getTime()) ? "-" : d.toISOString().slice(0, 10);
}

export function EventReportPage() {
  const [selectedEvent, setSelectedEvent] = useState("");
  const [applied, setApplied] = useState<string | null>(null);

  const { data: eventsData } = useQuery<{ data: EventOption[] }>({
    queryKey: ["/api/events", "picker"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/events?pageSize=200");
      if (!res.ok) return { data: [] };
      return res.json();
    },
  });
  const eventOptions = eventsData?.data ?? [];

  const query = useQuery<{ rows: AttendanceRow[]; cost: number }>({
    queryKey: ["/api/reports/event/attendance", applied],
    enabled: !!applied,
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/reports/event/attendance?eventId=${applied}`);
      if (!res.ok) throw new Error("Failed to load the events report.");
      return res.json();
    },
  });

  const rows = query.data?.rows ?? [];
  const cost = query.data?.cost ?? 0;

  const columns = useMemo((): DataTableColumn<AttendanceRow>[] => [
    { id: "n", header: "#", cell: (r) => r.rowNumber },
    { id: "type", header: "Event Type", cell: (r) => r.eventType || "-" },
    { id: "company", header: "Company", cell: (r) => r.company || "-" },
    { id: "es", header: "ES Time", cell: (r) => fmtTime(r.esTime) },
    { id: "ee", header: "EE Time", cell: (r) => fmtTime(r.eeTime) },
    { id: "location", header: "Location", cell: (r) => r.location || "-" },
    { id: "speaker", header: "Speaker", cell: (r) => r.speaker || "-" },
    { id: "topic", header: "Topic", cell: (r) => r.topic || "-" },
    { id: "start", header: "Start Time", cell: (r) => fmtTime(r.speakerStartTime) },
    { id: "end", header: "End Time", cell: (r) => fmtTime(r.speakerEndTime) },
    { id: "total", header: "Total Time", cell: (r) => totalTime(r.speakerStartTime, r.speakerEndTime) },
    { id: "status", header: "Present/Absent", cell: (r) => r.attendanceStatus },
    { id: "sale", header: "Sale", cell: (r) => (r.resultedInSale ? "Yes" : "No") },
    { id: "date", header: "Event Date", cell: (r) => fmtDate(r.eventDate) },
  ], []);

  return (
    <ReportsShell title="Web Excels Events Report">
      <DrmSection title="Filters">
        <div className="grid grid-cols-1 items-end gap-4 md:grid-cols-3">
          <Field id="ev-select" label="Select Event" className="md:col-span-2">
            <Select value={selectedEvent} onValueChange={setSelectedEvent}>
              <SelectTrigger id="ev-select">
                <SelectValue placeholder="Choose…" />
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
          </Field>
          <Button type="button" variant="primary" disabled={!selectedEvent} onClick={() => setApplied(selectedEvent)}>
            View
          </Button>
        </div>
      </DrmSection>

      <DrmSection title="Event List" description={applied && rows.length > 0 ? `Total: ${rows.length} · Cost: ${cost}` : undefined}>
        <DataTable
          columns={columns}
          rows={rows}
          rowKey={(row) => String(row.rowNumber)}
          loading={!!applied && query.isLoading}
          error={query.isError ? "Could not load the events report. Please try again." : null}
          onRetry={() => query.refetch()}
          emptyMessage={!applied ? "Please select an event and click 'View' to display the data." : "No attendees recorded for this event."}
          className="min-w-[1400px]"
        />
      </DrmSection>
    </ReportsShell>
  );
}
