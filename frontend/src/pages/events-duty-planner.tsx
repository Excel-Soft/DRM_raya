import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useEffect, useState } from "react";
import { format } from "date-fns";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Pencil, Trash2, X } from "lucide-react";
import { RoleGroupedUserSelect } from "@/components/role-grouped-user-select";

const DUTY_STATUSES = ["pending", "in_progress", "completed", "cancelled"] as const;

const PAGE_SIZE = 20;

export default function EventsDutyPlanner() {
  const { toast } = useToast();
  const [showForm, setShowForm] = useState(false);

  // Selected event drives both the listing and the form
  const [eventId, setEventId] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);

  // State for Form
  const [duty, setDuty] = useState("");
  const [assignedUserId, setAssignedUserId] = useState("");
  const [assignedRole, setAssignedRole] = useState("");
  const [scheduledDate, setScheduledDate] = useState("");
  const [scheduledTime, setScheduledTime] = useState("");
  const [status, setStatus] = useState<string>("pending");
  const [notes, setNotes] = useState("");

  const { data: eventsList = [] } = useQuery<any[]>({
    queryKey: ["/api/events", "all-for-dropdowns"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/events?pageSize=200");
      if (!res.ok) throw new Error("Failed to fetch events");
      const json = await res.json();
      return json.data || [];
    },
  });

  const { data: usersList = [] } = useQuery<any[]>({
    queryKey: ["/api/users", "all-for-dropdowns"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/users");
      if (!res.ok) throw new Error("Failed to fetch users");
      const json = await res.json();
      return json.data || json.users || [];
    },
  });

  // No event selected -> ALL duties across events (new + read-only old-DRM
  // rows). Selecting an event in the form scopes the table to that event.
  const dutiesKey = eventId ? ["/api/events", eventId, "duties"] : ["/api/events/duties", { includeLegacy: true }];
  const { data: duties = [], isLoading } = useQuery<any[]>({
    queryKey: dutiesKey,
    queryFn: async () => {
      const res = await apiRequest("GET", eventId ? `/api/events/${eventId}/duties` : "/api/events/duties?includeLegacy=1");
      if (!res.ok) throw new Error("Failed to fetch duties");
      const json = await res.json();
      return json.data || [];
    },
  });

  // Client-side pagination (the duties API returns the full list).
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(duties.length / PAGE_SIZE));
  const pagedDuties = duties.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const firstRow = duties.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const lastRow = Math.min(page * PAGE_SIZE, duties.length);
  // Back to page 1 when switching between "all duties" and one event.
  useEffect(() => { setPage(1); }, [eventId]);
  // e.g. after deleting the only row on the last page, step back to a valid page.
  useEffect(() => { if (page > totalPages) setPage(totalPages); }, [page, totalPages]);

  const resetForm = () => {
    setEditingId(null);
    setDuty("");
    setAssignedUserId("");
    setAssignedRole("");
    setScheduledDate("");
    setScheduledTime("");
    setStatus("pending");
    setNotes("");
  };

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: dutiesKey });
    queryClient.invalidateQueries({ queryKey: ["/api/events/duties"] });
  };

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/events/${eventId}/duties`, {
        duty,
        assignedUserId: assignedUserId || undefined,
        assignedRole: assignedRole || undefined,
        scheduledDate: scheduledDate || undefined,
        scheduledTime: scheduledTime || undefined,
        status,
        notes: notes || undefined,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Failed to add duty");
      }
      return res.json();
    },
    onSuccess: () => {
      invalidate();
      toast({ title: "Success", description: "Duty added" });
      resetForm();
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("PATCH", `/api/events/${eventId}/duties/${editingId}`, {
        duty,
        assignedUserId: assignedUserId || null,
        assignedRole: assignedRole || null,
        scheduledDate: scheduledDate || null,
        scheduledTime: scheduledTime || null,
        status,
        notes: notes || null,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Failed to update duty");
      }
      return res.json();
    },
    onSuccess: () => {
      invalidate();
      toast({ title: "Success", description: "Duty updated" });
      resetForm();
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (d: { id: string; eventId: string }) => {
      const res = await apiRequest("DELETE", `/api/events/${d.eventId || eventId}/duties/${d.id}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Failed to delete duty");
      }
      return res.json();
    },
    onSuccess: () => {
      invalidate();
      toast({ title: "Success", description: "Duty deleted" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const handleSubmit = () => {
    if (!eventId) {
      toast({ title: "Error", description: "Please select an event", variant: "destructive" });
      return;
    }
    if (!duty.trim()) {
      toast({ title: "Error", description: "Duty is required", variant: "destructive" });
      return;
    }
    if (editingId) {
      updateMutation.mutate();
    } else {
      createMutation.mutate();
    }
  };

  const eventName = (id: string | null | undefined) => eventsList.find((ev) => ev.id === id)?.name;

  const handleEdit = (d: any) => {
    // Edit/Delete call /api/events/:eventId/duties/:id, so scope to the row's event.
    if (d.eventId && d.eventId !== eventId) setEventId(d.eventId);
    setEditingId(d.id);
    setDuty(d.duty || "");
    setAssignedUserId(d.assignedUserId || "");
    setAssignedRole(d.assignedRole || "");
    setScheduledDate(d.scheduledDate ? String(d.scheduledDate).slice(0, 10) : "");
    setScheduledTime(d.scheduledTime || "");
    setStatus(d.status || "pending");
    setNotes(d.notes || "");
    setShowForm(true);
  };

  return (
    <div className="min-h-screen bg-[#f4f6f9] p-4 font-sans dark:bg-zinc-950">
      <div className="mb-6 flex items-center text-sm font-bold tracking-wide uppercase">
        <span className="text-gray-700 dark:text-zinc-400">CREATE EVENT DUTY</span>
        <span className="mx-2">/</span>
        <button
          onClick={() => setShowForm(!showForm)}
          className={`transition-colors uppercase font-bold text-sm hover:underline ${showForm ? 'text-[#00a65a]' : 'text-gray-500 dark:text-slate-400'}`}
        >
          ADD PLAN
        </button>
        {eventId && (
          <button
            onClick={() => { setEventId(""); resetForm(); }}
            className="ml-auto text-xs font-semibold normal-case text-[#00a65a] hover:underline"
          >
            Show all duties
          </button>
        )}
      </div>

      <div className="space-y-6">
        {/* Add Plan Form */}
        {showForm && (
          <Card className="shadow-sm border-t border-t-gray-200 dark:border-t-zinc-800">
            <CardContent className="p-6">
              {editingId && (
                <div className="mb-4 flex items-center justify-between rounded bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700 dark:bg-amber-950/40 dark:text-amber-400">
                  <span>Editing duty</span>
                  <button onClick={resetForm} className="flex items-center gap-1 hover:underline">
                    <X className="w-3 h-3" /> Cancel
                  </button>
                </div>
              )}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                <div>
                  <label className="text-xs text-gray-600 font-semibold mb-1 block dark:text-zinc-300">Event</label>
                  <Select value={eventId} onValueChange={(v) => { setEventId(v); resetForm(); }}>
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue placeholder="Choose..." />
                    </SelectTrigger>
                    <SelectContent>
                      {eventsList.map((ev) => (
                        <SelectItem key={ev.id} value={ev.id}>{ev.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs text-gray-600 font-semibold mb-1 block dark:text-zinc-300">Employee</label>
                  <RoleGroupedUserSelect
                    grouped={false}
                    users={usersList}
                    value={assignedUserId}
                    onChange={setAssignedUserId}
                    getLabel={(u) => String(u.name || u.username || u.fullName || u.id)}
                    placeholder="Choose..."
                    className="h-9 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-600 font-semibold mb-1 block dark:text-zinc-300">Duty</label>
                  <Input value={duty} onChange={e => setDuty(e.target.value)} placeholder="enter the duty name" className="text-sm h-9" />
                </div>
                <div>
                  <label className="text-xs text-gray-600 font-semibold mb-1 block dark:text-zinc-300">Role</label>
                  <Input value={assignedRole} onChange={e => setAssignedRole(e.target.value)} placeholder="assigned role" className="text-sm h-9" />
                </div>
                <div>
                  <label className="text-xs text-gray-600 font-semibold mb-1 block dark:text-zinc-300">Date</label>
                  <Input type="date" value={scheduledDate} onChange={e => setScheduledDate(e.target.value)} className="text-sm h-9" />
                </div>
                <div>
                  <label className="text-xs text-gray-600 font-semibold mb-1 block dark:text-zinc-300">Time</label>
                  <Input type="time" value={scheduledTime} onChange={e => setScheduledTime(e.target.value)} className="text-sm h-9" />
                </div>
                <div>
                  <label className="text-xs text-gray-600 font-semibold mb-1 block dark:text-zinc-300">Status</label>
                  <Select value={status} onValueChange={setStatus}>
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue placeholder="Choose..." />
                    </SelectTrigger>
                    <SelectContent>
                      {DUTY_STATUSES.map((s) => (
                        <SelectItem key={s} value={s}>{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs text-gray-600 font-semibold mb-1 block dark:text-zinc-300">Detail</label>
                  <Input value={notes} onChange={e => setNotes(e.target.value)} placeholder="add detail" className="text-sm h-9" />
                </div>
              </div>

              <Button
                onClick={handleSubmit}
                disabled={createMutation.isPending || updateMutation.isPending}
                className="bg-[#00a65a] hover:bg-[#008d4c] text-white px-8 h-9 text-sm font-semibold rounded"
              >
                {editingId ? "Update" : "Submit"}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Data Table */}
        <Card className="shadow-sm border-t border-t-gray-200 dark:border-t-zinc-800 bg-white dark:bg-zinc-900">
          <CardContent className="p-0 overflow-x-auto">
            <table className="w-full text-[13px] text-left">
              <thead className="text-xs text-gray-700 bg-white border-b font-bold dark:bg-zinc-900 dark:text-zinc-400">
                <tr>
                  <th className="px-4 py-4 whitespace-nowrap">#</th>
                  <th className="px-4 py-4 whitespace-nowrap">Event</th>
                  <th className="px-4 py-4 whitespace-nowrap">Person</th>
                  <th className="px-4 py-4 whitespace-nowrap">Duty</th>
                  <th className="px-4 py-4 whitespace-nowrap">Role</th>
                  <th className="px-4 py-4 whitespace-nowrap">Date</th>
                  <th className="px-4 py-4 whitespace-nowrap">Time</th>
                  <th className="px-4 py-4 whitespace-nowrap">Status</th>
                  <th className="px-4 py-4 whitespace-nowrap">Detail</th>
                  <th className="px-4 py-4 whitespace-nowrap text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={10} className="px-4 py-8 text-center text-gray-400 dark:text-zinc-500">Loading...</td>
                  </tr>
                ) : duties.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="px-4 py-8 text-center text-gray-400 dark:text-zinc-500">No duties yet</td>
                  </tr>
                ) : (
                  pagedDuties.map((d, idx) => (
                    <tr key={d.id} className="border-b last:border-b-0 transition-colors">
                      <td className="px-4 py-4 text-[#d35400] font-medium">{(page - 1) * PAGE_SIZE + idx + 1}</td>
                      <td className="px-4 py-4 text-gray-600 dark:text-zinc-300">
                        {d.eventName || eventName(d.eventId) || "-"}
                        {d.eventDate && (
                          <div className="text-[11px] text-gray-400">{format(new Date(d.eventDate), "dd-MM-yyyy")}</div>
                        )}
                      </td>
                      <td className="px-4 py-4 text-gray-600 dark:text-zinc-300">{d.assignedUserName || "-"}</td>
                      <td className="px-4 py-4 text-gray-600 dark:text-zinc-300">{d.duty}</td>
                      <td className="px-4 py-4 text-gray-600 dark:text-zinc-300">{d.assignedRole || "-"}</td>
                      <td className="px-4 py-4 text-gray-600 dark:text-zinc-300">{d.scheduledDate ? format(new Date(d.scheduledDate), "dd-MM-yyyy") : "-"}</td>
                      <td className="px-4 py-4 text-gray-600 dark:text-zinc-300">{d.scheduledTime || "-"}</td>
                      <td className="px-4 py-4 text-gray-600 dark:text-zinc-300">{d.status || "-"}</td>
                      <td className="px-4 py-4 text-gray-600 dark:text-zinc-300">{d.notes || "-"}</td>
                      <td className="px-4 py-4 text-right whitespace-nowrap">
                        {d.isLegacy ? (
                          <span className="text-[11px] text-gray-400">Old DRM</span>
                        ) : (<>
                        <button onClick={() => handleEdit(d)} className="inline-flex items-center justify-center w-8 h-8 rounded text-gray-500 hover:bg-gray-100 hover:text-[#00a65a] dark:hover:bg-zinc-800" title="Edit">
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button onClick={() => deleteMutation.mutate({ id: d.id, eventId: d.eventId })} className="inline-flex items-center justify-center w-8 h-8 rounded text-gray-500 hover:bg-gray-100 hover:text-red-600 dark:hover:bg-zinc-800" title="Delete">
                          <Trash2 className="w-4 h-4" />
                        </button>
                        </>)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
            {duties.length > 0 && (
              <div className="px-4 py-3 border-t flex flex-wrap items-center justify-between gap-2 dark:border-zinc-800">
                <span className="text-sm text-gray-500 dark:text-zinc-400">
                  Showing {firstRow}–{lastRow} of {duties.length} duties
                </span>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => Math.max(1, p - 1))}>
                    Previous
                  </Button>
                  <span className="text-sm text-gray-600 dark:text-zinc-300">Page {page} of {totalPages}</span>
                  <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => Math.min(totalPages, p + 1))}>
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
