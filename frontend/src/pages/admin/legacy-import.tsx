// Admin → Old Data Import. Upload a newer MySQL dump of the old DRM (it keeps running
// after the 2026-11-04 snapshot); the server compares it with the archived old data and,
// after the admin reviews the report, inserts new rows and updates changed ones.
// Backend: backend/src/server/routes/legacy-import-routes.ts
import { useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequestJson, getAuthHeader } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DatabaseBackup, FileUp, Loader2, RotateCcw, Search, Trash2, Upload, CheckCircle2, AlertTriangle } from "lucide-react";

const BASE = "/api/admin/legacy-import";
const CHUNK = 8 * 1024 * 1024;
const BUSY = ["uploading", "checking", "applying", "rolling_back"];

type Totals = {
  dumpRows?: number; new?: number; changed?: number; same?: number;
  duplicateInFile?: number; onlyInArchive?: number; skippedRows?: number;
  restored?: number; removed?: number;
};
type Run = {
  id: string; fileName: string; fileSize: string | number; status: string; progress: string | null;
  error: string | null; createdAt: string; checkedAt: string | null; appliedAt: string | null;
  rolledBackAt: string | null; totals: Totals | null; reportMode: string | null;
  createdByName: string | null; appliedByName: string | null; hasChanges?: boolean;
};
type ModernModule = {
  module?: string; label?: string; table?: string; newInArchive?: number; inserted?: number; insertedPrivate?: number;
  linkedToExisting?: number; rowsInArchive?: number; customersUpdated?: number;
  rejected?: Record<string, number>; changedInArchive?: number; updatedRows?: number;
  updatedFields?: Record<string, number>; conflicts?: number;
  conflictSamples?: { legacyId: string; field: string; oldDrm_before: string | null; oldDrm_now: string | null; newApp: string | null }[];
  possibleDuplicates?: { legacyId: string; company: string }[];
  restoredRows?: number; keptNewerEdits?: number; removedRows?: number;
};
type TableReport = {
  table: string; dumpRows: number; archiveRowsBefore?: number; new: number; changed: number; same: number;
  duplicateInFile: number; onlyInArchive: number; skippedRows?: number;
  newSample?: string[]; changedSample?: string[]; changedColumns?: Record<string, number>;
  restored?: number; removed?: number;
};
type RunDetail = Run & {
  report: {
    mode: string; tables: TableReport[]; totals: Totals; unknownTables?: Record<string, number>; warnings?: string[];
    modernSync?: ModernModule[]; modernRollback?: ModernModule[];
  } | null;
};

const STATUS: Record<string, { label: string; cls: string }> = {
  uploading: { label: "Uploading", cls: "bg-sky-100 text-sky-800" },
  uploaded: { label: "Uploaded", cls: "bg-slate-100 text-slate-700" },
  checking: { label: "Checking", cls: "bg-sky-100 text-sky-800" },
  checked: { label: "Ready to import", cls: "bg-amber-100 text-amber-800" },
  applying: { label: "Importing", cls: "bg-sky-100 text-sky-800" },
  applied: { label: "Imported", cls: "bg-emerald-100 text-emerald-800" },
  rolling_back: { label: "Rolling back", cls: "bg-sky-100 text-sky-800" },
  rolled_back: { label: "Rolled back", cls: "bg-slate-200 text-slate-700" },
  failed: { label: "Failed", cls: "bg-red-100 text-red-700" },
  discarded: { label: "Discarded", cls: "bg-slate-100 text-slate-500" },
};

