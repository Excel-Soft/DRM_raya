"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Bell, Eye, Pencil, Plus, Trash2, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { PageError, PageLoading } from "@/components/ui/page-states";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/legacy/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/legacy/select";
import { Button as LegacyButton } from "@/components/ui/legacy/button";
import { isManagerialRole } from "@/lib/auth/role-utils";
import { apiRequest, queryClient } from "@/lib/query/query-client";
import { useToast } from "@/lib/hooks/use-legacy-toast";
import { useAuth } from "@/providers/auth-provider";
import { NoticeNavTabs } from "@/modules/notice/notice-nav";
import { DrmSection, NoticeShell, drmFieldClass, fmtNoticeDate } from "@/modules/notice/notice-ui";
import { cn } from "@/lib/utils/cn";

type NoticeStatus = "Active" | "Inactive" | "Archived";

type NoticeRow = {
  id: string;
  title: string;
  description: string;
  status: NoticeStatus;
  assignedToRole?: string | null;
  assignedToDepartment?: string | null;
  assignedDate?: string | null;
  createdAt: string;
  assignedBy?: { name: string | null } | null;
};

type UserOption = { id: string; label: string };

const STATUSES: NoticeStatus[] = ["Active", "Inactive", "Archived"];

function audienceLabel(n: NoticeRow): string {
  return n.assignedToDepartment || n.assignedToRole || "All staff";
}

function statusBadgeVariant(status: string): "success" | "neutral" | "warning" {
  if (status === "Active") return "success";
  if (status === "Archived") return "warning";
  return "neutral";
}

