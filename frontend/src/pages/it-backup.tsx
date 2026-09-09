import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequestJson } from "@/lib/queryClient";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Loader2, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";

// Mutation errors thrown by apiRequestJson look like: `409: {"error":"..."}`.
function extractErrorMessage(err: any, fallback: string): string {
  const raw = String(err?.message ?? "");
  const idx = raw.indexOf(":");
  const body = idx >= 0 ? raw.slice(idx + 1).trim() : raw;
  try {
    const parsed = JSON.parse(body);
    if (parsed?.error) return String(parsed.error);
  } catch {
    /* not JSON */
  }
  return body || fallback;
}

const BACKUP_TYPES = ["Full", "Database", "Files"];

interface BackupForm {
  domainId: string;
  backupType: string;
  backupUrl: string;
  details: string;
}

const EMPTY_BACKUP_FORM: BackupForm = {
  domainId: "",
  backupType: "Full",
  backupUrl: "",
  details: "",
};

export default function ItBackup() {
  const [searchTerm, setSearchTerm] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<BackupForm>(EMPTY_BACKUP_FORM);
  const { toast } = useToast();

  const { data: backups = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/it/backups"],
  });
  const { data: domains = [] } = useQuery<any[]>({
    queryKey: ["/api/it/domains"],
  });

  const domainsList = Array.isArray(domains) ? domains : [];
  const domainName = (id: string) =>
    domainsList.find((d) => d.id === id)?.domainName || "";

  const backupsList = Array.isArray(backups) ? backups : [];
  const filteredBackups = backupsList.filter((b) =>
    domainName(b.domainId).toLowerCase().includes(searchTerm.toLowerCase())
  );

  const createBackup = useMutation({
    mutationFn: async (body: Record<string, any>) =>
      apiRequestJson("POST", "/api/it/backups", body),
    onSuccess: () => {
      toast({ title: "Backup record added" });
      queryClient.invalidateQueries({ queryKey: ["/api/it/backups"] });
      setDialogOpen(false);
      setForm(EMPTY_BACKUP_FORM);
    },
    onError: (err: any) =>
      toast({ title: extractErrorMessage(err, "Failed to add backup"), variant: "destructive" }),
  });

  const deleteBackupMutation = useMutation({
    mutationFn: async (id: string) =>
      apiRequestJson("DELETE", `/api/it/backups/${id}`),
    onSuccess: () => {
      toast({ title: "Backup record deleted" });
      queryClient.invalidateQueries({ queryKey: ["/api/it/backups"] });
    },
    onError: (err: any) =>
      toast({ title: extractErrorMessage(err, "Failed to delete backup"), variant: "destructive" }),
  });

  const [deleteConfirmBackupId, setDeleteConfirmBackupId] = useState<string | null>(null);

  const handleSave = () => {
    if (!form.domainId) {
      toast({ title: "Please select a domain", variant: "destructive" });
      return;
    }
    if (!form.backupType) {
      toast({ title: "Please choose a backup type", variant: "destructive" });
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
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-6 bg-slate-50/50 dark:bg-zinc-900 min-h-screen dark:bg-zinc-950">
      <h1 className="text-xl font-bold tracking-tight text-slate-800 uppercase dark:text-zinc-100">Domain Backup</h1>

      <Card className="border-none shadow-sm overflow-hidden bg-white dark:bg-zinc-900">
        <CardContent className="p-6 dark:bg-zinc-900">
          <div className="mb-6">
            <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) setForm(EMPTY_BACKUP_FORM); }}>
              <DialogTrigger asChild>
                <Button className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold flex items-center gap-2 h-10 px-6 transition-all shadow-md hover:shadow-lg">
                  <Plus className="h-4 w-4" /> Add New Backup
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-xl p-0 gap-0 overflow-hidden border-none shadow-2xl">
                <DialogHeader className="p-6 border-b bg-white dark:bg-zinc-900 flex flex-row items-center justify-between space-y-0">
                  <DialogTitle className="text-xl font-bold text-slate-700 uppercase tracking-tight dark:text-zinc-400">Add Backup Record</DialogTitle>
                </DialogHeader>
                <div className="p-6 space-y-6 bg-white dark:bg-zinc-900">
                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-wider dark:text-zinc-400">Domain:</label>
                      <Select value={form.domainId} onValueChange={(v) => setForm((f) => ({ ...f, domainId: v }))}>
                        <SelectTrigger className="h-11 bg-slate-50/50 dark:bg-zinc-900 border-slate-200 dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-100">
                          <SelectValue placeholder="Select domain..." />
                        </SelectTrigger>
                        <SelectContent>
                          {domainsList.length === 0 && (
                            <div className="px-3 py-2 text-xs text-slate-400">No domains available</div>
                          )}
                          {domainsList.map((d) => (
                            <SelectItem key={d.id} value={d.id}>{d.domainName}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-wider dark:text-zinc-400">Backup Type:</label>
                      <Select value={form.backupType} onValueChange={(v) => setForm((f) => ({ ...f, backupType: v }))}>
                        <SelectTrigger className="h-11 bg-slate-50/50 dark:bg-zinc-900 border-slate-200 dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-100">
                          <SelectValue placeholder="Choose..." />
                        </SelectTrigger>
                        <SelectContent>
                          {BACKUP_TYPES.map((t) => (
                            <SelectItem key={t} value={t}>{t}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider dark:text-zinc-400">Backup Destination / URL:</label>
                    <Input
                      placeholder="Storage location or URL"
                      value={form.backupUrl}
                      onChange={(e) => setForm((f) => ({ ...f, backupUrl: e.target.value }))}
                      className="h-11 bg-slate-50/50 dark:bg-zinc-900 border-slate-200 dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-100"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider dark:text-zinc-400">Detail / Notes:</label>
                    <Textarea
                      value={form.details}
                      onChange={(e) => setForm((f) => ({ ...f, details: e.target.value }))}
                      className="min-h-[120px] bg-slate-50/50 dark:bg-zinc-900 border-slate-200 resize-none dark:border-zinc-800"
                      placeholder="Enter backup details..."
                    />
                  </div>
                </div>
                <DialogFooter className="p-6 bg-slate-50/50 dark:bg-zinc-900 flex flex-row justify-end gap-3 border-t">
                  <Button variant="ghost" onClick={() => setDialogOpen(false)} className="bg-white dark:bg-zinc-900 border text-slate-700 hover:bg-slate-100 px-8 h-11 font-bold dark:hover:bg-zinc-800 dark:text-zinc-400">Close</Button>
                  <Button onClick={handleSave} disabled={createBackup.isPending} className="bg-emerald-600 hover:bg-emerald-700 text-white px-8 h-11 font-bold shadow-sm">
                    {createBackup.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                    Save Backup
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4 py-4 border-t">
            <span className="text-sm text-slate-500 font-medium dark:text-zinc-400">Showing {filteredBackups.length} entries</span>
            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-500 font-medium dark:text-zinc-400">Search:</span>
              <Input
                className="h-9 w-64 bg-slate-50/50 dark:bg-zinc-900 border-slate-200 dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-100"
                placeholder="Find by domain..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>

          <div className="rounded-xl border border-slate-100 overflow-hidden shadow-sm dark:border-zinc-800">
            <Table>
              <TableHeader className="bg-slate-50/80 dark:bg-zinc-900/80">
                <TableRow>
                  <TableHead className="font-bold text-slate-700 w-16 dark:text-zinc-400">No#</TableHead>
                  <TableHead className="font-bold text-slate-700 dark:text-zinc-400">Domain Name</TableHead>
                  <TableHead className="font-bold text-slate-700 dark:text-zinc-400">Backup Type</TableHead>
                  <TableHead className="font-bold text-slate-700 dark:text-zinc-400">Storage URL</TableHead>
                  <TableHead className="font-bold text-slate-700 dark:text-zinc-400">Description</TableHead>
                  <TableHead className="font-bold text-slate-700 dark:text-zinc-400">Backup Date</TableHead>
                  <TableHead className="font-bold text-slate-700 dark:text-zinc-400 text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredBackups.map((item: any, idx: number) => (
                  <TableRow key={item.id} className="hover:bg-slate-50/50 dark:hover:bg-zinc-800 transition-colors border-slate-50 dark:border-zinc-800">
                    <TableCell className="text-slate-500 font-bold dark:text-zinc-400">{idx + 1}</TableCell>
                    <TableCell className="font-bold text-slate-800 dark:text-zinc-100">{domainName(item.domainId) || "N/A"}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`${item.backupType === 'Full' ? 'bg-blue-50 text-blue-700 border-blue-100' : 'bg-orange-50 text-orange-700 border-orange-100'} font-bold`}>
                        {item.backupType || "N/A"}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-xs text-emerald-600 font-semibold">{item.backupUrl || "N/A"}</TableCell>
                    <TableCell className="text-slate-500 text-xs italic max-w-[200px] truncate dark:text-zinc-400">{item.details || "No details provided"}</TableCell>
                    <TableCell className="text-slate-600 font-medium text-sm dark:text-zinc-300">
                      {item.backupDate ? new Date(item.backupDate).toLocaleDateString() : (item.createdAt ? new Date(item.createdAt).toLocaleDateString() : "N/A")}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-50 rounded-full"
                        onClick={() => setDeleteConfirmBackupId(item.id)}
                        disabled={deleteBackupMutation.isPending}
                        aria-label="Delete backup"
                      >
                        {deleteBackupMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {filteredBackups.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-16 text-slate-400">
                      <p className="font-medium">No backup records available</p>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={!!deleteConfirmBackupId} onOpenChange={(open) => !open && setDeleteConfirmBackupId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure you want to delete this backup record?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the backup record and cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={() => {
                if (deleteConfirmBackupId) {
                  deleteBackupMutation.mutate(deleteConfirmBackupId);
                  setDeleteConfirmBackupId(null);
                }
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
