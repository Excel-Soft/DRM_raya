"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/legacy/checkbox";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/legacy/select";
import { MapPin, Pencil, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, apiRequestJson, queryClient } from "@/lib/query/query-client";
import { useToast } from "@/lib/hooks/use-legacy-toast";
import {
  DrmFormActions,
  DrmInlineActions,
  DrmSection,
  EventsFormGrid,
  drmFieldClass,
  eventsSelectTriggerClass,
  fmtEventDate,
} from "@/modules/events/events-ui";
import { cn } from "@/lib/utils/cn";

const EVENT_STATUSES = ["Draft", "Completed", "Cancelled"] as const;
const EVENT_TYPES = [
  "Seminar",
  "Webinar",
  "Social Media",
  "Hum Mashal-e-Rah(lahore)",
  "Tanveer Gujranwala",
] as const;

interface EventSpeaker {
  id: string;
  eventId: string;
  speakerName: string | null;
  topic: string | null;
  detail: string | null;
  startTime: string | null;
  endTime: string | null;
}

interface EventRow {
  id: string;
  name: string;
  eventType: string | null;
  eventDate: string | null;
  startTime: string | null;
  endTime: string | null;
  venue: string | null;
  amount: number;
  attendeeCount: number;
  mapUrl: string | null;
  location: string | null;
  status: string;
  notes: string | null;
  createdByName: string | null;
  createdAt: string | null;
  speakers: EventSpeaker[];
}

interface EventsListResult {
  data: EventRow[];
  total: number;
  page: number;
  pageSize: number;
}

const EMPTY_EVENT_FORM = {
  name: "",
  eventType: "",
  startTime: "",
  endTime: "",
  attendeeCount: "",
  eventDate: "",
  mapUrl: "",
  amount: "",
  venue: "",
  status: "Draft",
};

const EMPTY_SPEAKER_FORM = {
  speakerName: "",
  eventId: "",
  topic: "",
  startTime: "",
  endTime: "",
  detail: "",
};

const ATTENDANCE_STATUSES = ["Present", "Absent"] as const;

const EMPTY_ATTENDEE_FORM = {
  eventId: "",
  customerId: "",
  attendanceStatus: "Present" as (typeof ATTENDANCE_STATUSES)[number],
  resultedInSale: false,
};

function isHttpUrl(value: string): boolean {
  return /^https?:\/\//i.test(value.trim());
}

function speakerDuration(startTime: string | null, endTime: string | null): string {
  if (!startTime || !endTime) return "—";
  const start = new Date(`1970-01-01T${startTime}:00`);
  const end = new Date(`1970-01-01T${endTime}:00`);
  const diffMs = end.getTime() - start.getTime();
  if (diffMs <= 0) return "—";
  const hours = Math.floor(diffMs / 3600000);
  const minutes = Math.floor((diffMs % 3600000) / 60000);
  return `${hours}:${minutes.toString().padStart(2, "0")}`;
}