export function NoticeBoardView() {
  const { toast } = useToast();
  const { user } = useAuth();
  const canManage =
    isManagerialRole(user?.activeRoleId) || (user?.roles ?? []).some((r) => isManagerialRole(r));

  const [search, setSearch] = useState("");
  const [editorOpen, setEditorOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [viewTarget, setViewTarget] = useState<NoticeRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<NoticeRow | null>(null);
  const [editing, setEditing] = useState<NoticeRow | null>(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<NoticeStatus>("Active");

  const [assignNoticeId, setAssignNoticeId] = useState("");
  const [assignUserId, setAssignUserId] = useState("");

  const {
    data: notices = [],
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery<NoticeRow[]>({
    queryKey: ["/api/notice-board"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/notice-board");
      if (!res.ok) throw new Error("Failed to load notices");
      return res.json();
    },
  });

  const { data: usersList = [] } = useQuery<UserOption[]>({
    queryKey: ["/api/users", "notice-assign"],
    enabled: canManage && assignOpen,
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/users");
      if (!res.ok) throw new Error("Failed to load users");
      const json = await res.json();
      const arr = Array.isArray(json) ? json : json.data ?? json.users ?? [];
      return (arr as { id: string; fullName?: string; name?: string; email?: string }[]).map((u) => ({
        id: u.id,
        label: u.fullName || u.name || u.email || u.id,
      }));
    },
  });

  const invalidate = () => void queryClient.invalidateQueries({ queryKey: ["/api/notice-board"] });

  const saveMutation = useMutation({
    mutationFn: async (payload: { id?: string; body: Record<string, unknown> }) => {
      if (payload.id) {
        const res = await apiRequest("PATCH", `/api/notice-board/${payload.id}`, payload.body);
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error((body as { error?: string }).error || "Update failed");
        return body;
      }
      const res = await apiRequest("POST", "/api/notice-board", payload.body);
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((body as { error?: string }).error || "Create failed");
      return body;
    },
    onSuccess: () => {
      toast({ title: editing ? "Notice updated" : "Notice created" });
      invalidate();
      closeEditor();
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("DELETE", `/api/notice-board/${id}`);
      if (!res.ok) throw new Error("Delete failed");
    },
    onSuccess: () => {
      toast({ title: "Notice deleted" });
      invalidate();
      setDeleteTarget(null);
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const assignMutation = useMutation({
    mutationFn: async (payload: { noticeId: string; userId: string }) => {
      const res = await apiRequest("POST", "/api/notice-board/assign", payload);
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((body as { error?: string }).error || "Assign failed");
      return body;
    },
    onSuccess: () => {
      toast({ title: "Notice assigned" });
      setAssignOpen(false);
      setAssignNoticeId("");
      setAssignUserId("");
    },
    onError: (err: Error) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const rows = Array.isArray(notices) ? notices : [];

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (n) => n.title.toLowerCase().includes(q) || n.description.toLowerCase().includes(q) || audienceLabel(n).toLowerCase().includes(q),
    );
  }, [rows, search]);

  const openCreate = () => {
    setEditing(null);
    setTitle("");
    setDescription("");
    setStatus("Active");
    setEditorOpen(true);
  };

  const openEdit = (n: NoticeRow) => {
    setEditing(n);
    setTitle(n.title);
    setDescription(n.description);
    setStatus(n.status);
    setEditorOpen(true);
  };

  const closeEditor = () => {
    setEditorOpen(false);
    setEditing(null);
  };

  const onSave = () => {
    if (!title.trim() || !description.trim()) {
      toast({ title: "Title and detail are required", variant: "destructive" });
      return;
    }
    saveMutation.mutate({
      id: editing?.id,
      body: { title: title.trim(), description: description.trim(), status },
    });
  };

  const columns: DataTableColumn<NoticeRow>[] = [
    {
      id: "title",
      header: "Notice",
      cell: (n) => (
        <div>
          <div className="font-medium text-zinc-900 dark:text-zinc-100">{n.title}</div>
          <p className="mt-0.5 flex items-center gap-1 text-xs text-zinc-500">
            <Users className="h-3 w-3" aria-hidden />
            {audienceLabel(n)}
          </p>
        </div>
      ),
    },
    {
      id: "description",
      header: "Detail",
      cell: (n) => <p className="line-clamp-2 max-w-md text-xs text-zinc-600 dark:text-zinc-400">{n.description}</p>,
    },
    {
      id: "date",
      header: "Assigned",
      cell: (n) => fmtNoticeDate(n.assignedDate || n.createdAt),
      className: "whitespace-nowrap text-xs tabular-nums text-zinc-600 dark:text-zinc-400",
    },
    {
      id: "status",
      header: "Status",
      cell: (n) => <Badge variant={statusBadgeVariant(n.status)}>{n.status}</Badge>,
      className: "whitespace-nowrap",
    },
    {
      id: "actions",
      header: "",
      cell: (n) => (
        <div className="flex justify-end gap-1">
          <Button type="button" variant="ghost" size="sm" onClick={() => setViewTarget(n)} aria-label="View notice">
            <Eye className="h-4 w-4" />
          </Button>
          {canManage ? (
            <>
              <Button type="button" variant="ghost" size="sm" onClick={() => openEdit(n)} aria-label="Edit notice">
                <Pencil className="h-4 w-4" />
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => setDeleteTarget(n)} aria-label="Delete notice">
                <Trash2 className="h-4 w-4 text-red-600" />
              </Button>
            </>
          ) : null}
        </div>
      ),
      className: "w-28",
    },
  ];

  if (!user && !isLoading) {
    return null;
  }

  return (
    <NoticeShell
      title="Notice board"
      description="Team announcements. Managers can create, assign, and archive notices."
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <NoticeNavTabs />
          {canManage ? (
            <>
              <Button type="button" size="sm" className="bg-emerald-600 hover:bg-emerald-700" onClick={openCreate}>
                <Plus className="mr-1 h-4 w-4" aria-hidden />
                Add notice
              </Button>
              <Button type="button" size="sm" variant="secondary" onClick={() => setAssignOpen(true)}>
                <Users className="mr-1 h-4 w-4" aria-hidden />
                Assign
              </Button>
            </>
          ) : null}
        </div>
      }
    >
      <DrmSection
        title="Recent notices"
        actions={
          <Input
            placeholder="Search notices…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={cn(drmFieldClass, "h-9 w-full max-w-xs text-sm")}
            aria-label="Search notices"
          />
        }
      >
        {isLoading ? (
          <PageLoading label="Loading notices…" />
        ) : isError ? (
          <PageError message={error instanceof Error ? error.message : "Failed to load notices"} onRetry={() => void refetch()} />
        ) : (
          <DataTable
            caption="Notice board"
            columns={columns}
            rows={filtered}
            rowKey={(n) => n.id}
            emptyMessage={search ? "No notices match your search." : "No notices yet."}
          />
        )}
      </DrmSection>

      <Dialog open={editorOpen} onOpenChange={(open) => !open && closeEditor()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit notice" : "Add notice"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Field id="notice-title" label="Name">
              <Input id="notice-title" value={title} onChange={(e) => setTitle(e.target.value)} className={drmFieldClass} />
            </Field>
            <Field id="notice-detail" label="Detail">
              <Textarea id="notice-detail" rows={4} value={description} onChange={(e) => setDescription(e.target.value)} className={drmFieldClass} />
            </Field>
            {canManage ? (
              <Field id="notice-status" label="Status">
                <Select value={status} onValueChange={(v) => setStatus(v as NoticeStatus)}>
                  <SelectTrigger className={drmFieldClass}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            ) : null}
          </div>
          <DialogFooter>
            <LegacyButton type="button" variant="outline" onClick={closeEditor}>
              Close
            </LegacyButton>
            <Button type="button" className="bg-emerald-600 hover:bg-emerald-700" disabled={saveMutation.isPending} onClick={onSave}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Assign notice</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="assign-notice" label="Notice">
              <Select value={assignNoticeId} onValueChange={setAssignNoticeId}>
                <SelectTrigger className={drmFieldClass}>
                  <SelectValue placeholder="Select notice" />
                </SelectTrigger>
                <SelectContent>
                  {rows.map((n) => (
                    <SelectItem key={n.id} value={n.id}>
                      {n.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field id="assign-user" label="User">
              <Select value={assignUserId} onValueChange={setAssignUserId}>
                <SelectTrigger className={drmFieldClass}>
                  <SelectValue placeholder="Choose user" />
                </SelectTrigger>
                <SelectContent>
                  {usersList.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>
          <DialogFooter>
            <LegacyButton type="button" variant="outline" onClick={() => setAssignOpen(false)}>
              Close
            </LegacyButton>
            <Button
              type="button"
              className="bg-emerald-600 hover:bg-emerald-700"
              disabled={assignMutation.isPending || !assignNoticeId || !assignUserId}
              onClick={() => assignMutation.mutate({ noticeId: assignNoticeId, userId: assignUserId })}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!viewTarget} onOpenChange={(open) => !open && setViewTarget(null)}>
        <DialogContent className="sm:max-w-md">
          {viewTarget ? (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Bell className="h-4 w-4 text-emerald-600" aria-hidden />
                  Notice details
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={statusBadgeVariant(viewTarget.status)}>{viewTarget.status}</Badge>
                  <span className="text-xs text-zinc-500">{fmtNoticeDate(viewTarget.assignedDate || viewTarget.createdAt)}</span>
                </div>
                <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100">{viewTarget.title}</h3>
                <p className="text-xs text-emerald-700 dark:text-emerald-400">{audienceLabel(viewTarget)}</p>
                <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-sm text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300">
                  {viewTarget.description}
                </div>
                <p className="text-[11px] text-zinc-500">
                  Created by: <span className="font-medium">{viewTarget.assignedBy?.name || "—"}</span>
                </p>
              </div>
              <DialogFooter>
                <Button type="button" className="w-full bg-emerald-600 hover:bg-emerald-700" onClick={() => setViewTarget(null)}>
                  Close
                </Button>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete notice?"
        description={deleteTarget ? `Remove “${deleteTarget.title}”. This cannot be undone.` : undefined}
        destructive
        pending={deleteMutation.isPending}
        confirmLabel="Delete"
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
      />
    </NoticeShell>
  );
}
