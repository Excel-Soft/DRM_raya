import { useState, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getAuthHeader, queryClient } from "@/lib/queryClient";
import { downloadAuthedFile } from "@/lib/download";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Upload, Download, AlertTriangle, CheckCircle2 } from "lucide-react";

type Step = "upload" | "preview" | "result";

const TARGET_FIELDS: { key: string; label: string; required?: boolean }[] = [
  { key: "companyName", label: "Company Name", required: true },
  { key: "personName", label: "Contact Person" },
  { key: "phone", label: "Phone" },
  { key: "email", label: "Email" },
  { key: "city", label: "City" },
  { key: "country", label: "Country" },
  { key: "source", label: "Source" },
  { key: "serviceInterest", label: "Service Interest" },
  { key: "notes", label: "Notes" },
  { key: "assignedUser", label: "Assigned User" },
];

interface PreviewRow {
  rowNumber: number;
  data: Record<string, any>;
  raw: Record<string, any>;
  valid: boolean;
  errors: string[];
  duplicate: boolean;
  withinFileDuplicate?: boolean;
  duplicateMatches?: { reason?: string }[];
}

interface PreviewResponse {
  fileName: string;
  headers: string[];
  suggestedMapping: Record<string, string>;
  appliedMapping: Record<string, string>;
  totalRows: number;
  duplicateLookupLimited?: boolean;
  rows: PreviewRow[];
  counts: {
    total: number;
    valid: number;
    invalid: number;
    duplicates: number;
  };
}

interface CommitResponse {
  success: boolean;
  importId: string;
  inserted: number;
  skippedDuplicates: number;
  invalid: number;
  overriddenInserts: number;
  errors: { rowNumber: number; companyName: string; reason: string; type: string }[];
}