export function EventsAddPage() {
  const { toast } = useToast();
  const [showEventForm, setShowEventForm] = useState(false);
  const [showSpeakerForm, setShowSpeakerForm] = useState(false);
  const [showAttendeeForm, setShowAttendeeForm] = useState(false);

  const [eventForm, setEventForm] = useState({ ...EMPTY_EVENT_FORM });
  const [editingEventId, setEditingEventId] = useState<string | null>(null);

  const [speakerForm, setSpeakerForm] = useState({ ...EMPTY_SPEAKER_FORM });
  const [attendeeForm, setAttendeeForm] = useState({ ...EMPTY_ATTENDEE_FORM });
  const [customerSearch, setCustomerSearch] = useState("");

  const eventsQuery = useQuery<EventsListResult>({
    queryKey: ["/api/events", { pageSize: 100 }],
    queryFn: () => apiRequestJson<EventsListResult>("GET", "/api/events?page=1&pageSize=100"),
  });

  const events = eventsQuery.data?.data ?? [];

  function invalidateEvents() {
    queryClient.invalidateQueries({ queryKey: ["/api/events"] });
  }

  const saveEventMutation = useMutation({
    mutationFn: async () => {
      const body = {
        name: eventForm.name.trim(),
        eventType: eventForm.eventType || null,
        startTime: eventForm.startTime || null,
        endTime: eventForm.endTime || null,
        attendeeCount: eventForm.attendeeCount === "" ? 0 : Number(eventForm.attendeeCount),
        eventDate: eventForm.eventDate,
        mapUrl: eventForm.mapUrl.trim() || null,
        amount: eventForm.amount === "" ? 0 : Number(eventForm.amount),
        venue: eventForm.venue || null,
        status: eventForm.status,
      };
      return editingEventId
        ? apiRequestJson("PATCH", `/api/events/${editingEventId}`, body)
        : apiRequestJson("POST", "/api/events", body);
    },
    onSuccess: () => {
      toast({ title: editingEventId ? "Event updated" : "Event added" });
      setEventForm({ ...EMPTY_EVENT_FORM });
      setEditingEventId(null);
      invalidateEvents();
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteEventMutation = useMutation({
    mutationFn: async (id: string) => apiRequestJson("DELETE", `/api/events/${id}`),
    onSuccess: () => {
      toast({ title: "Event deleted" });
      invalidateEvents();
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const addSpeakerMutation = useMutation({
    mutationFn: async () => {
      const body = {
        speakerName: speakerForm.speakerName.trim(),
        topic: speakerForm.topic || null,
        detail: speakerForm.detail || null,
        startTime: speakerForm.startTime || null,
        endTime: speakerForm.endTime || null,
      };
      return apiRequestJson("POST", `/api/events/${speakerForm.eventId}/speakers`, body);
    },
    onSuccess: () => {
      toast({ title: "Speaker added" });
      setSpeakerForm({ ...EMPTY_SPEAKER_FORM });
      invalidateEvents();
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteSpeakerMutation = useMutation({
    mutationFn: async ({ eventId, speakerId }: { eventId: string; speakerId: string }) =>
      apiRequestJson("DELETE", `/api/events/${eventId}/speakers/${speakerId}`),
    onSuccess: () => {
      toast({ title: "Speaker removed" });
      invalidateEvents();
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const trimmedCustomerSearch = customerSearch.trim();
  const { data: customerOptions = [] } = useQuery({
    queryKey: ["/api/customers", "event-attendee", trimmedCustomerSearch],
    enabled: trimmedCustomerSearch.length >= 2,
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/customers?search=${encodeURIComponent(trimmedCustomerSearch)}&page=1&pageSize=15`);
      const data = await res.json();
      return (data?.customers as { id: string; companyName: string }[]) ?? [];
    },
  });

  const addAttendeeMutation = useMutation({
    mutationFn: async () => {
      const body = {
        customerId: attendeeForm.customerId,
        attendanceStatus: attendeeForm.attendanceStatus,
        resultedInSale: attendeeForm.resultedInSale,
      };
      return apiRequestJson("POST", `/api/events/${attendeeForm.eventId}/attendees`, body);
    },
    onSuccess: () => {
      toast({ title: "Attendee added" });
      setAttendeeForm({ ...EMPTY_ATTENDEE_FORM });
      setCustomerSearch("");
      invalidateEvents();
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  function validateEvent(): string | null {
    if (!eventForm.name.trim()) return "Event name is required";
    if (!eventForm.eventDate) return "Date is required";
    if (isNaN(new Date(eventForm.eventDate).getTime())) return "Date must be valid";
    if (eventForm.startTime && eventForm.endTime && !(eventForm.startTime < eventForm.endTime))
      return "Start time must be before end time";
    if (eventForm.attendeeCount !== "") {
      const n = Number(eventForm.attendeeCount);
      if (!Number.isInteger(n) || n < 0) return "Attending must be an integer 0 or greater";
    }
    if (eventForm.amount !== "") {
      const n = Number(eventForm.amount);
      if (isNaN(n) || n < 0) return "Amount must be 0 or greater";
    }
    if (eventForm.mapUrl.trim() && !isHttpUrl(eventForm.mapUrl))
      return "Map must be a valid http(s) URL";
    if (!EVENT_STATUSES.includes(eventForm.status as any)) return "Invalid status";
    return null;
  }

  function handleAddEvent() {
    const err = validateEvent();
    if (err) return toast({ title: err, variant: "destructive" });
    saveEventMutation.mutate();
  }

  function handleEditEvent(ev: EventRow) {
    setEditingEventId(ev.id);
    setShowEventForm(true);
    setEventForm({
      name: ev.name ?? "",
      eventType: ev.eventType ?? "",
      startTime: ev.startTime ?? "",
      endTime: ev.endTime ?? "",
      attendeeCount: ev.attendeeCount != null ? String(ev.attendeeCount) : "",
      eventDate: ev.eventDate ? String(ev.eventDate).slice(0, 10) : "",
      mapUrl: ev.mapUrl ?? "",
      amount: ev.amount != null ? String(ev.amount) : "",
      venue: ev.venue ?? "",
      status: ev.status ?? "Draft",
    });
  }

  function cancelEdit() {
    setEditingEventId(null);
    setEventForm({ ...EMPTY_EVENT_FORM });
  }

  function handleAddSpeaker() {
    if (!speakerForm.speakerName.trim()) return toast({ title: "Speaker name is required", variant: "destructive" });
    if (!speakerForm.eventId) return toast({ title: "Please select an event", variant: "destructive" });
    if (speakerForm.startTime && speakerForm.endTime && !(speakerForm.startTime < speakerForm.endTime))
      return toast({ title: "Start time must be before end time", variant: "destructive" });
    addSpeakerMutation.mutate();
  }

  function handleAddAttendee() {
    if (!attendeeForm.eventId) return toast({ title: "Please select an event", variant: "destructive" });
    if (!attendeeForm.customerId) return toast({ title: "Please select a company", variant: "destructive" });
    addAttendeeMutation.mutate();
  }

  const columns = useMemo((): DataTableColumn<EventRow>[] => {
    return [
      {
        id: "idx",
        header: "#",
        className: "w-10 tabular-nums text-zinc-500",
        cell: (row) => {
          const idx = events.findIndex((e) => e.id === row.id);
          return <span>{idx >= 0 ? idx + 1 : "—"}</span>;
        },
      },
      {
        id: "name",
        header: "Name",
        cell: (row) => <span className="font-medium text-zinc-900 dark:text-zinc-100">{row.name}</span>,
      },
      {
        id: "type",
        header: "Type",
        cell: (row) => <span className="text-zinc-600 dark:text-zinc-400">{row.eventType || "—"}</span>,
      },
      {
        id: "start",
        header: "Start",
        cell: (row) => <span>{row.startTime || "—"}</span>,
        className: "whitespace-nowrap",
      },
      {
        id: "end",
        header: "End",
        cell: (row) => <span>{row.endTime || "—"}</span>,
        className: "whitespace-nowrap",
      },
      {
        id: "attending",
        header: "Attending",
        cell: (row) => <span className="tabular-nums">{row.attendeeCount}</span>,
      },
      {
        id: "speakers",
        header: "Speakers",
        className: "min-w-[220px]",
        cell: (row) =>
          row.speakers?.length ? (
            <ul className="space-y-2 text-xs">
              {row.speakers.map((sp) => (
                <li key={sp.id} className="rounded-lg border border-zinc-200 p-2 dark:border-zinc-700">
                  <div className="font-medium text-zinc-800 dark:text-zinc-200">{sp.speakerName}</div>
                  <div className="text-zinc-500">
                    {sp.startTime || "—"} – {sp.endTime || "—"} · {speakerDuration(sp.startTime, sp.endTime)}
                  </div>
                  <button
                    type="button"
                    onClick={() => deleteSpeakerMutation.mutate({ eventId: row.id, speakerId: sp.id })}
                    className="mt-1 text-red-600 hover:underline dark:text-red-400"
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <span className="text-zinc-400">—</span>
          ),
      },
      {
        id: "venue",
        header: "Venue",
        cell: (row) => <span className="text-zinc-600 dark:text-zinc-400">{row.venue || "—"}</span>,
      },
      {
        id: "status",
        header: "Status",
        cell: (row) => (
          <Badge variant="neutral" className="normal-case tracking-normal">
            {row.status}
          </Badge>
        ),
      },
      {
        id: "map",
        header: "Map",
        cell: (row) =>
          row.mapUrl ? (
            <a
              href={row.mapUrl}
              target="_blank"
              rel="noreferrer"
              title="View map"
              className={cn(
                "inline-flex h-8 w-8 items-center justify-center rounded-full border border-emerald-600 text-emerald-600",
                "transition-colors hover:bg-emerald-600 hover:text-white dark:border-emerald-500 dark:text-emerald-400",
              )}
            >
              <MapPin className="h-4 w-4" />
            </a>
          ) : (
            <span className="text-zinc-400">—</span>
          ),
      },
      {
        id: "eventDate",
        header: "Event date",
        cell: (row) => <span className="whitespace-nowrap">{fmtEventDate(row.eventDate)}</span>,
      },
      {
        id: "created",
        header: "Created",
        cell: (row) => <span className="whitespace-nowrap text-sm text-zinc-500">{fmtEventDate(row.createdAt)}</span>,
      },
      {
        id: "actions",
        header: "Actions",
        headerClassName: "text-right",
        className: "whitespace-nowrap text-right",
        cell: (row) => (
          <div className="inline-flex justify-end gap-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              title="Edit event"
              aria-label="Edit event"
              className="text-emerald-700 hover:text-emerald-800 dark:text-emerald-400"
              onClick={() => handleEditEvent(row)}
            >
              <Pencil className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              title="Delete event"
              aria-label="Delete event"
              className="text-red-600 hover:text-red-700 dark:text-red-400"
              onClick={() => deleteEventMutation.mutate(row.id)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ),
      },
    ];
  }, [deleteEventMutation, deleteSpeakerMutation, events]);

  const sectionNav = (
    <DrmInlineActions
      items={[
        {
          id: "event",
          label: "Event",
          active: showEventForm,
          onClick: () => setShowEventForm((v) => !v),
        },
        {
          id: "speaker",
          label: "Speaker",
          active: showSpeakerForm,
          onClick: () => setShowSpeakerForm((v) => !v),
        },
        {
          id: "attendee",
          label: "Attendee",
          active: showAttendeeForm,
          onClick: () => setShowAttendeeForm((v) => !v),
        },
      ]}
    />
  );

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Events"
        title="Add event"
        description="Create events, attach speakers, and record attendees."
      />

      <div className="flex flex-wrap items-center justify-between gap-2">{sectionNav}</div>

      <div className="space-y-4">
        {showEventForm ? (
          <DrmSection
            title={editingEventId ? "Edit event" : "New event"}
            description="Event details and scheduling."
          >
            <EventsFormGrid cols={5}>
              <Field id="ev-name" label="Event name">
                <Input
                  id="ev-name"
                  value={eventForm.name}
                  onChange={(e) => setEventForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="Event name"
                  className={drmFieldClass}
                />
              </Field>
              <Field id="ev-type" label="Event type">
                <Select value={eventForm.eventType} onValueChange={(v) => setEventForm((f) => ({ ...f, eventType: v }))}>
                  <SelectTrigger className={eventsSelectTriggerClass}>
                    <SelectValue placeholder="Choose…" />
                  </SelectTrigger>
                  <SelectContent>
                    {EVENT_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field id="ev-start" label="Start time">
                <Input
                  id="ev-start"
                  type="time"
                  value={eventForm.startTime}
                  onChange={(e) => setEventForm((f) => ({ ...f, startTime: e.target.value }))}
                  className={drmFieldClass}
                />
              </Field>
              <Field id="ev-end" label="End time">
                <Input
                  id="ev-end"
                  type="time"
                  value={eventForm.endTime}
                  onChange={(e) => setEventForm((f) => ({ ...f, endTime: e.target.value }))}
                  className={drmFieldClass}
                />
              </Field>
              <Field id="ev-attending" label="Attending">
                <Input
                  id="ev-attending"
                  type="number"
                  value={eventForm.attendeeCount}
                  onChange={(e) => setEventForm((f) => ({ ...f, attendeeCount: e.target.value }))}
                  placeholder="0"
                  className={drmFieldClass}
                />
              </Field>
              <Field id="ev-date" label="Date">
                <Input
                  id="ev-date"
                  type="date"
                  value={eventForm.eventDate}
                  onChange={(e) => setEventForm((f) => ({ ...f, eventDate: e.target.value }))}
                  className={drmFieldClass}
                />
              </Field>
              <Field id="ev-map" label="Map URL">
                <Input
                  id="ev-map"
                  value={eventForm.mapUrl}
                  onChange={(e) => setEventForm((f) => ({ ...f, mapUrl: e.target.value }))}
                  placeholder="https://…"
                  className={drmFieldClass}
                />
              </Field>
              <Field id="ev-amount" label="Amount">
                <Input
                  id="ev-amount"
                  type="number"
                  value={eventForm.amount}
                  onChange={(e) => setEventForm((f) => ({ ...f, amount: e.target.value }))}
                  placeholder="0"
                  className={drmFieldClass}
                />
              </Field>
              <Field id="ev-venue" label="Venue">
                <Input
                  id="ev-venue"
                  value={eventForm.venue}
                  onChange={(e) => setEventForm((f) => ({ ...f, venue: e.target.value }))}
                  placeholder="Venue"
                  className={drmFieldClass}
                />
              </Field>
              <Field id="ev-status" label="Status">
                <Select value={eventForm.status} onValueChange={(v) => setEventForm((f) => ({ ...f, status: v }))}>
                  <SelectTrigger className={eventsSelectTriggerClass}>
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    {EVENT_STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </EventsFormGrid>
            <DrmFormActions>
              <Button type="button" variant="primary" size="sm" onClick={handleAddEvent} disabled={saveEventMutation.isPending}>
                {editingEventId ? "Update" : "Submit"}
              </Button>
              {editingEventId ? (
                <Button type="button" variant="secondary" size="sm" onClick={cancelEdit}>
                  Cancel
                </Button>
              ) : null}
            </DrmFormActions>
          </DrmSection>
        ) : null}

        {showSpeakerForm ? (
          <DrmSection title="Add speaker" description="Attach a speaker to an existing event.">
            <EventsFormGrid cols={3}>
              <Field id="sp-name" label="Speaker name">
                <Input
                  id="sp-name"
                  value={speakerForm.speakerName}
                  onChange={(e) => setSpeakerForm((f) => ({ ...f, speakerName: e.target.value }))}
                  placeholder="Speaker name"
                  className={drmFieldClass}
                />
              </Field>
              <Field id="sp-event" label="Event">
                <Select value={speakerForm.eventId} onValueChange={(v) => setSpeakerForm((f) => ({ ...f, eventId: v }))}>
                  <SelectTrigger className={eventsSelectTriggerClass}>
                    <SelectValue placeholder="Select event…" />
                  </SelectTrigger>
                  <SelectContent>
                    {events.map((ev) => (
                      <SelectItem key={ev.id} value={ev.id}>
                        {ev.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field id="sp-topic" label="Topic">
                <Input
                  id="sp-topic"
                  value={speakerForm.topic}
                  onChange={(e) => setSpeakerForm((f) => ({ ...f, topic: e.target.value }))}
                  className={drmFieldClass}
                />
              </Field>
              <Field id="sp-start" label="Start time">
                <Input
                  id="sp-start"
                  type="time"
                  value={speakerForm.startTime}
                  onChange={(e) => setSpeakerForm((f) => ({ ...f, startTime: e.target.value }))}
                  className={drmFieldClass}
                />
              </Field>
              <Field id="sp-end" label="End time">
                <Input
                  id="sp-end"
                  type="time"
                  value={speakerForm.endTime}
                  onChange={(e) => setSpeakerForm((f) => ({ ...f, endTime: e.target.value }))}
                  className={drmFieldClass}
                />
              </Field>
              <Field id="sp-detail" label="Detail">
                <Input
                  id="sp-detail"
                  value={speakerForm.detail}
                  onChange={(e) => setSpeakerForm((f) => ({ ...f, detail: e.target.value }))}
                  placeholder="Optional detail"
                  className={drmFieldClass}
                />
              </Field>
            </EventsFormGrid>
            <DrmFormActions>
              <Button type="button" variant="primary" size="sm" onClick={handleAddSpeaker} disabled={addSpeakerMutation.isPending}>
                Submit
              </Button>
            </DrmFormActions>
          </DrmSection>
        ) : null}

        {showAttendeeForm ? (
          <DrmSection title="Add attendee" description="Link a customer to an event and record attendance.">
            <EventsFormGrid cols={3}>
              <Field id="at-event" label="Event">
                <Select value={attendeeForm.eventId} onValueChange={(v) => setAttendeeForm((f) => ({ ...f, eventId: v }))}>
                  <SelectTrigger className={eventsSelectTriggerClass}>
                    <SelectValue placeholder="Select event…" />
                  </SelectTrigger>
                  <SelectContent>
                    {events.map((ev) => (
                      <SelectItem key={ev.id} value={ev.id}>
                        {ev.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field id="at-company" label="Company">
                <Select
                  value={attendeeForm.customerId}
                  onValueChange={(v) => setAttendeeForm((f) => ({ ...f, customerId: v }))}
                >
                  <SelectTrigger className={eventsSelectTriggerClass}>
                    <SelectValue placeholder="Search & select…" />
                  </SelectTrigger>
                  <SelectContent>
                    <div className="p-2" onKeyDown={(e) => e.stopPropagation()}>
                      <Input
                        placeholder="Type at least 2 characters…"
                        value={customerSearch}
                        onChange={(e) => setCustomerSearch(e.target.value)}
                        className={cn(drmFieldClass, "h-8 text-xs")}
                      />
                    </div>
                    {customerOptions.length === 0 ? (
                      <div className="px-2 py-1.5 text-sm text-zinc-500">
                        {trimmedCustomerSearch.length >= 2 ? "No companies found" : "Type to search…"}
                      </div>
                    ) : (
                      customerOptions.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.companyName}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </Field>
              <Field id="at-status" label="Present / absent">
                <Select
                  value={attendeeForm.attendanceStatus}
                  onValueChange={(v) =>
                    setAttendeeForm((f) => ({ ...f, attendanceStatus: v as typeof f.attendanceStatus }))
                  }
                >
                  <SelectTrigger className={eventsSelectTriggerClass}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ATTENDANCE_STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </EventsFormGrid>
            <div className="mt-4 flex items-center gap-2">
              <Checkbox
                id="resultedInSale"
                checked={attendeeForm.resultedInSale}
                onCheckedChange={(checked) => setAttendeeForm((f) => ({ ...f, resultedInSale: checked === true }))}
              />
              <label htmlFor="resultedInSale" className="cursor-pointer text-sm text-zinc-700 dark:text-zinc-300">
                Resulted in a sale
              </label>
            </div>
            <DrmFormActions>
              <Button type="button" variant="primary" size="sm" onClick={handleAddAttendee} disabled={addAttendeeMutation.isPending}>
                Submit
              </Button>
            </DrmFormActions>
          </DrmSection>
        ) : null}

        <DrmSection
          title="All events"
          description={
            eventsQuery.isLoading
              ? "Loading…"
              : `${events.length} event${events.length === 1 ? "" : "s"} (latest 100)`
          }
        >
          <DataTable
            columns={columns}
            rows={events}
            rowKey={(row) => row.id}
            loading={eventsQuery.isLoading}
            error={eventsQuery.isError ? "Failed to load events." : null}
            onRetry={() => eventsQuery.refetch()}
            emptyMessage="No events found."
            className="min-w-[1100px]"
          />
        </DrmSection>
      </div>
    </div>
  );
}
