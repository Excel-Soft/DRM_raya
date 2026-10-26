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

const MENU_STATUSES = ["pending", "in_progress", "completed", "cancelled"] as const;

type MenuItemRow = {
  id: string;
  eventId: string;
  itemName: string;
  eventName?: string;
  amount: number;
  notes?: string | null;
  createdAt?: string;
  assignedUserId?: string;
  assignedRole?: string;
  scheduledDate?: string;
  scheduledTime?: string;
  status?: string;
};

export function EventsMenuPage() {
  const { toast } = useToast();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [eventId, setEventId] = useState("");
  const [itemName, setItemName] = useState("");
  const [amount, setAmount] = useState("");
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

  const today = format(new Date(), "yyyy-MM-dd");
  const upcomingEvents = eventsList.filter(
    (ev) => ev.eventDate && String(ev.eventDate).slice(0, 10) > today,
  );

  const { data: usersList = [] } = useQuery<any[]>({
    queryKey: ["/api/users", "all-for-dropdowns"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/users");
      if (!res.ok) throw new Error("Failed to fetch users");
      const json = await res.json();
      return json.data || json.users || [];
    },
  });

  const menuItemsKey = ["/api/events/menu-items"];
  const listQuery = useQuery<{ data: MenuItemRow[]; totalAmount: number }>({
    queryKey: menuItemsKey,
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/events/menu-items");
      if (!res.ok) throw new Error("Failed to fetch menu items");
      return res.json();
    },
  });
  const menuItems = listQuery.data?.data ?? [];
  const totalAmount = listQuery.data?.totalAmount ?? 0;

  const resetForm = () => {
    setEditingId(null);
    setEditingEventId(null);
    setEventId("");
    setItemName("");
    setAmount("");
    setAssignedUserId("");
    setAssignedRole("");
    setScheduledDate("");
    setScheduledTime("");
    setStatus("pending");
    setNotes("");
  };

  const invalidate = () => queryClient.invalidateQueries({ queryKey: menuItemsKey });

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/events/${eventId}/menu-items`, {
        itemName,
        amount: amount === "" ? 0 : Number(amount),
        assignedUserId: assignedUserId || undefined,
        assignedRole: assignedRole || undefined,
        scheduledDate: scheduledDate || undefined,
        scheduledTime: scheduledTime || undefined,
        status,
        notes: notes || undefined,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Failed to add menu item");
      }
      return res.json();
    },
    onSuccess: () => {
      invalidate();
      toast({ title: "Success", description: "Menu item added" });
      resetForm();
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("PATCH", `/api/events/${editingEventId}/menu-items/${editingId}`, {
        itemName,
        amount: amount === "" ? 0 : Number(amount),
        assignedUserId: assignedUserId || null,
        assignedRole: assignedRole || null,
        scheduledDate: scheduledDate || null,
        scheduledTime: scheduledTime || null,
        status,
        notes: notes || null,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Failed to update menu item");
      }
      return res.json();
    },
    onSuccess: () => {
      invalidate();
      toast({ title: "Success", description: "Menu item updated" });
      resetForm();
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async ({ eventId: evId, itemId }: { eventId: string; itemId: string }) => {
      const res = await apiRequest("DELETE", `/api/events/${evId}/menu-items/${itemId}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Failed to delete menu item");
      }
      return res.json();
    },
    onSuccess: () => {
      invalidate();
      toast({ title: "Success", description: "Menu item deleted" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const handleSubmit = () => {
    if (!itemName.trim()) {
      toast({ title: "Error", description: "Item name is required", variant: "destructive" });
      return;
    }
    if (editingId) {
      updateMutation.mutate();
      return;
    }
    if (!eventId) {
      toast({ title: "Error", description: "Please select an event", variant: "destructive" });
      return;
    }
    createMutation.mutate();
  };

  const handleEdit = (m: MenuItemRow) => {
    setEditingId(m.id);
    setEditingEventId(m.eventId);
    setEventId(m.eventId);
    setItemName(m.itemName || "");
    setAmount(m.amount != null ? String(m.amount) : "");
    setAssignedUserId(m.assignedUserId || "");
    setAssignedRole(m.assignedRole || "");
    setScheduledDate(m.scheduledDate ? String(m.scheduledDate).slice(0, 10) : "");
    setScheduledTime(m.scheduledTime || "");
    setStatus(m.status || "pending");
    setNotes(m.notes || "");
    setShowForm(true);
  };

  const columns = useMemo((): DataTableColumn<MenuItemRow>[] => {
    return [
      {
        id: "idx",
        header: "#",
        className: "w-12 tabular-nums text-zinc-500",
        cell: (row) => {
          const idx = menuItems.findIndex((m) => m.id === row.id);
          return <span>{idx >= 0 ? idx + 1 : "—"}</span>;
        },
      },
      {
        id: "item",
        header: "Item",
        cell: (row) => <span className="font-medium text-zinc-800 dark:text-zinc-200">{row.itemName}</span>,
      },
      {
        id: "event",
        header: "Event",
        cell: (row) => <span className="text-zinc-600 dark:text-zinc-400">{row.eventName || "—"}</span>,
      },
      {
        id: "amount",
        header: "Amount",
        cell: (row) => <span className="tabular-nums">{row.amount}</span>,
      },
      {
        id: "detail",
        header: "Detail",
        cell: (row) => <span className="text-zinc-600 dark:text-zinc-400">{row.notes || "—"}</span>,
      },
      {
        id: "created",
        header: "Created",
        cell: (row) => (
          <span className="whitespace-nowrap text-sm text-zinc-500">
            {row.createdAt ? format(new Date(row.createdAt), "dd-MM-yyyy") : "—"}
          </span>
        ),
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
              onClick={() => deleteMutation.mutate({ eventId: row.eventId, itemId: row.id })}
              title="Delete"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ),
      },
    ];
  }, [deleteMutation, menuItems]);

  const formToggle = (
    <DrmInlineActions
      items={[
        {
          id: "form",
          label: showForm ? "Hide form" : "Add menu item",
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
        title="Add event menu"
        description="Budget and expense line items for upcoming events."
      />

      {showForm ? (
        <DrmSection title="Menu item" description="Line item against an upcoming event." actions={formToggle}>
          {editingId ? <EventsEditBanner label="Editing menu item" onCancel={resetForm} /> : null}
          <EventsFormGrid cols={4}>
            <Field id="menu-item" label="Item">
              <Input
                id="menu-item"
                value={itemName}
                onChange={(e) => setItemName(e.target.value)}
                placeholder="Item name"
                className={drmFieldClass}
              />
            </Field>
            <Field id="menu-event" label="Event">
              <Select value={eventId} onValueChange={setEventId} disabled={!!editingId}>
                <SelectTrigger className={eventsSelectTriggerClass}>
                  <SelectValue placeholder="Choose event…" />
                </SelectTrigger>
                <SelectContent>
                  {upcomingEvents.length === 0 ? (
                    <div className="px-2 py-1.5 text-sm text-zinc-500">No upcoming events</div>
                  ) : (
                    upcomingEvents.map((ev) => (
                      <SelectItem key={ev.id} value={ev.id}>
                        {ev.name}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </Field>
            <Field id="menu-amount" label="Amount">
              <Input
                id="menu-amount"
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0"
                className={drmFieldClass}
              />
            </Field>
            <Field id="menu-detail" label="Detail">
              <Input
                id="menu-detail"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Optional detail"
                className={drmFieldClass}
              />
            </Field>
            <Field id="menu-assign" label="Assign to">
              <Select value={assignedUserId} onValueChange={setAssignedUserId}>
                <SelectTrigger className={eventsSelectTriggerClass}>
                  <SelectValue placeholder="Employee…" />
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
            <Field id="menu-role" label="Role">
              <Input
                id="menu-role"
                value={assignedRole}
                onChange={(e) => setAssignedRole(e.target.value)}
                placeholder="Assigned role"
                className={drmFieldClass}
              />
            </Field>
            <Field id="menu-date" label="Date">
              <Input
                id="menu-date"
                type="date"
                value={scheduledDate}
                onChange={(e) => setScheduledDate(e.target.value)}
                className={drmFieldClass}
              />
            </Field>
            <Field id="menu-time" label="Time">
              <Input
                id="menu-time"
                type="time"
                value={scheduledTime}
                onChange={(e) => setScheduledTime(e.target.value)}
                className={drmFieldClass}
              />
            </Field>
            <Field id="menu-status" label="Status">
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className={eventsSelectTriggerClass}>
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  {MENU_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s.replace("_", " ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
        title="Upcoming event menu"
        description={
          listQuery.isLoading
            ? "Loading…"
            : `${menuItems.length} item${menuItems.length === 1 ? "" : "s"}${menuItems.length > 0 ? ` · total ${totalAmount}` : ""}`
        }
        actions={
          !showForm ? (
            <Button type="button" variant="primary" size="sm" onClick={() => setShowForm(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add item
            </Button>
          ) : null
        }
      >
        <DataTable
          columns={columns}
          rows={menuItems}
          rowKey={(row) => row.id}
          loading={listQuery.isLoading}
          error={listQuery.isError ? "Could not load menu items." : null}
          onRetry={() => listQuery.refetch()}
          emptyMessage="No menu items for upcoming events."
          className="min-w-[720px]"
        />
        {menuItems.length > 0 ? (
          <div className="mt-3 flex justify-end gap-2 text-sm font-semibold text-zinc-700 dark:text-zinc-300">
            <span>Total</span>
            <Badge variant="neutral" className="normal-case tabular-nums tracking-normal">
              {totalAmount}
            </Badge>
          </div>
        ) : null}
      </DrmSection>
    </div>
  );
}