export function LeadImportDialog({
  open,
  onOpenChange,
  canOverride,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  canOverride: boolean;
}) {
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<Step>("upload");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [override, setOverride] = useState(false);
  const [overrideReason, setOverrideReason] = useState("");
  const [result, setResult] = useState<CommitResponse | null>(null);

  function reset() {
    setStep("upload");
    setFile(null);
    setPreview(null);
    setMapping({});
    setOverride(false);
    setOverrideReason("");
    setResult(null);
    setLoading(false);
  }

  function handleClose(v: boolean) {
    if (!v) reset();
    onOpenChange(v);
  }

  async function downloadTemplate() {
    try {
      await downloadAuthedFile("/api/leads/template", "lead-import-template.csv");
    } catch (e: any) {
      toast({ title: "Template download failed", description: e.message, variant: "destructive" });
    }
  }

  async function runPreview(selected: File) {
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append("file", selected);
      const res = await fetch("/api/leads/import/preview", {
        method: "POST",
        headers: getAuthHeader(),
        body: fd,
      });
      const json = await res.json();
      if (!res.ok || !json.headers) {
        throw new Error(json.error || "Preview failed");
      }
      setPreview(json);
      setMapping(json.appliedMapping || {});
      setStep("preview");
    } catch (e: any) {
      toast({ title: "Preview failed", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  function onFileChosen(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    runPreview(f);
  }

  function mappedRows(): { rowNumber: number; [k: string]: any }[] {
    if (!preview) return [];
    // Build canonical rows from the raw (source-keyed) data using the current
    // mapping (targetField -> sourceColumn). Falls back to the server's already
    // canonicalised value when a field is unmapped.
    return preview.rows.map((r) => {
      const out: Record<string, any> = { rowNumber: r.rowNumber };
      for (const tf of TARGET_FIELDS) {
        const src = mapping[tf.key];
        out[tf.key] = src ? (r.raw[src] ?? "") : (r.data[tf.key] ?? "");
      }
      return out as any;
    });
  }

  // Live cell value reflecting the current mapping for the preview table.
  function cell(r: PreviewRow, field: string): string {
    const src = mapping[field];
    const v = src ? r.raw[src] : r.data[field];
    return v === undefined || v === null ? "" : String(v);
  }

  async function commit() {
    if (!preview) return;
    if (override && !overrideReason.trim()) {
      toast({ title: "Reason required", description: "Provide a reason to override duplicates.", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const body: any = {
        fileName: preview.fileName,
        rows: mappedRows(),
      };
      if (override) {
        body.override = true;
        body.overrideReason = overrideReason.trim();
      }
      const res = await fetch("/api/leads/import/commit", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeader() },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Commit failed");
      }
      setResult(json);
      setStep("result");
      queryClient.invalidateQueries({ queryKey: ["/api/customers"] });
      toast({
        title: "Import complete",
        description: `${json.inserted} added, ${json.skippedDuplicates} skipped, ${json.invalid} invalid.`,
      });
    } catch (e: any) {
      toast({ title: "Import failed", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  async function downloadErrors() {
    if (!result?.importId) return;
    try {
      const res = await fetch(`/api/leads/imports/${result.importId}/errors`, {
        headers: getAuthHeader(),
      });
      if (!res.ok) throw new Error("Failed to download error report");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `lead-import-${result.importId}-errors.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e: any) {
      toast({ title: "Download failed", description: e.message, variant: "destructive" });
    }
  }

  const s = preview?.counts;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Import Leads</DialogTitle>
          <DialogDescription>
            Upload a CSV or Excel file. Rows are validated and checked for duplicates
            before anything is saved.
          </DialogDescription>
        </DialogHeader>

        {step === "upload" && (
          <div className="space-y-4 py-2">
            <div className="flex items-center justify-between rounded-lg border bg-slate-50 p-4 dark:bg-zinc-900">
              <div>
                <p className="font-semibold text-[#344767] dark:text-zinc-100">
                  Need the format?
                </p>
                <p className="text-sm text-gray-500 dark:text-zinc-400">
                  Download the template with the expected columns.
                </p>
              </div>
              <Button variant="outline" onClick={downloadTemplate} data-testid="button-download-template">
                <Download className="mr-2 h-4 w-4" /> Template
              </Button>
            </div>

            <div
              className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-10 text-center hover:border-[#00a65a]"
              onClick={() => fileRef.current?.click()}
            >
              {loading ? (
                <Loader2 className="mb-2 h-8 w-8 animate-spin text-[#00a65a]" />
              ) : (
                <Upload className="mb-2 h-8 w-8 text-gray-400" />
              )}
              <p className="font-medium">
                {loading ? "Reading file…" : "Click to choose a .csv, .xls or .xlsx file"}
              </p>
              {file && !loading && (
                <p className="mt-1 text-sm text-gray-500">{file.name}</p>
              )}
            </div>
            <input
              ref={fileRef}
              type="file"
              className="hidden"
              accept=".csv,.xls,.xlsx"
              onChange={onFileChosen}
              data-testid="input-import-file"
            />
          </div>
        )}

        {step === "preview" && preview && (
          <div className="flex min-h-0 flex-1 flex-col space-y-3">
            <div className="flex flex-wrap gap-2 text-sm">
              <Badge variant="secondary">Total {s?.total}</Badge>
              <Badge className="bg-green-600">Valid {s?.valid}</Badge>
              <Badge variant="destructive">Invalid {s?.invalid}</Badge>
              <Badge className="bg-amber-500">Duplicates {s?.duplicates}</Badge>
              {preview.duplicateLookupLimited && (
                <Badge variant="outline" className="border-amber-500 text-amber-700">
                  Dup check limited
                </Badge>
              )}
            </div>

            <div className="rounded-md border p-3">
              <p className="mb-2 text-sm font-semibold">Column mapping</p>
              <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
                {TARGET_FIELDS.map((tf) => (
                  <div key={tf.key} className="space-y-1">
                    <Label className="text-xs">
                      {tf.label}
                      {tf.required && <span className="text-red-500"> *</span>}
                    </Label>
                    <Select
                      value={mapping[tf.key] || "__none__"}
                      onValueChange={(v) =>
                        setMapping((m) => ({ ...m, [tf.key]: v === "__none__" ? "" : v }))
                      }
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue placeholder="—" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">— not mapped —</SelectItem>
                        {preview.headers.map((c) => (
                          <SelectItem key={c} value={c}>
                            {c}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
            </div>

            <ScrollArea className="min-h-0 flex-1 rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">#</TableHead>
                    <TableHead>Company</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {preview.rows.map((r) => (
                    <TableRow key={r.rowNumber}>
                      <TableCell>{r.rowNumber}</TableCell>
                      <TableCell>{cell(r, "companyName")}</TableCell>
                      <TableCell>{cell(r, "personName")}</TableCell>
                      <TableCell>{cell(r, "email")}</TableCell>
                      <TableCell>{cell(r, "phone")}</TableCell>
                      <TableCell>
                        {!r.valid ? (
                          <span className="text-xs text-red-600" title={r.errors.join("; ")}>
                            Invalid
                          </span>
                        ) : r.withinFileDuplicate ? (
                          <span className="text-xs text-amber-700">In-file dup</span>
                        ) : r.duplicate ? (
                          <span
                            className="text-xs text-amber-600"
                            title={r.duplicateMatches?.map((m) => m.reason).filter(Boolean).join("; ")}
                          >
                            Duplicate
                          </span>
                        ) : (
                          <span className="text-xs text-green-600">New</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>

            {(s?.duplicates ?? 0) > 0 && canOverride && (
              <div className="rounded-md border border-amber-300 bg-amber-50 p-3 dark:bg-amber-950/20">
                <label className="flex items-center gap-2 text-sm font-medium">
                  <input
                    type="checkbox"
                    checked={override}
                    onChange={(e) => setOverride(e.target.checked)}
                    data-testid="checkbox-override"
                  />
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                  Import duplicates anyway (override)
                </label>
                {override && (
                  <Input
                    className="mt-2"
                    placeholder="Reason for overriding duplicates (required)"
                    value={overrideReason}
                    onChange={(e) => setOverrideReason(e.target.value)}
                    data-testid="input-override-reason"
                  />
                )}
              </div>
            )}

            <div className="flex justify-between pt-1">
              <Button variant="ghost" onClick={() => setStep("upload")} disabled={loading}>
                Back
              </Button>
              <Button onClick={commit} disabled={loading || (s?.valid ?? 0) === 0} data-testid="button-commit-import">
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Import {s?.valid ?? 0} valid {override ? "(+ overrides)" : ""}
              </Button>
            </div>
          </div>
        )}

        {step === "result" && result && (
          <div className="space-y-4 py-2">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-6 w-6 text-green-600" />
              <p className="text-lg font-semibold">Import finished</p>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Stat label="Added" value={result.inserted} color="text-green-600" />
              <Stat label="Skipped (dup)" value={result.skippedDuplicates} color="text-amber-600" />
              <Stat label="Invalid" value={result.invalid} color="text-red-600" />
              <Stat label="Overrides" value={result.overriddenInserts} color="text-blue-600" />
            </div>
            {result.errors.length > 0 && (
              <div className="rounded-md border p-3">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-sm font-semibold">
                    {result.errors.length} row(s) not imported
                  </p>
                  <Button variant="outline" size="sm" onClick={downloadErrors} data-testid="button-download-errors">
                    <Download className="mr-2 h-4 w-4" /> Error report
                  </Button>
                </div>
                <ScrollArea className="max-h-40">
                  <ul className="space-y-1 text-xs text-gray-600 dark:text-zinc-400">
                    {result.errors.map((e, i) => (
                      <li key={i}>
                        Row {e.rowNumber} ({e.companyName || "—"}): {e.reason}
                      </li>
                    ))}
                  </ul>
                </ScrollArea>
              </div>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={reset}>
                Import another
              </Button>
              <Button onClick={() => handleClose(false)}>Done</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="rounded-md border p-3 text-center">
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
      <p className="text-xs text-gray-500 dark:text-zinc-400">{label}</p>
    </div>
  );
}
