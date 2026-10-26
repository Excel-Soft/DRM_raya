"use client";

import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Paperclip, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field } from "@/components/ui/field";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/legacy/dialog";
import { apiRequest } from "@/lib/query/query-client";
import { useToast } from "@/lib/hooks/use-legacy-toast";

// Shared between Task System (/pms/tasks) and Project Report/status
// (/pms/status) — both legacy pages (pms-tasks.tsx, pms-status.tsx) embed
// identical copies of this task-detail/files/links machinery.

export type TaskFileEntry = {
  id: string;
  fileUrl: string | null;
  fileName: string | null;
  description: string | null;
  createdAt: string;
  uploadedByName: string | null;
};

export type TaskRow = {
  id: string;
  title: string | null;
  name?: string | null;
  description: string | null;
  status: string | null;
  notes: string | null;
  rejectionNotes: string | null;
  createdAt: string;
  dueDate: string | null;
  timerStartedAt: string | null;
  remainingSecondsStored: number | null;
  currentSessionElapsedSeconds: number | null;
  submittedLinksCount: number | null;
  project?: { name?: string | null } | null;
};

export function extractProvidedLinks(task: TaskRow | null): string[] {
  try {
    if (task?.notes) {
      const parsed = JSON.parse(task.notes);
      if (parsed.links) {
        let candidates: string[] = [];
        if (Array.isArray(parsed.links)) {
          candidates = parsed.links.map((l: string) => String(l).trim()).filter(Boolean);
        } else if (typeof parsed.links === "string" && parsed.links.trim()) {
          candidates = parsed.links.split(",").map((l: string) => l.trim()).filter(Boolean);
        }
        return candidates.filter((l) => isNaN(Number(l)) && (l.includes(".") || l.includes("http")));
      }
    }
  } catch {
    // Not JSON — nothing to extract.
  }
  return [];
}

