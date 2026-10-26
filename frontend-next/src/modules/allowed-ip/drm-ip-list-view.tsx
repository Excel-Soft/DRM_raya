"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, Save } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { PageError, PageForbidden } from "@/components/ui/page-states";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/legacy/switch";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/legacy/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/legacy/alert-dialog";
import { Button as LegacyButton } from "@/components/ui/legacy/button";
import { apiRequest, queryClient } from "@/lib/query/query-client";
import { useToast } from "@/lib/hooks/use-legacy-toast";
import { DrmSection, drmFieldClass } from "@/modules/users/users-ui";
import { readSettingsError, type AllowedIpForm } from "@/modules/allowed-ip/allowed-ip-api";

export type AllowedIpRow = {
  id: string;
  ip_cidr: string;
  description: string | null;
  is_active: boolean;
  createdAt: string;
  updatedAt: string;
};

const emptyForm: AllowedIpForm = { ip_cidr: "", description: "", is_active: true };

const fmtDateTime = (v?: string) => (v ? new Date(v).toLocaleString() : "—");

const ipDialogClass =
  "gap-0 overflow-hidden border-zinc-200 bg-white p-0 dark:border-zinc-800 dark:bg-zinc-900 sm:max-w-md sm:rounded-2xl";

export function DrmIpListView() {
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<AllowedIpForm>(emptyForm);
  const [deleteTarget, setDeleteTarget] = useState<AllowedIpRow | null>(null);

  const listQuery = useQuery<AllowedIpRow[]>({
    queryKey: ["/api/settings/allowed-ips"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/settings/allowed-ips");
      if (res.status === 403) {
        throw Object.assign(new Error("forbidden"), { status: 403 });
      }
      if (!res.ok) {
        throw new Error(await readSettingsError(res, "Could not load allowed IPs."));
      }
      return res.json();
    },
  });

  const forbidden = listQuery.isError && (listQuery.error as { status?: number })?.status === 403;

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["/api/settings/allowed-ips"] });

  const saveMutation = useMutation({
    mutationFn: async (payload: { id: string | null; data: AllowedIpForm }) => {
      const { id, data } = payload;
      const res = id
        ? await apiRequest("PATCH", `/api/settings/allowed-ips/${id}`, data)
        : await apiRequest("POST", "/api/settings/allowed-ips", data);
      if (!res.ok) {
        throw new Error(await readSettingsError(res, "Failed to save allowed IP."));
      }
      return res.json();
    },
    onSuccess: () => {
      invalidate();
      setIsDialogOpen(false);
      toast({ title: "Saved", description: "Allowed IP saved successfully." });
    },
    onError: (err: Error) => {
      toast({ title: "Could not save", description: err.message, variant: "destructive" });
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async (item: AllowedIpRow) => {
      const res = await apiRequest("PATCH", `/api/settings/allowed-ips/${item.id}`, {
        is_active: !item.is_active,
      });
      if (!res.ok) {
        throw new Error(await readSettingsError(res, "Failed to update status."));
      }
      return res.json();
    },
    onSuccess: () => invalidate(),
    onError: (err: Error) => {
      toast({ title: "Could not update", description: err.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("DELETE", `/api/settings/allowed-ips/${id}`);
      if (!res.ok && res.status !== 204) {
        throw new Error(await readSettingsError(res, "Failed to delete allowed IP."));
      }
      return true;
    },
    onSuccess: () => {
      invalidate();
      setDeleteTarget(null);
      toast({ title: "Deleted", description: "Allowed IP removed." });
    },
    onError: (err: Error) => {
      toast({ title: "Could not delete", description: err.message, variant: "destructive" });
    },
  });

  const handleOpenAdd = () => {
    setEditingId(null);
    setFormData(emptyForm);
    setIsDialogOpen(true);
  };

  const handleOpenEdit = (item: AllowedIpRow) => {
    setEditingId(item.id);
    setFormData({
      ip_cidr: item.ip_cidr,
      description: item.description ?? "",
      is_active: item.is_active,
    });
    setIsDialogOpen(true);
  };

  const handleSave = () => {
    if (!formData.ip_cidr.trim()) {
      toast({ title: "Validation error", description: "Allowed IP is required.", variant: "destructive" });
      return;
    }
    saveMutation.mutate({
      id: editingId,
      data: {
        ip_cidr: formData.ip_cidr.trim(),
        description: formData.description.trim(),
        is_active: formData.is_active,
      },
    });
  };

  const rows = listQuery.data ?? [];

  const columns = useMemo((): DataTableColumn<AllowedIpRow>[] => {
    return [
      {
        id: "ip_cidr",
        header: "IP / CIDR",
        cell: (row) => (
          <Badge variant="brand" className="font-mono normal-case tracking-normal">
            {row.ip_cidr}
          </Badge>
        ),
        className: "whitespace-nowrap",
      },
      {
        id: "description",
        header: "Description",
        cell: (row) => (
          <span className="block max-w-md truncate text-zinc-700 dark:text-zinc-300" title={row.description ?? ""}>
            {row.description || "—"}
          </span>
        ),
      },
      {
        id: "is_active",
        header: "Active",
        cell: (row) => (
          <div className="flex items-center gap-2">
            <Switch
              checked={row.is_active}
              onCheckedChange={() => toggleMutation.mutate(row)}
              disabled={toggleMutation.isPending}
              data-testid={`switch-active-${row.id}`}
            />
            <Badge variant={row.is_active ? "success" : "neutral"} className="normal-case tracking-normal">
              {row.is_active ? "Active" : "Inactive"}
            </Badge>
          </div>
        ),
      },
      {
        id: "createdAt",
        header: "Created",
        cell: (row) => (
          <span className="whitespace-nowrap text-sm tabular-nums text-zinc-600 dark:text-zinc-400">
            {fmtDateTime(row.createdAt)}
          </span>
        ),
      },
      {
        id: "actions",
        header: "",
        headerClassName: "w-24 text-right",
        className: "text-right",
        cell: (row) => (
          <div className="flex justify-end gap-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
              aria-label="Edit IP"
              onClick={() => handleOpenEdit(row)}
              data-testid={`button-edit-${row.id}`}
            >
              <Pencil className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40"
              aria-label="Delete IP"
              onClick={() => setDeleteTarget(row)}
              data-testid={`button-delete-${row.id}`}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ),
      },
    ];
  }, [toggleMutation]);

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Allowed IP"
        title="DRM IP List"
        description="Manage IP addresses and CIDR blocks permitted for DRM access."
        actions={
          <Button type="button" variant="primary" size="sm" onClick={handleOpenAdd} data-testid="button-add-allowed-ip">
            <Plus className="mr-2 h-4 w-4" />
            Add IP
          </Button>
        }
      />

      {forbidden ? (
        <PageForbidden message="You do not have permission to manage allowed IPs." />
      ) : listQuery.isError && !forbidden ? (
        <PageError message={listQuery.error?.message ?? "Could not load allowed IPs."} onRetry={() => listQuery.refetch()} />
      ) : (
        <DrmSection
          title="Allowlist"
          description={`${rows.length} entr${rows.length === 1 ? "y" : "ies"} configured.`}
        >
          <DataTable
            caption="DRM allowed IP and CIDR list"
            columns={columns}
            rows={rows}
            rowKey={(row) => row.id}
            loading={listQuery.isLoading}
            emptyMessage="No allowed IPs configured yet."
          />
        </DrmSection>
      )}

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className={ipDialogClass}>
          <DialogHeader className="border-b border-zinc-200 px-6 py-4 dark:border-zinc-800">
            <DialogTitle className="text-zinc-900 dark:text-zinc-100">
              {editingId ? "Edit DRM IP" : "Add DRM IP"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 px-6 py-4">
            <Field id="ip-cidr" label="Allowed IP / CIDR *" hint="e.g. 203.0.113.5 or 192.168.1.0/24">
              <Input
                id="ip-cidr"
                placeholder="203.0.113.5 or 192.168.1.0/24"
                value={formData.ip_cidr}
                onChange={(e) => setFormData({ ...formData, ip_cidr: e.target.value })}
                className={drmFieldClass}
                data-testid="input-ip-cidr"
              />
            </Field>
            <Field id="ip-desc" label="Description">
              <Input
                id="ip-desc"
                placeholder="e.g. Gulberg office"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className={drmFieldClass}
                data-testid="input-description"
              />
            </Field>
            <div className="flex items-center gap-3">
              <Switch
                checked={formData.is_active}
                onCheckedChange={(v) => setFormData({ ...formData, is_active: v })}
                data-testid="switch-form-active"
              />
              <Label className="text-sm text-zinc-700 dark:text-zinc-300">
                {formData.is_active ? "Active" : "Inactive"}
              </Label>
            </div>
          </div>
          <DialogFooter className="gap-2 border-t border-zinc-200 px-6 py-4 dark:border-zinc-800 sm:justify-end">
            <LegacyButton variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancel
            </LegacyButton>
            <LegacyButton
              className="bg-emerald-600 text-white hover:bg-emerald-700"
              onClick={handleSave}
              disabled={saveMutation.isPending}
              data-testid="button-save-ip"
            >
              <Save className="mr-2 h-4 w-4" />
              {saveMutation.isPending ? "Saving…" : "Save IP"}
            </LegacyButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete allowed IP?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes <span className="font-semibold">{deleteTarget?.ip_cidr}</span>
              {deleteTarget?.description ? ` (${deleteTarget.description})` : ""} from the DRM allow-list.
              Access from this IP/CIDR will no longer be permitted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteTarget) deleteMutation.mutate(deleteTarget.id);
              }}
              disabled={deleteMutation.isPending}
              className="bg-red-600 hover:bg-red-700"
              data-testid="button-confirm-delete-ip"
            >
              {deleteMutation.isPending ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
