"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/legacy/select";
import { useToast } from "@/lib/hooks/use-legacy-toast";
import { apiRequestJson } from "@/lib/query/query-client";
import {
  DrmFormActions,
  DhSearchInput,
  DhSectionToolbar,
  DrmSection,
  dhDialogShellClass,
  dhSelectTriggerClass,
  drmFieldClass,
} from "@/modules/domain-hosting/domain-hosting-ui";

const BACKUP_TYPES = ["Full", "Database", "Files"] as const;

function extractErrorMessage(err: unknown, fallback: string): string {
  const raw = String((err as { message?: string })?.message ?? "");
  const idx = raw.indexOf(":");
  const body = idx >= 0 ? raw.slice(idx + 1).trim() : raw;
  try {
    const parsed = JSON.parse(body) as { error?: string };
    if (parsed?.error) return String(parsed.error);
  } catch {
    /* not JSON */
  }
  return body || fallback;
}

type BackupRow = {
  id: string;
  domainId: string;
  backupType?: string;
  backupUrl?: string | null;
  details?: string | null;
  backupDate?: string;
  createdAt?: string;
};

type DomainRow = { id: string; domainName: string };

export function ItBackupView() {
  const [searchTerm, setSearchTerm] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({
    domainId: "",
    backupType: "Full" as string,
    backupUrl: "",
    details: "",
  });
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: backups = [], isLoading } = useQuery<BackupRow[]>({
    queryKey: ["/api/it/backups"],
  });
  const { data: domains = [] } = useQuery<DomainRow[]>({
    queryKey: ["/api/it/domains"],
  });

  const domainName = (id: string) => domains.find((d) => d.id === id)?.domainName ?? "";

  const filtered = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    const list = Array.isArray(backups) ? backups : [];
    if (!q) return list;
    return list.filter((b) => domainName(b.domainId).toLowerCase().includes(q));
  }, [backups, domains, searchTerm]);

  const createBackup = useMutation({
    mutationFn: (body: Record<string, unknown>) => apiRequestJson("POST", "/api/it/backups", body),
    onSuccess: () => {
      toast({ title: "Backup record added" });
      void queryClient.invalidateQueries({ queryKey: ["/api/it/backups"] });
      setDialogOpen(false);
      setForm({ domainId: "", backupType: "Full", backupUrl: "", details: "" });
    },
    onError: (err: unknown) =>
      toast({ title: extractErrorMessage(err, "Failed to add backup"), variant: "destructive" }),
  });

  const deleteBackup = useMutation({
    mutationFn: (id: string) => apiRequestJson("DELETE", `/api/it/backups/${id}`),
    onSuccess: () => {
      toast({ title: "Backup record deleted" });
      void queryClient.invalidateQueries({ queryKey: ["/api/it/backups"] });
    },
    onError: (err: unknown) =>
      toast({ title: extractErrorMessage(err, "Failed to delete backup"), variant: "destructive" }),
  });

  const columns: DataTableColumn<BackupRow>[] = [
    {
      id: "no",
      header: "#",
      cell: (row) => {
        const idx = filtered.findIndex((r) => r.id === row.id);
        return <span className="tabular-nums text-zinc-500">{idx >= 0 ? idx + 1 : "—"}</span>;
      },
      className: "w-12",
    },
    {
      id: "domain",
      header: "Domain",
      cell: (row) => <span className="font-medium text-zinc-900 dark:text-zinc-100">{domainName(row.domainId) || "N/A"}</span>,
    },
    {
      id: "type",
      header: "Type",
      cell: (row) => (
        <Badge variant={row.backupType === "Full" ? "brand" : "warning"} className="normal-case">
          {row.backupType || "N/A"}
        </Badge>
      ),
    },
    {
      id: "url",
      header: "Storage URL",
      cell: (row) => (
        <span className="font-mono text-xs text-emerald-700 dark:text-emerald-400">{row.backupUrl || "—"}</span>
      ),
    },
    {
      id: "details",
      header: "Notes",
      cell: (row) => (
        <span className="line-clamp-2 max-w-[200px] text-xs text-zinc-500 dark:text-zinc-400">{row.details || "—"}</span>
      ),
    },
    {
      id: "date",
      header: "Date",
      cell: (row) => {
        const d = row.backupDate || row.createdAt;
        return <span className="text-sm text-zinc-600 dark:text-zinc-300">{d ? new Date(d).toLocaleDateString() : "—"}</span>;
      },
    },
    {
      id: "actions",
      header: "",
      className: "w-14 text-right",
      cell: (row) => (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="text-red-600 hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-950/40"
          onClick={() => setDeleteId(row.id)}
          disabled={deleteBackup.isPending}
          aria-label="Delete backup"
        >
          {deleteBackup.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
        </Button>
      ),
    },
  ];

  const handleSave = () => {
    if (!form.domainId) {
      toast({ title: "Please select a domain", variant: "destructive" });
      return;
    }
    createBackup.mutate({
      domainId: form.domainId,
      backupType: form.backupType,
      backupUrl: form.backupUrl.trim() || null,
      details: form.details.trim() || null,
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  return (
    <>
      <DrmSection
        title="Backup records"
        description={`${filtered.length} record${filtered.length === 1 ? "" : "s"}`}
        actions={
          <Button type="button" variant="primary" size="sm" onClick={() => setDialogOpen(true)}>
            <Plus className="h-4 w-4" />
            Add backup
          </Button>
        }
      >
        <DhSectionToolbar
          leading={
            <DhSearchInput
              id="dh-backup-search"
              value={searchTerm}
              onChange={setSearchTerm}
              placeholder="Filter by domain…"
            />
          }
        />
        <DataTable
          columns={columns}
          rows={filtered}
          rowKey={(row) => row.id}
          emptyMessage="No backup records yet."
        />
      </DrmSection>

      <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) setForm({ domainId: "", backupType: "Full", backupUrl: "", details: "" }); }}>
        <DialogContent className={dhDialogShellClass}>
          <DialogHeader className="border-b border-zinc-200 px-6 py-4 dark:border-zinc-800">
            <DialogTitle className="text-base font-semibold text-zinc-900 dark:text-zinc-100">Add backup record</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 px-6 py-5 sm:grid-cols-2">
            <Field id="dh-backup-domain" label="Domain">
              <Select value={form.domainId} onValueChange={(v) => setForm((f) => ({ ...f, domainId: v }))}>
                <SelectTrigger className={dhSelectTriggerClass}>
                  <SelectValue placeholder="Select domain…" />
                </SelectTrigger>
                <SelectContent>
                  {domains.length === 0 && <div className="px-3 py-2 text-xs text-zinc-400">No domains available</div>}
                  {domains.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.domainName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field id="dh-backup-type" label="Backup type">
              <Select value={form.backupType} onValueChange={(v) => setForm((f) => ({ ...f, backupType: v }))}>
                <SelectTrigger className={dhSelectTriggerClass}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {BACKUP_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field id="dh-backup-url" label="Destination / URL" className="sm:col-span-2">
              <Input
                className={drmFieldClass}
                placeholder="Storage location or URL"
                value={form.backupUrl}
                onChange={(e) => setForm((f) => ({ ...f, backupUrl: e.target.value }))}
              />
            </Field>
            <Field id="dh-backup-notes" label="Notes" className="sm:col-span-2">
              <Textarea
                className={drmFieldClass}
                rows={4}
                value={form.details}
                onChange={(e) => setForm((f) => ({ ...f, details: e.target.value }))}
                placeholder="Backup details…"
              />
            </Field>
          </div>
          <DialogFooter className="border-t border-zinc-200 bg-zinc-50 px-6 py-4 dark:border-zinc-800 dark:bg-zinc-900/50">
            <DrmFormActions>
              <Button type="button" variant="secondary" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="button" variant="primary" onClick={handleSave} disabled={createBackup.isPending}>
                {createBackup.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                Save
              </Button>
            </DrmFormActions>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this backup record?</AlertDialogTitle>
            <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={() => {
                if (deleteId) {
                  deleteBackup.mutate(deleteId);
                  setDeleteId(null);
                }
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