export function getRequiredLinksCount(task: TaskRow | null | undefined): number | null {
  try {
    if (task?.notes) {
      const n = Number(JSON.parse(task.notes)?.links);
      if (Number.isFinite(n) && n > 0) return n;
    }
  } catch {
    // Not JSON.
  }
  const match = /links:\s*(\S+)/i.exec(task?.description || "");
  if (match) {
    const n = Number(match[1]);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return null;
}

export function stripLinksTail(description: string | null | undefined): string {
  if (!description) return "";
  return description.replace(/\n*\s*links:\s*\S+\s*$/i, "").trim();
}

export function parseRejectionReason(task: TaskRow | null): string {
  if (!task?.rejectionNotes) return "No reason was provided by the manager.";
  try {
    const parsed = JSON.parse(task.rejectionNotes);
    return parsed?.reason || "No reason was provided by the manager.";
  } catch {
    return task.rejectionNotes;
  }
}

export function formatElapsed(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${h}:${m}:${s}`;
}

// Product Posting Executive's "Details" form — their submissions are
// working links (posted listing URLs), not evidence files/a note. Submits
// through the same generic /api/tasks/:id/files endpoint (description-only,
// no file), which already works for any task regardless of department.
export function AddLinksModal({ task, onClose }: { task: TaskRow | null; onClose: () => void }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [links, setLinks] = useState<string[]>([""]);
  const taskId = task?.id;

  const { data: uploadedRes } = useQuery<{ success: boolean; data: TaskFileEntry[] }>({
    queryKey: [`/api/tasks/${taskId}/files`],
    enabled: !!taskId,
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/tasks/${taskId}/files`);
      if (!res.ok) return { success: false, data: [] };
      return res.json();
    },
  });
  const submittedLinks = (uploadedRes?.data || []).filter((f) => !f.fileUrl && f.description);

  const submitMutation = useMutation({
    mutationFn: async () => {
      const validLinks = links.map((l) => l.trim()).filter(Boolean);
      for (const link of validLinks) {
        const form = new FormData();
        form.append("description", link);
        const res = await apiRequest("POST", `/api/tasks/${taskId}/files`, form);
        if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.message || "Failed to send links.");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/tasks/${taskId}/files`] });
      setLinks([""]);
      toast({ title: "Sent", description: "Your links were submitted." });
    },
    onError: (err: Error) => toast({ title: err.message || "Failed to send links", variant: "destructive" }),
  });

  if (!task) return null;
  const hasValidLink = links.some((l) => l.trim());
  const isLocked = task.status === "READY_FOR_QA" || task.status === "Completed";
  const requiredCount = getRequiredLinksCount(task);
  const requirementMet = requiredCount !== null && submittedLinks.length >= requiredCount;
  const canAddMore = !isLocked && !requirementMet;

  return (
    <Dialog open={!!task} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Links</DialogTitle>
        </DialogHeader>
        <div className="space-y-6">
          <div>
            <h3 className="mb-2 text-sm font-bold">Required Links</h3>
            {getRequiredLinksCount(task) === null ? (
              <p className="text-sm text-zinc-400">No link requirement set by the manager.</p>
            ) : (
              <p className="text-sm">
                <span className="text-base font-extrabold">{getRequiredLinksCount(task)}</span> link{getRequiredLinksCount(task) === 1 ? "" : "s"} required.
              </p>
            )}
          </div>
          <div>
            <h3 className="mb-2 text-sm font-bold">Submitted Links</h3>
            {submittedLinks.length === 0 ? (
              <p className="text-sm text-zinc-400">No links submitted yet.</p>
            ) : (
              <>
                <p className="mb-1.5 text-sm text-emerald-700 dark:text-emerald-500">
                  <span className="text-base font-extrabold">{submittedLinks.length}</span> link{submittedLinks.length === 1 ? "" : "s"} submitted.
                </p>
                <div className="space-y-1">
                  {submittedLinks.map((f) => (
                    <a
                      key={f.id}
                      href={(f.description || "").startsWith("http") ? f.description! : `https://${f.description}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block truncate text-sm text-emerald-600 underline hover:text-emerald-800"
                    >
                      {f.description}
                    </a>
                  ))}
                </div>
              </>
            )}
          </div>
          {canAddMore ? (
            <div className="space-y-2">
              <label className="text-sm font-bold">Add Link(s)</label>
              <div className="space-y-2">
                {links.map((link, idx) => (
                  <Input
                    key={idx}
                    value={link}
                    placeholder="https://…"
                    onChange={(e) => {
                      const next = [...links];
                      next[idx] = e.target.value;
                      setLinks(next);
                    }}
                  />
                ))}
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="primary"
                  disabled={requiredCount !== null && submittedLinks.length + links.length >= requiredCount}
                  onClick={() => setLinks((prev) => [...prev, ""])}
                >
                  Add Link
                </Button>
                {links.length > 1 ? (
                  <Button type="button" size="sm" variant="secondary" onClick={() => setLinks((prev) => prev.slice(0, -1))}>
                    Remove Link
                  </Button>
                ) : null}
              </div>
            </div>
          ) : (
            <div className="rounded-md border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm font-semibold text-zinc-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400">
              {isLocked ? "This task has been submitted for review — no more links can be sent until your manager reviews it." : "The required number of links has already been submitted."}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
          {canAddMore ? (
            <Button
              variant="primary"
              disabled={submitMutation.isPending || !hasValidLink || (requiredCount !== null && submittedLinks.length + links.filter((l) => l.trim()).length > requiredCount)}
              onClick={() => submitMutation.mutate()}
            >
              {submitMutation.isPending ? "Sending…" : "Send Links"}
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function FilesModal({ task, onClose, canUpload }: { task: TaskRow | null; onClose: () => void; canUpload: boolean }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [description, setDescription] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const taskId = task?.id;

  const { data: uploadedRes } = useQuery<{ success: boolean; data: TaskFileEntry[] }>({
    queryKey: [`/api/tasks/${taskId}/files`],
    enabled: !!taskId,
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/tasks/${taskId}/files`);
      if (!res.ok) return { success: false, data: [] };
      return res.json();
    },
  });
  const uploadedFiles = uploadedRes?.data || [];

  const submitMutation = useMutation({
    mutationFn: async () => {
      const form = new FormData();
      pendingFiles.forEach((f) => form.append("files", f));
      if (description.trim()) form.append("description", description.trim());
      const res = await apiRequest("POST", `/api/tasks/${taskId}/files`, form);
      if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.message || "Failed to send files.");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/tasks/${taskId}/files`] });
      setPendingFiles([]);
      setDescription("");
      toast({ title: "Sent", description: "Your files/detail were submitted." });
    },
    onError: (err: Error) => toast({ title: err.message || "Failed to send files", variant: "destructive" }),
  });

  if (!task) return null;
  const providedLinks = extractProvidedLinks(task);
  const isLocked = task.status === "READY_FOR_QA" || task.status === "Completed";

  return (
    <Dialog open={!!task} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Files</DialogTitle>
        </DialogHeader>
        <div className={`grid grid-cols-1 gap-8 ${canUpload ? "lg:grid-cols-2" : ""}`}>
          {canUpload ? (
            <div className="space-y-4">
              {isLocked ? (
                <div className="rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-600">
                  This task has been submitted for review — files can no longer be sent until your manager reviews it.
                </div>
              ) : null}
              <div
                role="button"
                tabIndex={0}
                onClick={() => !isLocked && fileInputRef.current?.click()}
                onDragOver={(e) => !isLocked && e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  if (isLocked) return;
                  const files = Array.from(e.dataTransfer.files || []);
                  if (files.length) setPendingFiles((prev) => [...prev, ...files]);
                }}
                className={`flex h-[200px] flex-col items-center justify-center gap-3 rounded-md border border-zinc-300 transition-colors dark:border-zinc-700 ${
                  isLocked ? "cursor-not-allowed opacity-50" : "cursor-pointer hover:border-emerald-400"
                }`}
              >
                <Upload className="h-8 w-8 text-zinc-400" />
                <p className="text-sm font-semibold text-zinc-600 dark:text-zinc-300">
                  {pendingFiles.length > 0 ? `${pendingFiles.length} file(s) selected` : "Drop files here or click to upload."}
                </p>
                <input ref={fileInputRef} type="file" multiple disabled={isLocked} className="hidden" onChange={(e) => setPendingFiles((prev) => [...prev, ...Array.from(e.target.files || [])])} />
              </div>
              <Field id="files-detail" label="Detail">
                <Textarea rows={4} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Type description here…" />
              </Field>
              <Button className="w-full" variant="primary" disabled={submitMutation.isPending || isLocked} onClick={() => submitMutation.mutate()}>
                {submitMutation.isPending ? "Sending…" : "Send Files"}
              </Button>
            </div>
          ) : null}

          <div className="space-y-6">
            <div>
              <h4 className="mb-2 text-sm font-bold">Uploaded Files</h4>
              <div className="space-y-2 border-t border-zinc-100 pt-2 dark:border-zinc-800">
                {uploadedFiles.filter((f) => f.fileUrl).length === 0 ? (
                  <p className="text-sm text-zinc-400">No files uploaded yet.</p>
                ) : (
                  uploadedFiles
                    .filter((f) => f.fileUrl)
                    .map((f) => (
                      <a key={f.id} href={f.fileUrl!} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-emerald-600 hover:underline">
                        <Paperclip className="h-3.5 w-3.5" /> {f.fileName || "File"}
                      </a>
                    ))
                )}
              </div>
            </div>
            <div>
              <h4 className="mb-2 text-sm font-bold">Uploaded Description</h4>
              <div className="space-y-2 border-t border-zinc-100 pt-2 dark:border-zinc-800">
                {uploadedFiles.filter((f) => f.description).length === 0 ? (
                  <p className="text-sm text-zinc-400">No description submitted yet.</p>
                ) : (
                  uploadedFiles.filter((f) => f.description).map((f) => <p key={f.id} className="text-sm text-zinc-600 dark:text-zinc-400">{f.description}</p>)
                )}
              </div>
            </div>
            <div>
              <h4 className="mb-2 text-sm font-bold">Provided Files</h4>
              <div className="space-y-2 border-t border-zinc-100 pt-2 dark:border-zinc-800">
                {providedLinks.length === 0 ? (
                  <p className="text-sm text-zinc-400">No files provided by the manager.</p>
                ) : (
                  providedLinks.map((link, i) => (
                    <a key={i} href={link.startsWith("http") ? link : `https://${link}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 truncate text-sm text-indigo-500 hover:underline">
                      <Paperclip className="h-3.5 w-3.5 shrink-0" /> {link}
                    </a>
                  ))
                )}
              </div>
            </div>
            <div>
              <h4 className="mb-2 text-sm font-bold">Provided Description</h4>
              <p className="border-t border-zinc-100 pt-2 text-sm text-zinc-600 dark:border-zinc-800 dark:text-zinc-400">{task.description || "No description provided."}</p>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
          {canUpload ? (
            <Button variant="primary" disabled={submitMutation.isPending || isLocked} onClick={() => submitMutation.mutate()}>
              {submitMutation.isPending ? "Saving…" : "Save"}
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
