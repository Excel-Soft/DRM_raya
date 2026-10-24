"use client";

import { useMemo, useState } from "react";
import { format } from "date-fns";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Pencil, Trash2, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { apiRequest, queryClient } from "@/lib/query/query-client";
import { useToast } from "@/lib/hooks/use-legacy-toast";
import {
  DrmFormActions,
  DrmInlineActions,
  DrmSection,
  EventsEditBanner,
  EventsFormGrid,
  drmFieldClass,
  eventsSelectTriggerClass,
} from "@/modules/events/events-ui";

const DUTY_STATUSES = ["pending", "in_progress", "completed", "cancelled"] as const;

type DutyRow = {
  id: string;
  duty: string;
  assignedUserName?: string;
  assignedRole?: string;
  scheduledDate?: string;
  scheduledTime?: string;
  status?: string;
  notes?: string;
  assignedUserId?: string;
};

export function EventsDutyPlannerPage() {
  const { toast } = useToast();
  const [showForm, setShowForm] = useState(false);
  const [eventId, setEventId] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
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

  const dutiesKey = ["/api/events", eventId, "duties"];
  const listQuery = useQuery<{ data: DutyRow[] }>({
    queryKey: dutiesKey,
    enabled: !!eventId,
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/events/${eventId}/duties`);
      if (!res.ok) throw new Error("Failed to fetch duties");
      return res.json();
    },
  });
  const duties = listQuery.data?.data ?? [];

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

  const invalidate = () => queryClient.invalidateQueries({ queryKey: dutiesKey });

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
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
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
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("DELETE", `/api/events/${eventId}/duties/${id}`);
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
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
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
    if (editingId) updateMutation.mutate();
    else createMutation.mutate();
  };

  const handleEdit = (d: DutyRow) => {
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

  const columns = useMemo((): DataTableColumn<DutyRow>[] => {
    return [
      {
        id: "idx",
        header: "#",
        className: "w-12 tabular-nums text-zinc-500",
        cell: (row) => {
          const idx = duties.findIndex((d) => d.id === row.id);
          return <span>{idx >= 0 ? idx + 1 : "—"}</span>;
        },
      },
      {
        id: "person",
        header: "Person",
        cell: (row) => <span>{row.assignedUserName || "—"}</span>,
      },
      { id: "duty", header: "Duty", cell: (row) => <span className="font-medium">{row.duty}</span> },
      {
        id: "role",
        header: "Role",
        cell: (row) => <span className="text-zinc-600 dark:text-zinc-400">{row.assignedRole || "—"}</span>,
      },
      {
        id: "date",
        header: "Date",
        cell: (row) => (
          <span className="whitespace-nowrap text-sm">
            {row.scheduledDate ? format(new Date(row.scheduledDate), "dd-MM-yyyy") : "—"}
          </span>
        ),
      },
      {
        id: "time",
        header: "Time",
        cell: (row) => <span>{row.scheduledTime || "—"}</span>,
      },
      {
        id: "status",
        header: "Status",
        cell: (row) => (
          <Badge variant="neutral" className="normal-case tracking-normal">
            {row.status || "—"}
          </Badge>
        ),
      },
      {
        id: "detail",
        header: "Detail",
        cell: (row) => <span className="text-zinc-600 dark:text-zinc-400">{row.notes || "—"}</span>,
      },
      {
        id: "actions",
        header: "Actions",
        headerClassName: "text-right",
        className: "text-right whitespace-nowrap",
        cell: (row) => (
          <div className="inline-flex gap-1">
            <Button type="button" variant="ghost" size="sm" onClick={() => handleEdit(row)} title="Edit">
              <Pencil className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-red-600 hover:text-red-700 dark:text-red-400"
              onClick={() => deleteMutation.mutate(row.id)}
              title="Delete"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ),
      },
    ];
  }, [deleteMutation, duties]);

  const eventFilter = (
    <Field id="duty-list-event" label="Event" className="w-full sm:w-56">
      <Select
        value={eventId}
        onValueChange={(v) => {
          setEventId(v);
          resetForm();
        }}
      >
        <SelectTrigger id="duty-list-event" className={eventsSelectTriggerClass}>
          <SelectValue placeholder="Select event…" />
        </SelectTrigger>
        <SelectContent>
          {eventsList.map((ev) => (
            <SelectItem key={ev.id} value={ev.id}>
              {ev.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Field>
  );

  const formToggle = (
    <DrmInlineActions
      items={[
        {
          id: "form",
          label: showForm ? "Hide plan form" : "Add plan",
          active: showForm,
          onClick: () => setShowForm((v) => !v),
        },
      ]}
    />
  );

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Events"
        title="Event duty planner"
        description="Assign duties and schedules per event."
      />

      {showForm ? (
        <DrmSection title="Duty plan" description="Create or update a duty assignment." actions={formToggle}>
          {editingId ? <EventsEditBanner label="Editing duty" onCancel={resetForm} /> : null}
          <EventsFormGrid cols={4}>
            <Field id="duty-event" label="Event">
              <Select
                value={eventId}
                onValueChange={(v) => {
                  setEventId(v);
                  resetForm();
                }}
              >
                <SelectTrigger className={eventsSelectTriggerClass}>
                  <SelectValue placeholder="Choose event…" />
                </SelectTrigger>
                <SelectContent>
                  {eventsList.map((ev) => (
                    <SelectItem key={ev.id} value={ev.id}>
                      {ev.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field id="duty-employee" label="Employee">
              <Select value={assignedUserId} onValueChange={setAssignedUserId}>
                <SelectTrigger className={eventsSelectTriggerClass}>
                  <SelectValue placeholder="Choose…" />
                </SelectTrigger>
                <SelectContent>
                  {usersList.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.name || u.username || u.fullName || u.id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field id="duty-name" label="Duty">
              <Input
                id="duty-name"
                value={duty}
                onChange={(e) => setDuty(e.target.value)}
                placeholder="Duty name"
                className={drmFieldClass}
              />
            </Field>
            <Field id="duty-role" label="Role">
              <Input
                id="duty-role"
                value={assignedRole}
                onChange={(e) => setAssignedRole(e.target.value)}
                placeholder="Assigned role"
                className={drmFieldClass}
              />
            </Field>
            <Field id="duty-date" label="Date">
              <Input
                id="duty-date"
                type="date"
                value={scheduledDate}
                onChange={(e) => setScheduledDate(e.target.value)}
                className={drmFieldClass}
              />
            </Field>
            <Field id="duty-time" label="Time">
              <Input
                id="duty-time"
                type="time"
                value={scheduledTime}
                onChange={(e) => setScheduledTime(e.target.value)}
                className={drmFieldClass}
              />
            </Field>
            <Field id="duty-status" label="Status">
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className={eventsSelectTriggerClass}>
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  {DUTY_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s.replace("_", " ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field id="duty-detail" label="Detail">
              <Input
                id="duty-detail"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Optional detail"
                className={drmFieldClass}
              />
            </Field>
          </EventsFormGrid>
          <DrmFormActions>
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={handleSubmit}
              disabled={createMutation.isPending || updateMutation.isPending}
            >
              {editingId ? "Update" : "Submit"}
            </Button>
          </DrmFormActions>
        </DrmSection>
      ) : (
        <div className="flex justify-end">{formToggle}</div>
      )}

      <DrmSection
        title="Duties"
        description={
          !eventId
            ? "Select an event to load duties."
            : listQuery.isLoading
              ? "Loading…"
              : `${duties.length} duty${duties.length === 1 ? "" : "ies"}`
        }
        actions={
          <div className="flex flex-wrap items-end gap-2">
            {eventFilter}
            {!showForm && eventId ? (
              <Button type="button" variant="primary" size="sm" onClick={() => setShowForm(true)} className="mb-0.5">
                <Plus className="mr-2 h-4 w-4" />
                Add plan
              </Button>
            ) : null}
          </div>
        }
      >
        {!eventId ? (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Select an event to view its duties.</p>
        ) : (
          <DataTable
            columns={columns}
            rows={duties}
            rowKey={(row) => row.id}
            loading={listQuery.isLoading}
            error={listQuery.isError ? "Could not load duties." : null}
            onRetry={() => listQuery.refetch()}
            emptyMessage="No duties yet for this event."
            className="min-w-[880px]"
          />
        )}
      </DrmSection>
    </div>
  );
}
