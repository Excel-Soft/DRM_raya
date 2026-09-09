import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MapPin } from "lucide-react";
import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequestJson, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

const EVENT_STATUSES = ["Draft", "Completed", "Cancelled"] as const;

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
  location: "",
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

function isHttpUrl(value: string): boolean {
  return /^https?:\/\//i.test(value.trim());
}

function fmtDate(v: string | null): string {
  if (!v) return "";
  const d = new Date(v);
  if (isNaN(d.getTime())) return String(v);
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export default function EventsAdd() {
  const { toast } = useToast();
  const [showEventForm, setShowEventForm] = useState(true);
  const [showSpeakerForm, setShowSpeakerForm] = useState(true);

  const [eventForm, setEventForm] = useState({ ...EMPTY_EVENT_FORM });
  const [editingEventId, setEditingEventId] = useState<string | null>(null);

  const [speakerForm, setSpeakerForm] = useState({ ...EMPTY_SPEAKER_FORM });

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
        location: eventForm.location.trim() || null,
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
      location: ev.location ?? "",
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

  return (
    <div className="min-h-screen bg-[#f4f6f9] p-4 font-sans dark:bg-zinc-950">
      <div className="mb-6 flex items-center text-sm font-bold tracking-wide uppercase">
        <span className="text-gray-700 dark:text-zinc-400">CREATE EVENT</span>
        <span className="mx-2">/</span>
        <button 
          onClick={() => setShowEventForm(!showEventForm)}
          className={`transition-colors uppercase font-bold text-sm hover:underline ${showEventForm ? 'text-[#00a65a]' : 'text-gray-500 dark:text-slate-400'}`}
        >
          ADD EVENT
        </button>
        <span className="mx-2">/</span>
        <button 
          onClick={() => setShowSpeakerForm(!showSpeakerForm)}
          className={`transition-colors uppercase font-bold text-sm hover:underline ${showSpeakerForm ? 'text-[#00a65a]' : 'text-gray-500 dark:text-slate-400'}`}
        >
          ADD SPEAKER
        </button>
      </div>

      <div className="space-y-6">
        {/* Add Event Form */}
        {showEventForm && (
          <Card className="shadow-sm border-t border-t-gray-200">
          <CardContent className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-4">
              <div>
                <label className="text-xs text-gray-600 font-semibold mb-1 block dark:text-zinc-300">Event Name</label>
                <Input value={eventForm.name} onChange={e => setEventForm(f => ({ ...f, name: e.target.value }))} placeholder="Enter the event name" className="text-sm h-9" />
              </div>
              <div>
                <label className="text-xs text-gray-600 font-semibold mb-1 block dark:text-zinc-300">Event Type</label>
                <Select value={eventForm.eventType} onValueChange={v => setEventForm(f => ({ ...f, eventType: v }))}>
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue placeholder="Choose..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Seminar">Seminar</SelectItem>
                    <SelectItem value="Webinar">Webinar</SelectItem>
                    <SelectItem value="Social Media">Social Media</SelectItem>
                    <SelectItem value="Hum Mashal-e-Rah(lahore)">Hum Mashal-e-Rah(lahore)</SelectItem>
                    <SelectItem value="Tanveer Gujranwala">Tanveer Gujranwala</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-gray-600 font-semibold mb-1 block dark:text-zinc-300">Start Time</label>
                <Input type="time" value={eventForm.startTime} onChange={e => setEventForm(f => ({ ...f, startTime: e.target.value }))} className="text-sm h-9" />
              </div>
              <div>
                <label className="text-xs text-gray-600 font-semibold mb-1 block dark:text-zinc-300">End Time</label>
                <Input type="time" value={eventForm.endTime} onChange={e => setEventForm(f => ({ ...f, endTime: e.target.value }))} className="text-sm h-9" />
              </div>
              <div>
                <label className="text-xs text-gray-600 font-semibold mb-1 block dark:text-zinc-300">Attending</label>
                <Input type="number" value={eventForm.attendeeCount} onChange={e => setEventForm(f => ({ ...f, attendeeCount: e.target.value }))} placeholder="Number of attending" className="text-sm h-9" />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
              <div>
                <label className="text-xs text-gray-600 font-semibold mb-1 block dark:text-zinc-300">Date</label>
                <Input type="date" value={eventForm.eventDate} onChange={e => setEventForm(f => ({ ...f, eventDate: e.target.value }))} className="text-sm h-9" />
              </div>
              <div>
                <label className="text-xs text-gray-600 font-semibold mb-1 block dark:text-zinc-300">Location</label>
                <Input value={eventForm.location} onChange={e => setEventForm(f => ({ ...f, location: e.target.value }))} placeholder="Address or coordinates (lat, long)" className="text-sm h-9" />
              </div>
              <div>
                <label className="text-xs text-gray-600 font-semibold mb-1 block dark:text-zinc-300">Map</label>
                <Input value={eventForm.mapUrl} onChange={e => setEventForm(f => ({ ...f, mapUrl: e.target.value }))} placeholder="http://www.com" className="text-sm h-9" />
              </div>
              <div>
                <label className="text-xs text-gray-600 font-semibold mb-1 block dark:text-zinc-300">Event Amount</label>
                <Input type="number" value={eventForm.amount} onChange={e => setEventForm(f => ({ ...f, amount: e.target.value }))} placeholder="0" className="text-sm h-9" />
              </div>
              <div>
                <label className="text-xs text-gray-600 font-semibold mb-1 block dark:text-zinc-300">Venue</label>
                <Input value={eventForm.venue} onChange={e => setEventForm(f => ({ ...f, venue: e.target.value }))} placeholder="add detail" className="text-sm h-9" />
              </div>
              <div>
                <label className="text-xs text-gray-600 font-semibold mb-1 block dark:text-zinc-300">Status</label>
                <Select value={eventForm.status} onValueChange={v => setEventForm(f => ({ ...f, status: v }))}>
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    {EVENT_STATUSES.map(s => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Button onClick={handleAddEvent} disabled={saveEventMutation.isPending} className="bg-[#00a65a] hover:bg-[#008d4c] text-white px-8 h-9 text-sm font-semibold rounded">
                {editingEventId ? "Update" : "Submit"}
              </Button>
              {editingEventId && (
                <Button onClick={cancelEdit} variant="outline" className="px-8 h-9 text-sm font-semibold rounded">
                  Cancel
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
        )}

        {/* Add Speaker Form */}
        {showSpeakerForm && (
        <Card className="shadow-sm border-t border-t-gray-200">
          <CardContent className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div>
                <label className="text-xs text-gray-600 font-semibold mb-1 block dark:text-zinc-300">Speaker Name</label>
                <Input value={speakerForm.speakerName} onChange={e => setSpeakerForm(f => ({ ...f, speakerName: e.target.value }))} placeholder="Enter the speaker name" className="text-sm h-9" />
              </div>
              <div>
                <label className="text-xs text-gray-600 font-semibold mb-1 block dark:text-zinc-300">Event</label>
                <Select value={speakerForm.eventId} onValueChange={v => setSpeakerForm(f => ({ ...f, eventId: v }))}>
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue placeholder="Select Event" />
                  </SelectTrigger>
                  <SelectContent>
                    {events.map(ev => (
                      <SelectItem key={ev.id} value={ev.id}>{ev.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-gray-600 font-semibold mb-1 block dark:text-zinc-300">Speaker Topic</label>
                <Input value={speakerForm.topic} onChange={e => setSpeakerForm(f => ({ ...f, topic: e.target.value }))} className="text-sm h-9" />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div>
                <label className="text-xs text-gray-600 font-semibold mb-1 block dark:text-zinc-300">Start Time</label>
                <Input type="time" value={speakerForm.startTime} onChange={e => setSpeakerForm(f => ({ ...f, startTime: e.target.value }))} className="text-sm h-9" />
              </div>
              <div>
                <label className="text-xs text-gray-600 font-semibold mb-1 block dark:text-zinc-300">End Time</label>
                <Input type="time" value={speakerForm.endTime} onChange={e => setSpeakerForm(f => ({ ...f, endTime: e.target.value }))} className="text-sm h-9" />
              </div>
              <div>
                <label className="text-xs text-gray-600 font-semibold mb-1 block dark:text-zinc-300">Detail</label>
                <Input value={speakerForm.detail} onChange={e => setSpeakerForm(f => ({ ...f, detail: e.target.value }))} placeholder="add detail" className="text-sm h-9" />
              </div>
            </div>

            <Button onClick={handleAddSpeaker} disabled={addSpeakerMutation.isPending} className="bg-[#00a65a] hover:bg-[#008d4c] text-white px-8 h-9 text-sm font-semibold rounded">
              Submit
            </Button>
          </CardContent>
        </Card>
        )}

        {/* Data Table */}
        <Card className="shadow-sm border-t border-t-gray-200 bg-white dark:bg-zinc-900">
          <CardContent className="p-0 overflow-x-auto">
            <table className="w-full text-[13px] text-left">
              <thead className="text-xs text-gray-700 bg-white border-b font-bold dark:bg-zinc-900 dark:text-zinc-400">
                <tr>
                  <th className="px-4 py-4 whitespace-nowrap">#</th>
                  <th className="px-4 py-4 whitespace-nowrap">Name</th>
                  <th className="px-4 py-4 whitespace-nowrap">Type</th>
                  <th className="px-4 py-4 whitespace-nowrap">Start Time</th>
                  <th className="px-4 py-4 whitespace-nowrap">End Time</th>
                  <th className="px-4 py-4 whitespace-nowrap">Attending</th>
                  <th className="px-4 py-4 whitespace-nowrap w-[350px]">Speaker</th>
                  <th className="px-4 py-4 whitespace-nowrap">Venue</th>
                  <th className="px-4 py-4 whitespace-nowrap">Location</th>
                  <th className="px-4 py-4 whitespace-nowrap">Status</th>
                  <th className="px-4 py-4 whitespace-nowrap">Map</th>
                  <th className="px-4 py-4 whitespace-nowrap">Event Date</th>
                  <th className="px-4 py-4 whitespace-nowrap">Create Date</th>
                  <th className="px-4 py-4 whitespace-nowrap">Action</th>
                </tr>
              </thead>
              <tbody>
                {eventsQuery.isLoading && (
                  <tr><td colSpan={13} className="px-4 py-10 text-center text-gray-500">Loading…</td></tr>
                )}
                {eventsQuery.isError && (
                  <tr><td colSpan={13} className="px-4 py-10 text-center text-red-600">Failed to load events.</td></tr>
                )}
                {!eventsQuery.isLoading && !eventsQuery.isError && events.length === 0 && (
                  <tr><td colSpan={13} className="px-4 py-10 text-center text-gray-500">No events found.</td></tr>
                )}
                {events.map((ev, idx) => (
                  <tr key={ev.id} className="border-b last:border-b-0 transition-colors">
                    <td className="px-4 py-4 text-[#d35400] font-medium align-top">{idx + 1}</td>
                    <td className="px-4 py-4 text-gray-600 font-medium align-top dark:text-zinc-300">{ev.name}</td>
                    <td className="px-4 py-4 text-gray-600 align-top dark:text-zinc-300">{ev.eventType}</td>
                    <td className="px-4 py-4 text-gray-600 align-top dark:text-zinc-300">
                      {ev.startTime}
                    </td>
                    <td className="px-4 py-4 text-gray-600 align-top dark:text-zinc-300">
                      {ev.endTime}
                    </td>
                    <td className="px-4 py-4 text-gray-600 align-top dark:text-zinc-300">{ev.attendeeCount}</td>
                    <td className="px-4 py-4 align-top">
                      {ev.speakers && ev.speakers.length > 0 && (
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="border-b border-gray-100 dark:border-zinc-800">
                              <th className="text-left font-bold pb-2 text-gray-700 dark:text-zinc-400">Name</th>
                              <th className="text-left font-bold pb-2 text-gray-700 dark:text-zinc-400">Start</th>
                              <th className="text-left font-bold pb-2 text-gray-700 dark:text-zinc-400">End</th>
                              <th className="text-left font-bold pb-2 text-gray-700 dark:text-zinc-400">Total</th>
                              <th className="text-left font-bold pb-2 text-gray-700 dark:text-zinc-400"></th>
                            </tr>
                          </thead>
                          <tbody>
                            {ev.speakers.map((sp) => {
                              // Simple calculation for display if both are valid HH:mm
                              let total = "0:00";
                              if (sp.startTime && sp.endTime) {
                                const start = new Date(`1970-01-01T${sp.startTime}:00`);
                                const end = new Date(`1970-01-01T${sp.endTime}:00`);
                                const diffMs = end.getTime() - start.getTime();
                                if (diffMs > 0) {
                                  const hours = Math.floor(diffMs / 3600000);
                                  const minutes = Math.floor((diffMs % 3600000) / 60000);
                                  total = `${hours}:${minutes.toString().padStart(2, '0')}`;
                                }
                              }
                              return (
                                <tr key={sp.id}>
                                  <td className="pt-2 text-gray-600 dark:text-zinc-300">{sp.speakerName}</td>
                                  <td className="pt-2 text-gray-600 dark:text-zinc-300">{sp.startTime}</td>
                                  <td className="pt-2 text-gray-600 dark:text-zinc-300">{sp.endTime}</td>
                                  <td className="pt-2 text-gray-600 dark:text-zinc-300">{total}</td>
                                  <td className="pt-2">
                                    <button
                                      onClick={() => deleteSpeakerMutation.mutate({ eventId: ev.id, speakerId: sp.id })}
                                      className="text-[11px] text-red-600 hover:underline"
                                    >Remove</button>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      )}
                    </td>
                    <td className="px-4 py-4 text-gray-600 align-top dark:text-zinc-300">{ev.venue}</td>
                    <td className="px-4 py-4 text-gray-600 align-top dark:text-zinc-300">{ev.location || "-"}</td>
                    <td className="px-4 py-4 text-gray-600 align-top dark:text-zinc-300">{ev.status}</td>
                    <td className="px-4 py-4 text-[#00a65a] align-top dark:text-zinc-400">
                      {ev.mapUrl ? (
                        <a href={ev.mapUrl} target="_blank" rel="noreferrer" title="View Map">
                          <div className="w-8 h-8 rounded-full border border-[#00a65a] flex items-center justify-center hover:bg-[#00a65a] hover:text-white transition-colors cursor-pointer dark:border-zinc-800">
                            <MapPin className="w-4 h-4" />
                          </div>
                        </a>
                      ) : (
                        <div className="w-8 h-8 rounded-full border border-gray-300 flex items-center justify-center text-gray-400 dark:border-zinc-800">
                          <MapPin className="w-4 h-4" />
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-4 text-gray-600 align-top dark:text-zinc-300">{fmtDate(ev.eventDate)}</td>
                    <td className="px-4 py-4 text-gray-600 align-top dark:text-zinc-300">{fmtDate(ev.createdAt)}</td>
                    <td className="px-4 py-4 align-top">
                      <div className="flex flex-col gap-1">
                        <button onClick={() => handleEditEvent(ev)} className="text-[12px] text-[#00a65a] hover:underline text-left">Edit</button>
                        <button onClick={() => deleteEventMutation.mutate(ev.id)} className="text-[12px] text-red-600 hover:underline text-left">Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