const n = (v: unknown) => Number(v ?? 0).toLocaleString();
const mb = (v: unknown) => `${(Number(v ?? 0) / 1048576).toFixed(1)} MB`;
const when = (v: string | null) => (v ? new Date(v).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" }) : "—");

async function call(method: string, url: string, body?: unknown) {
  return apiRequestJson(method, url, body);
}

export default function LegacyImportPage() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [upload, setUpload] = useState<{ pct: number; name: string } | null>(null);
  const [viewId, setViewId] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<{ run: Run; action: "apply" | "rollback" | "discard" } | null>(null);

  const runsQuery = useQuery<Run[]>({
    queryKey: [`${BASE}/runs`],
    queryFn: () => call("GET", `${BASE}/runs`),
    refetchInterval: (q) => ((q.state.data ?? []).some((r) => BUSY.includes(r.status)) ? 3000 : false),
  });
  const runs = runsQuery.data ?? [];
  const anyBusy = runs.some((r) => BUSY.includes(r.status)) || !!upload;

  const actionMutation = useMutation({
    mutationFn: ({ id, action }: { id: string; action: string }) => call("POST", `${BASE}/runs/${id}/${action}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: [`${BASE}/runs`] }),
    onError: (e: any) => toast({ title: "Action failed", description: e?.message, variant: "destructive" }),
  });

  const startUpload = async () => {
    if (!file) return;
    try {
      setUpload({ pct: 0, name: file.name });
      const { id } = await call("POST", `${BASE}/uploads`, { fileName: file.name, fileSize: file.size });
      for (let offset = 0; offset < file.size; offset += CHUNK) {
        const blob = file.slice(offset, offset + CHUNK);
        let ok = false;
        for (let attempt = 0; attempt < 3 && !ok; attempt++) {
          const res = await fetch(`${BASE}/uploads/${id}/chunk?offset=${offset}`, {
            method: "PUT",
            headers: { ...getAuthHeader(), "Content-Type": "application/octet-stream" },
            credentials: "include",
            body: blob,
          });
          if (res.ok) ok = true;
          else if (attempt === 2) {
            const body = await res.json().catch(() => ({}));
            throw new Error(body?.error || `Upload failed (${res.status})`);
          }
        }
        setUpload({ pct: Math.min(100, Math.round(((offset + blob.size) / file.size) * 100)), name: file.name });
      }
      await call("POST", `${BASE}/uploads/${id}/complete`);
      toast({ title: "File uploaded", description: "Checking it against the old data now. Nothing is changed until you click Import." });
      setFile(null);
      if (fileRef.current) fileRef.current.value = "";
    } catch (e: any) {
      toast({ title: "Upload failed", description: e?.message, variant: "destructive" });
    } finally {
      setUpload(null);
      qc.invalidateQueries({ queryKey: [`${BASE}/runs`] });
    }
  };

  const latestAppliedId = useMemo(
    () => runs.filter((r) => r.status === "applied").sort((a, b) => String(b.appliedAt).localeCompare(String(a.appliedAt)))[0]?.id,
    [runs],
  );

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-center gap-2">
        <DatabaseBackup className="h-6 w-6 text-emerald-600" />
        <h1 className="text-xl font-bold text-slate-800 dark:text-zinc-200">Old Data Import</h1>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Upload a new dump of the old DRM</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <ol className="list-decimal space-y-1 pl-5 text-slate-600 dark:text-zinc-400">
            <li>Export the old DRM MySQL database (phpMyAdmin → Export → SQL) and upload the <b>.sql</b> file here.</li>
            <li>The server compares it with the old data already in the new system and shows a report: <b>new</b> rows, <b>changed</b> rows (e.g. payment status) and rows that are the same. Nothing is changed yet.</li>
            <li>Review the report, then click <b>Import</b>. New rows are added and changed rows are updated; the same rows are never added twice.</li>
            <li>The new system's copies are updated too: <b>Customers</b> (incl. Private pool owner and last follow-up), <b>Follow-ups</b>, <b>Attendance</b>, <b>Task logs / links</b> and <b>Invoices, payments, quotations</b>. A field edited in the new app is never overwritten — it is listed as a conflict.</li>
            <li>If something looks wrong, <b>Rollback</b> puts every row back exactly as it was before that import.</li>
          </ol>
          <div className="flex flex-wrap items-center gap-3">
            <input
              ref={fileRef}
              type="file"
              accept=".sql"
              className="block max-w-full text-sm file:mr-3 file:rounded file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-sm dark:file:bg-zinc-800"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              disabled={!!upload}
            />
            <Button onClick={startUpload} disabled={!file || anyBusy} className="bg-emerald-600 hover:bg-emerald-700">
              {upload ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
              Upload &amp; check
            </Button>
            {file && !upload && <span className="text-xs text-slate-500">{mb(file.size)}</span>}
          </div>
          {upload && (
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-slate-500">
                <span className="truncate">Uploading {upload.name}</span><span>{upload.pct}%</span>
              </div>
              <Progress value={upload.pct} />
              <p className="text-xs text-slate-500">Keep this page open until the upload finishes.</p>
            </div>
          )}
          {anyBusy && !upload && (
            <p className="text-xs text-amber-700">An import job is running. A new upload can start when it finishes.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Imports</CardTitle>
        </CardHeader>
        <CardContent className="px-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>File</TableHead>
                  <TableHead>Uploaded</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">New</TableHead>
                  <TableHead className="text-right">Changed</TableHead>
                  <TableHead className="text-right">Same</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {runsQuery.isLoading ? (
                  <TableRow><TableCell colSpan={7} className="py-8 text-center text-slate-500"><Loader2 className="mx-auto h-5 w-5 animate-spin" /></TableCell></TableRow>
                ) : runs.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="py-8 text-center text-slate-500">No imports yet.</TableCell></TableRow>
                ) : runs.map((r) => {
                  const st = STATUS[r.status] ?? { label: r.status, cls: "bg-slate-100" };
                  const busy = BUSY.includes(r.status);
                  const t = r.totals ?? {};
                  const isRollback = r.reportMode === "rollback";
                  return (
                    <TableRow key={r.id} className="text-[13px]">
                      <TableCell>
                        <div className="font-medium">{r.fileName}</div>
                        <div className="text-xs text-slate-500">{mb(r.fileSize)}{r.createdByName ? ` · ${r.createdByName}` : ""}</div>
                      </TableCell>
                      <TableCell className="whitespace-nowrap">{when(r.createdAt)}</TableCell>
                      <TableCell>
                        <Badge className={`${st.cls} font-semibold shadow-none`}>
                          {busy && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}{st.label}
                        </Badge>
                        {busy && r.progress && <div className="mt-1 max-w-[260px] text-xs text-slate-500">{r.progress}</div>}
                        {r.status === "failed" && r.error && <div className="mt-1 max-w-[320px] text-xs text-red-600">{r.error}</div>}
                        {r.status === "applied" && <div className="mt-1 text-xs text-slate-500">{when(r.appliedAt)}{r.appliedByName ? ` · ${r.appliedByName}` : ""}</div>}
                      </TableCell>
                      <TableCell className="text-right font-semibold text-emerald-700">{isRollback ? "—" : n(t.new)}</TableCell>
                      <TableCell className="text-right font-semibold text-amber-700">{isRollback ? "—" : n(t.changed)}</TableCell>
                      <TableCell className="text-right text-slate-500">{isRollback ? "—" : n(t.same)}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap justify-end gap-1">
                          {r.totals && (
                            <Button size="sm" variant="outline" className="h-8" onClick={() => setViewId(r.id)}>
                              <Search className="mr-1 h-3.5 w-3.5" />Report
                            </Button>
                          )}
                          {r.status === "checked" && (
                            <Button size="sm" className="h-8 bg-emerald-600 hover:bg-emerald-700" disabled={anyBusy}
                              onClick={() => setConfirm({ run: r, action: "apply" })}>
                              <CheckCircle2 className="mr-1 h-3.5 w-3.5" />Import
                            </Button>
                          )}
                          {["failed", "rolled_back", "uploaded"].includes(r.status) && (
                            <Button size="sm" variant="outline" className="h-8" disabled={anyBusy}
                              onClick={() => actionMutation.mutate({ id: r.id, action: "check" })}>
                              <FileUp className="mr-1 h-3.5 w-3.5" />Check again
                            </Button>
                          )}
                          {((r.status === "applied" && r.id === latestAppliedId) || (r.status === "failed" && r.hasChanges)) && (
                            <Button size="sm" variant="outline" className="h-8 border-red-300 text-red-700" disabled={anyBusy}
                              onClick={() => setConfirm({ run: r, action: "rollback" })}>
                              <RotateCcw className="mr-1 h-3.5 w-3.5" />Rollback
                            </Button>
                          )}
                          {!busy && !["applied", "discarded"].includes(r.status) && (
                            <Button size="sm" variant="ghost" className="h-8 text-slate-500" title="Delete the uploaded file"
                              onClick={() => setConfirm({ run: r, action: "discard" })}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {viewId && <ReportDialog id={viewId} onClose={() => setViewId(null)} />}

      <AlertDialog open={!!confirm} onOpenChange={(o) => !o && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirm?.action === "apply" ? "Import this data?" : confirm?.action === "rollback" ? "Roll back this import?" : "Delete this file?"}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm">
                {confirm?.action === "apply" && (
                  <>
                    <p><b>{n(confirm.run.totals?.new)}</b> new rows will be added and <b>{n(confirm.run.totals?.changed)}</b> changed rows will be updated. {n(confirm.run.totals?.same)} rows are the same and will be skipped.</p>
                    <p>Every updated row keeps its previous version, so this can be rolled back.</p>
                  </>
                )}
                {confirm?.action === "rollback" && (
                  <p>Rows added by this import are removed and every updated row goes back to its previous values.</p>
                )}
                {confirm?.action === "discard" && <p>The uploaded file {confirm.run.fileName} is deleted from the server. Nothing was imported from it.</p>}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className={confirm?.action === "apply" ? "bg-emerald-600 hover:bg-emerald-700" : "bg-red-600 hover:bg-red-700"}
              onClick={() => { if (confirm) actionMutation.mutate({ id: confirm.run.id, action: confirm.action }); setConfirm(null); }}
            >
              {confirm?.action === "apply" ? "Import" : confirm?.action === "rollback" ? "Rollback" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function ReportDialog({ id, onClose }: { id: string; onClose: () => void }) {
  const [onlyChanges, setOnlyChanges] = useState(true);
  const { data, isLoading } = useQuery<RunDetail>({
    queryKey: [`${BASE}/runs`, id],
    queryFn: () => call("GET", `${BASE}/runs/${id}`),
  });
  const rep = data?.report;
  const rollback = rep?.mode === "rollback";
  const tables = (rep?.tables ?? []).filter((t) =>
    !onlyChanges || rollback || Number(t.new) > 0 || Number(t.changed) > 0 || Number(t.duplicateInFile) > 0 || Number(t.skippedRows) > 0);
  const tot = rep?.totals ?? {};
  const unknown = Object.entries(rep?.unknownTables ?? {});
  const cards = rollback
    ? [["Rows restored", tot.restored, "text-amber-700"], ["Rows removed", tot.removed, "text-red-700"]]
    : [
        ["New", tot.new, "text-emerald-700"], ["Changed", tot.changed, "text-amber-700"], ["Same (skipped)", tot.same, "text-slate-600"],
        ["Duplicate in file (skipped)", tot.duplicateInFile, "text-red-700"], ["Only in new system's copy", tot.onlyInArchive, "text-slate-600"],
      ];
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-5xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{data?.fileName ?? "Report"} — {rep?.mode === "apply" ? "import result" : rollback ? "rollback result" : "check report"}</DialogTitle>
        </DialogHeader>
        {isLoading || !rep ? (
          <div className="py-10 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin" /></div>
        ) : (
          <div className="space-y-4 text-sm">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
              {cards.map(([label, v, cls]) => (
                <div key={String(label)} className="rounded border p-3">
                  <div className="text-xs text-slate-500">{label}</div>
                  <div className={`text-lg font-bold ${cls}`}>{n(v)}</div>
                </div>
              ))}
            </div>
            {!rollback && (
              <p className="text-xs text-slate-500">
                "Only in new system's copy" = rows the new system already has that are not in this file (deleted in old DRM, or a partial export). They are kept, never deleted.
              </p>
            )}
            {(rep.modernSync?.length ?? 0) > 0 && <ModernSyncSection modules={rep.modernSync!} />}
            {(rep.modernRollback?.length ?? 0) > 0 && (
              <div className="rounded border p-3 text-xs">
                <div className="mb-1 font-semibold">New system rolled back</div>
                {rep.modernRollback!.map((m, i) => (
                  <div key={i}>{m.table}: {n(m.removedRows)} removed, {n(m.restoredRows)} restored{Number(m.keptNewerEdits) ? `, ${n(m.keptNewerEdits)} fields kept (edited after the import)` : ""}</div>
                ))}
              </div>
            )}
            {(rep.warnings?.length ?? 0) > 0 && (
              <div className="rounded border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
                <div className="mb-1 flex items-center gap-1 font-semibold"><AlertTriangle className="h-4 w-4" />Warnings</div>
                <ul className="list-disc pl-5">{rep.warnings!.map((w, i) => <li key={i}>{w}</li>)}</ul>
              </div>
            )}
            {unknown.length > 0 && (
              <div className="rounded border p-3 text-xs text-slate-600">
                <b>Tables in the file that the new system does not keep</b> (skipped): {unknown.map(([t, c]) => `${t} (${n(c)})`).join(", ")}
              </div>
            )}
            {!rollback && (
              <label className="flex items-center gap-2 text-xs">
                <Switch checked={onlyChanges} onCheckedChange={setOnlyChanges} /> Only tables with new or changed rows
              </label>
            )}
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Table</TableHead>
                    {rollback ? (
                      <><TableHead className="text-right">Restored</TableHead><TableHead className="text-right">Removed</TableHead></>
                    ) : (
                      <>
                        <TableHead className="text-right">In file</TableHead>
                        <TableHead className="text-right">New</TableHead>
                        <TableHead className="text-right">Changed</TableHead>
                        <TableHead className="text-right">Same</TableHead>
                        <TableHead className="text-right">Dup.</TableHead>
                        <TableHead>What changed</TableHead>
                        <TableHead>Example IDs</TableHead>
                      </>
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tables.length === 0 ? (
                    <TableRow><TableCell colSpan={8} className="py-6 text-center text-slate-500">Nothing new or changed — the new system already has all of this data.</TableCell></TableRow>
                  ) : tables.map((t) => (
                    <TableRow key={t.table} className="text-[12px] align-top">
                      <TableCell className="font-mono">{t.table}</TableCell>
                      {rollback ? (
                        <><TableCell className="text-right">{n(t.restored)}</TableCell><TableCell className="text-right">{n(t.removed)}</TableCell></>
                      ) : (
                        <>
                          <TableCell className="text-right">{n(t.dumpRows)}</TableCell>
                          <TableCell className="text-right font-semibold text-emerald-700">{n(t.new)}</TableCell>
                          <TableCell className="text-right font-semibold text-amber-700">{n(t.changed)}</TableCell>
                          <TableCell className="text-right text-slate-500">{n(t.same)}</TableCell>
                          <TableCell className="text-right text-red-700">{Number(t.duplicateInFile) ? n(t.duplicateInFile) : ""}</TableCell>
                          <TableCell>
                            <div className="flex max-w-[260px] flex-wrap gap-1">
                              {Object.entries(t.changedColumns ?? {}).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([c, k]) => (
                                <span key={c} className="rounded bg-amber-50 px-1.5 py-0.5 text-[11px] text-amber-800 dark:bg-amber-950/40 dark:text-amber-200">{c} ({n(k)})</span>
                              ))}
                            </div>
                          </TableCell>
                          <TableCell className="max-w-[200px] text-[11px] text-slate-500">
                            {(t.newSample?.length ?? 0) > 0 && <div>new: {t.newSample!.join(", ")}</div>}
                            {(t.changedSample?.length ?? 0) > 0 && <div>changed: {t.changedSample!.join(", ")}</div>}
                          </TableCell>
                        </>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

const MODULE_LABEL: Record<string, string> = { customers: "Customers", lastFollowup: "Last follow-up (customer)", followUps: "Follow-ups", privatePool: "Back to Private pool (new follow-up in old DRM)" };

function ModernSyncSection({ modules }: { modules: ModernModule[] }) {
  const conflicts = modules.flatMap((m) => (m.conflictSamples ?? []).map((c) => ({ ...c, module: m.label ?? MODULE_LABEL[m.module ?? ""] ?? m.module })));
  const dups = modules.flatMap((m) => m.possibleDuplicates ?? []);
  return (
    <div className="space-y-2 rounded border p-3">
      <div className="text-sm font-semibold">New system update</div>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Module</TableHead>
              <TableHead className="text-right">Added</TableHead>
              <TableHead className="text-right">Updated</TableHead>
              <TableHead className="text-right">Conflicts</TableHead>
              <TableHead>Details</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {modules.map((m) => (
              <TableRow key={m.module} className="text-[12px] align-top">
                <TableCell className="font-medium">{m.label ?? MODULE_LABEL[m.module ?? ""] ?? m.module}</TableCell>
                <TableCell className="text-right text-emerald-700">{["lastFollowup", "privatePool"].includes(m.module ?? "") ? "—" : n(m.inserted)}</TableCell>
                <TableCell className="text-right text-amber-700">{n(["lastFollowup", "privatePool"].includes(m.module ?? "") ? m.customersUpdated : m.updatedRows)}</TableCell>
                <TableCell className="text-right text-red-700">{["lastFollowup", "privatePool"].includes(m.module ?? "") ? "—" : n(m.conflicts)}</TableCell>
                <TableCell className="text-[11px] text-slate-500">
                  {Number(m.insertedPrivate) > 0 && <div>{n(m.insertedPrivate)} added to the assignee's Private pool</div>}
                  {Number(m.linkedToExisting) > 0 && <div>{n(m.linkedToExisting)} matched a customer created in the new app (linked, not duplicated)</div>}
                  {Object.keys(m.updatedFields ?? {}).length > 0 && <div>changed: {Object.entries(m.updatedFields!).map(([f, k]) => `${f} (${n(k)})`).join(", ")}</div>}
                  {Object.keys(m.rejected ?? {}).length > 0 && <div className="text-red-600">not copied: {Object.entries(m.rejected!).map(([r, k]) => `${r.replace(/_/g, " ")} (${n(k)})`).join(", ")}</div>}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      {conflicts.length > 0 && (
        <div className="text-xs">
          <div className="mb-1 font-semibold text-red-700">Conflicts — changed in old DRM but also edited in the new app (new-app value kept)</div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow><TableHead>Module</TableHead><TableHead>Old ID</TableHead><TableHead>Field</TableHead><TableHead>Old DRM before</TableHead><TableHead>Old DRM now</TableHead><TableHead>New app (kept)</TableHead></TableRow>
              </TableHeader>
              <TableBody>
                {conflicts.map((c, i) => (
                  <TableRow key={i} className="text-[11px]">
                    <TableCell>{c.module}</TableCell><TableCell>{c.legacyId}</TableCell><TableCell className="font-mono">{c.field}</TableCell>
                    <TableCell className="max-w-[180px] truncate">{c.oldDrm_before ?? "—"}</TableCell>
                    <TableCell className="max-w-[180px] truncate">{c.oldDrm_now ?? "—"}</TableCell>
                    <TableCell className="max-w-[180px] truncate font-semibold">{c.newApp ?? "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
      {dups.length > 0 && (
        <div className="text-xs text-amber-800">
          <b>Possible duplicates</b> (same company name as a customer created in the new app — copied, please review):{" "}
          {dups.map((d) => `${d.company} (#${d.legacyId})`).join(", ")}
        </div>
      )}
    </div>
  );
}
