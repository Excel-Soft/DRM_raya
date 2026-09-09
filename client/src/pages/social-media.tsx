import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Facebook,
  Instagram,
  Linkedin,
  Youtube,
  Music2,
  Globe,
  Plus,
  Pencil,
  Eye,
  Send,
  Check,
  X,
  CalendarClock,
  Upload,
  Ban,
  Trash2,
  Download,
} from "lucide-react";
import { apiRequest, apiRequestJson, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

// ---------------------------------------------------------------------------
// Types — match server/social-media-routes.ts SELECT projection
// ---------------------------------------------------------------------------
type PostRow = {
  id: string;
  platform: string;
  socialAccountId: string | null;
  socialAccountName: string | null;
  socialAccountPlatform: string | null;
  title: string | null;
  content: string;
  mediaUrl: string | null;
  mediaName: string | null;
  linkedCustomerId: string | null;
  linkedCustomerName: string | null;
  linkedProjectId: string | null;
  scheduledAt: string | null;
  publishedAt: string | null;
  approvalStatus: string;
  publishingStatus: string;
  failureReason: string | null;
  rejectionReason: string | null;
  cancelReason: string | null;
  externalRef: string | null;
  createdBy: string | null;
  createdByName: string | null;
  approvedBy: string | null;
  approvedByName: string | null;
  publishedBy: string | null;
  publishedByName: string | null;
  createdAt: string | null;
  updatedAt: string | null;
};

type PostsResponse = {
  data: PostRow[];
  total: number;
  page: number;
  pageSize: number;
};

type AccountRow = {
  id: string;
  accountName: string | null;
  platform: string;
  status: string;
};

type AccountsResponse = {
  data: AccountRow[];
  total: number;
  page: number;
  pageSize: number;
};

const PAGE_SIZE = 25;
const PLATFORMS = ["Facebook", "Instagram", "Linkedin", "Youtube", "Tiktok"];
const APPROVAL_STATUSES = ["DRAFT", "PENDING", "APPROVED", "REJECTED"];
const PUBLISHING_STATUSES = [
  "DRAFT",
  "READY",
  "SCHEDULED",
  "PUBLISHED",
  "FAILED",
  "CANCELLED",
];

// ---------------------------------------------------------------------------
// Role / identity helpers — UI gating only. The server is the real enforcement.
// ---------------------------------------------------------------------------
function normRole(raw: string): string {
  let n = (raw || "")
    .toLowerCase()
    .trim()
    .replace(/d\s*&\s*d/g, "dd")
    .replace(/&/g, "")
    .replace(/[\s-]+/g, "_")
    .replace(/_+/g, "_");
  if (["admin", "administrator", "adm", "super_admin"].includes(n)) return "admin";
  if (n.includes("super_hod")) return "super_hod";
  if (n === "hod" || n.includes("head")) return "hod";
  if (n.includes("seo") || n.includes("smm")) return "seo_smm_manager";
  if (n.includes("dd") && n.includes("manag")) return "dd_manager";
  if (n.includes("product") && n.includes("manag")) return "product_posting_manager";
  if (n.includes("posting") && n.includes("manag")) return "product_posting_manager";
  if (n.includes("marketing") && n.includes("manager")) return "marketing_manager";
  return n;
}

const POSTING_MANAGER_ROLES = [
  "product_posting_manager",
  "dd_manager",
  "marketing_manager",
  "seo_smm_manager",
];

function getRole(): string {
  if (typeof window === "undefined") return "";
  return normRole(sessionStorage.getItem("userRole") || "");
}

function getUserId(): string {
  if (typeof window === "undefined") return "";
  try {
    const t = sessionStorage.getItem("token");
    if (!t) return "";
    const seg = t.split(".")[1];
    if (!seg) return "";
    const json = JSON.parse(
      atob(seg.replace(/-/g, "+").replace(/_/g, "/")),
    );
    return String(json.userId || json.id || "");
  } catch {
    return "";
  }
}

function isHttpUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

function platformIcon(platform: string) {
  switch ((platform || "").toLowerCase()) {
    case "facebook":
      return <Facebook size={15} className="text-[#4267B2]" />;
    case "instagram":
      return <Instagram size={15} className="text-[#E1306C]" />;
    case "linkedin":
      return <Linkedin size={15} className="text-[#0077b5]" />;
    case "youtube":
      return <Youtube size={15} className="text-[#FF0000]" />;
    case "tiktok":
      return <Music2 size={15} className="text-[#495057] dark:text-zinc-400" />;
    default:
      return <Globe size={15} className="text-[#6c757d]" />;
  }
}

function formatDateTime(value: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleString();
}

function approvalBadge(status: string) {
  const map: Record<string, string> = {
    DRAFT: "bg-slate-200 text-slate-700 dark:bg-zinc-800 dark:text-zinc-300",
    PENDING: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
    APPROVED: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
    REJECTED: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
  };
  return map[status] ?? "bg-slate-200 text-slate-700";
}

function publishingBadge(status: string) {
  const map: Record<string, string> = {
    DRAFT: "bg-slate-200 text-slate-700 dark:bg-zinc-800 dark:text-zinc-300",
    READY: "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300",
    SCHEDULED: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300",
    PUBLISHED: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
    FAILED: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
    CANCELLED: "bg-slate-300 text-slate-600 dark:bg-zinc-700 dark:text-zinc-300",
  };
  return map[status] ?? "bg-slate-200 text-slate-700";
}

// datetime-local string for an input min (now, local)
function nowLocalInput(): string {
  const d = new Date(Date.now() + 60 * 1000);
  const off = d.getTimezoneOffset();
  const local = new Date(d.getTime() - off * 60 * 1000);
  return local.toISOString().slice(0, 16);
}
function toLocalInput(value: string | null): string {
  if (!value) return "";
  const d = new Date(value);
  if (isNaN(d.getTime())) return "";
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60 * 1000).toISOString().slice(0, 16);
}

const emptyForm = {
  platform: "Facebook",
  socialAccountId: "",
  title: "",
  content: "",
  mediaUrl: "",
  mediaName: "",
  scheduledAt: "",
};

export default function SocialMedia() {
  const { toast } = useToast();
  const role = getRole();
  const uid = getUserId();

  const isFull = role === "admin" || role === "super_hod";
  const isHod = role === "hod";
  const isPostingManager = POSTING_MANAGER_ROLES.includes(role);
  // Approve/reject: FULL + HOD only (mirrors the server). Server is the real enforcement.
  const isApprover = isFull || isHod;
  const canPublish = isFull || isPostingManager;
  const canSchedule = isFull || isPostingManager;

  // Filters
  const [searchInput, setSearchInput] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [platformFilter, setPlatformFilter] = useState("all");
  const [approvalFilter, setApprovalFilter] = useState("all");
  const [publishingFilter, setPublishingFilter] = useState("all");
  const [accountFilter, setAccountFilter] = useState("all");
  const [scheduledFrom, setScheduledFrom] = useState("");
  const [scheduledTo, setScheduledTo] = useState("");
  const [page, setPage] = useState(1);

  // Dialogs
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({ ...emptyForm });
  const [editTarget, setEditTarget] = useState<PostRow | null>(null);
  const [editForm, setEditForm] = useState({ ...emptyForm });
  const [viewTarget, setViewTarget] = useState<PostRow | null>(null);
  const [rejectTarget, setRejectTarget] = useState<PostRow | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [cancelTarget, setCancelTarget] = useState<PostRow | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [scheduleTarget, setScheduleTarget] = useState<PostRow | null>(null);
  const [scheduleAt, setScheduleAt] = useState("");
  const [publishTarget, setPublishTarget] = useState<PostRow | null>(null);
  const [publishConfirm, setPublishConfirm] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => {
      setSearchTerm(searchInput);
      setPage(1);
    }, 350);
    return () => clearTimeout(t);
  }, [searchInput]);

  useEffect(() => {
    setPage(1);
  }, [platformFilter, approvalFilter, publishingFilter, accountFilter, scheduledFrom, scheduledTo]);

  // Accounts (for the create/edit account picker + the account filter)
  const { data: accountsResp } = useQuery<AccountsResponse>({
    queryKey: ["/api/social-media/accounts", "picker"],
    queryFn: () =>
      apiRequestJson<AccountsResponse>(
        "GET",
        "/api/social-media/accounts?page=1&pageSize=100",
      ),
  });
  const accounts = accountsResp?.data ?? [];

  const queryString = useMemo(() => {
    const p = new URLSearchParams();
    p.set("page", String(page));
    p.set("pageSize", String(PAGE_SIZE));
    if (searchTerm.trim()) p.set("search", searchTerm.trim());
    if (platformFilter !== "all") p.set("platform", platformFilter);
    if (approvalFilter !== "all") p.set("approvalStatus", approvalFilter);
    if (publishingFilter !== "all") p.set("publishingStatus", publishingFilter);
    if (accountFilter !== "all") p.set("socialAccountId", accountFilter);
    if (scheduledFrom) p.set("scheduledFrom", scheduledFrom);
    if (scheduledTo) p.set("scheduledTo", `${scheduledTo}T23:59:59`);
    return p.toString();
  }, [page, searchTerm, platformFilter, approvalFilter, publishingFilter, accountFilter, scheduledFrom, scheduledTo]);

  const { data: response, isLoading, isError, error } = useQuery<PostsResponse>({
    queryKey: ["/api/social-media/posts", queryString],
    queryFn: () =>
      apiRequestJson<PostsResponse>("GET", `/api/social-media/posts?${queryString}`),
  });

  // Honest, scoped aggregate counts — same filters as the list (minus pagination).
  const summaryQueryString = useMemo(() => {
    const p = new URLSearchParams();
    if (searchTerm.trim()) p.set("search", searchTerm.trim());
    if (platformFilter !== "all") p.set("platform", platformFilter);
    if (approvalFilter !== "all") p.set("approvalStatus", approvalFilter);
    if (publishingFilter !== "all") p.set("publishingStatus", publishingFilter);
    if (accountFilter !== "all") p.set("socialAccountId", accountFilter);
    if (scheduledFrom) p.set("scheduledFrom", scheduledFrom);
    if (scheduledTo) p.set("scheduledTo", `${scheduledTo}T23:59:59`);
    return p.toString();
  }, [searchTerm, platformFilter, approvalFilter, publishingFilter, accountFilter, scheduledFrom, scheduledTo]);

  const {
    data: summary,
    isLoading: summaryLoading,
    isError: summaryError,
  } = useQuery<{
    total: number;
    approval: Record<string, number>;
    publishing: Record<string, number>;
    upcomingScheduled: number;
  }>({
    queryKey: ["/api/social-media/dashboard/summary", summaryQueryString],
    queryFn: () =>
      apiRequestJson("GET", `/api/social-media/dashboard/summary?${summaryQueryString}`),
  });

  const rows = response?.data ?? [];
  const total = response?.total ?? 0;
  const totalPages = total > 0 ? Math.ceil(total / PAGE_SIZE) : 1;
  const startEntry = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const endEntry = total === 0 ? 0 : Math.min(page * PAGE_SIZE, total);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/social-media/posts"] });
    queryClient.invalidateQueries({ queryKey: ["/api/social-media/dashboard/summary"] });
  };

  // Mutations -----------------------------------------------------------------
  const createMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      apiRequestJson("POST", "/api/social-media/posts", payload),
    onError: (err: any) =>
      toast({ title: "Failed to create post", description: err?.message, variant: "destructive" }),
  });
  const updateMutation = useMutation({
    mutationFn: (vars: { id: string; payload: Record<string, unknown> }) =>
      apiRequestJson("PATCH", `/api/social-media/posts/${vars.id}`, vars.payload),
    onError: (err: any) =>
      toast({ title: "Failed to update post", description: err?.message, variant: "destructive" }),
  });
  const actionMutation = useMutation({
    mutationFn: (vars: { id: string; action: string; payload?: Record<string, unknown> }) =>
      apiRequestJson("POST", `/api/social-media/posts/${vars.id}/${vars.action}`, vars.payload ?? {}),
  });
  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequestJson("DELETE", `/api/social-media/posts/${id}`),
    onSuccess: () => {
      toast({ title: "Post deleted" });
      invalidate();
    },
    onError: (err: any) =>
      toast({ title: "Failed to delete post", description: err?.message, variant: "destructive" }),
  });

  // Row-level capability helpers ---------------------------------------------
  const isOwner = (row: PostRow) => !!uid && String(row.createdBy) === uid;
  // Management (edit/submit/schedule/cancel/delete): FULL, the owner, or a posting
  // manager (department scope, resolved server-side). HOD manages only its own posts.
  const canManage = (row: PostRow) => isFull || isOwner(row) || isPostingManager;
  const canEdit = (row: PostRow) =>
    canManage(row) && (isFull || ["DRAFT", "REJECTED"].includes(row.approvalStatus));
  const canSubmit = (row: PostRow) =>
    canManage(row) && ["DRAFT", "REJECTED"].includes(row.approvalStatus);
  const canApprove = (row: PostRow) =>
    isApprover && row.approvalStatus === "PENDING" && (isFull || !isOwner(row));
  const canReject = (row: PostRow) => isApprover && row.approvalStatus === "PENDING";
  const canScheduleRow = (row: PostRow) =>
    canSchedule &&
    row.approvalStatus === "APPROVED" &&
    ["READY", "SCHEDULED"].includes(row.publishingStatus);
  const canPublishRow = (row: PostRow) =>
    canPublish &&
    !["PUBLISHED", "CANCELLED"].includes(row.publishingStatus) &&
    (isFull || (row.approvalStatus === "APPROVED" && ["READY", "SCHEDULED"].includes(row.publishingStatus)));
  const canCancelRow = (row: PostRow) =>
    canManage(row) && !["PUBLISHED", "CANCELLED"].includes(row.publishingStatus);
  const canDeleteRow = (row: PostRow) => canManage(row);

  // Handlers ------------------------------------------------------------------
  function validateForm(f: typeof emptyForm): string | null {
    if (!f.platform.trim()) return "Platform is required";
    if (!f.socialAccountId.trim()) return "Account is required";
    if (!f.content.trim()) return "Content is required";
    if (f.mediaUrl.trim() && !isHttpUrl(f.mediaUrl.trim()))
      return "Media URL must be a valid http(s) URL";
    if (f.scheduledAt.trim()) {
      const d = new Date(f.scheduledAt);
      if (isNaN(d.getTime())) return "Scheduled date/time is invalid";
      if (d.getTime() <= Date.now()) return "Scheduled date/time cannot be in the past";
    }
    return null;
  }

  const handleCreate = async () => {
    const err = validateForm(form);
    if (err) {
      toast({ title: err, variant: "destructive" });
      return;
    }
    try {
      await createMutation.mutateAsync({
        platform: form.platform.trim(),
        socialAccountId: form.socialAccountId.trim(),
        title: form.title.trim() || undefined,
        content: form.content.trim(),
        mediaUrl: form.mediaUrl.trim() || undefined,
        mediaName: form.mediaName.trim() || undefined,
        scheduledAt: form.scheduledAt ? new Date(form.scheduledAt).toISOString() : undefined,
      });
      toast({ title: "Post created" });
      setCreateOpen(false);
      setForm({ ...emptyForm });
      invalidate();
    } catch {
      /* handled in onError */
    }
  };

  const openEdit = (row: PostRow) => {
    setEditTarget(row);
    setEditForm({
      platform: row.platform ?? "Facebook",
      socialAccountId: row.socialAccountId ?? "",
      title: row.title ?? "",
      content: row.content ?? "",
      mediaUrl: row.mediaUrl ?? "",
      mediaName: row.mediaName ?? "",
      scheduledAt: toLocalInput(row.scheduledAt),
    });
  };

  const handleEditSave = async () => {
    if (!editTarget) return;
    if (!editForm.platform.trim()) {
      toast({ title: "Platform is required", variant: "destructive" });
      return;
    }
    if (!editForm.socialAccountId.trim()) {
      toast({ title: "Account is required", variant: "destructive" });
      return;
    }
    if (!editForm.content.trim()) {
      toast({ title: "Content is required", variant: "destructive" });
      return;
    }
    if (editForm.mediaUrl.trim() && !isHttpUrl(editForm.mediaUrl.trim())) {
      toast({ title: "Media URL must be a valid http(s) URL", variant: "destructive" });
      return;
    }
    try {
      await updateMutation.mutateAsync({
        id: editTarget.id,
        payload: {
          platform: editForm.platform.trim(),
          socialAccountId: editForm.socialAccountId.trim(),
          title: editForm.title.trim() || null,
          content: editForm.content.trim(),
          mediaUrl: editForm.mediaUrl.trim() || null,
          mediaName: editForm.mediaName.trim() || null,
        },
      });
      toast({ title: "Post updated" });
      setEditTarget(null);
      invalidate();
    } catch {
      /* handled in onError */
    }
  };

  const runAction = async (
    id: string,
    action: string,
    payload: Record<string, unknown> | undefined,
    successTitle: string,
    after?: () => void,
  ) => {
    try {
      await actionMutation.mutateAsync({ id, action, payload });
      toast({ title: successTitle });
      after?.();
      invalidate();
    } catch (e: any) {
      toast({ title: "Action failed", description: e?.message, variant: "destructive" });
    }
  };

  const handleReject = async () => {
    if (!rejectTarget) return;
    if (!rejectReason.trim()) {
      toast({ title: "A rejection reason is required", variant: "destructive" });
      return;
    }
    await runAction(rejectTarget.id, "reject", { reason: rejectReason.trim() }, "Post rejected", () => {
      setRejectTarget(null);
      setRejectReason("");
    });
  };

  const handleCancel = async () => {
    if (!cancelTarget) return;
    if (!cancelReason.trim()) {
      toast({ title: "A cancellation reason is required", variant: "destructive" });
      return;
    }
    await runAction(cancelTarget.id, "cancel", { reason: cancelReason.trim() }, "Post cancelled", () => {
      setCancelTarget(null);
      setCancelReason("");
    });
  };

  const handleSchedule = async () => {
    if (!scheduleTarget) return;
    if (!scheduleAt.trim()) {
      toast({ title: "Pick a date/time to schedule", variant: "destructive" });
      return;
    }
    const d = new Date(scheduleAt);
    if (isNaN(d.getTime()) || d.getTime() <= Date.now()) {
      toast({ title: "Scheduled date/time must be in the future", variant: "destructive" });
      return;
    }
    await runAction(
      scheduleTarget.id,
      "schedule",
      { scheduledAt: d.toISOString() },
      "Post scheduled",
      () => {
        setScheduleTarget(null);
        setScheduleAt("");
      },
    );
  };

  const handlePublish = async () => {
    if (!publishTarget) return;
    if (!publishConfirm) {
      toast({ title: "Please confirm the manual/internal publish", variant: "destructive" });
      return;
    }
    await runAction(
      publishTarget.id,
      "publish",
      { confirmManual: true },
      "Post marked Manually/Internally Published",
      () => {
        setPublishTarget(null);
        setPublishConfirm(false);
      },
    );
  };

  const handleExport = async () => {
    try {
      const p = new URLSearchParams();
      if (searchTerm.trim()) p.set("search", searchTerm.trim());
      if (platformFilter !== "all") p.set("platform", platformFilter);
      if (approvalFilter !== "all") p.set("approvalStatus", approvalFilter);
      if (publishingFilter !== "all") p.set("publishingStatus", publishingFilter);
      if (accountFilter !== "all") p.set("socialAccountId", accountFilter);
      const res = await apiRequest("GET", `/api/social-media/posts/export?${p.toString()}`);
      if (!res.ok) throw new Error(`${res.status}: ${await res.text()}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `social-media-posts-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      toast({ title: "Export failed", description: e?.message, variant: "destructive" });
    }
  };

  const accountLabel = (a: AccountRow) =>
    `${a.accountName || "(unnamed)"} · ${a.platform}`;

  // Form fields shared between create + edit dialogs
  const renderFormFields = (
    f: typeof emptyForm,
    set: (next: typeof emptyForm) => void,
  ) => (
    <div className="space-y-3 py-2">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs font-semibold">Platform</Label>
          <Select value={f.platform} onValueChange={(v) => set({ ...f, platform: v })}>
            <SelectTrigger className="h-9 text-[13px]" data-testid="select-form-platform">
              <SelectValue placeholder="Platform" />
            </SelectTrigger>
            <SelectContent>
              {PLATFORMS.map((p) => (
                <SelectItem key={p} value={p}>{p}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs font-semibold">Account</Label>
          <Select value={f.socialAccountId} onValueChange={(v) => set({ ...f, socialAccountId: v })}>
            <SelectTrigger className="h-9 text-[13px]" data-testid="select-form-account">
              <SelectValue placeholder="Select account" />
            </SelectTrigger>
            <SelectContent>
              {accounts.length === 0 ? (
                <SelectItem value="__none" disabled>No accounts available</SelectItem>
              ) : (
                accounts.map((a) => (
                  <SelectItem key={a.id} value={a.id}>{accountLabel(a)}</SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div>
        <Label className="text-xs font-semibold">Title (optional)</Label>
        <Input
          value={f.title}
          onChange={(e) => set({ ...f, title: e.target.value })}
          placeholder="Internal title"
          className="h-9 text-[13px]"
          data-testid="input-form-title"
        />
      </div>
      <div>
        <Label className="text-xs font-semibold">Content</Label>
        <Textarea
          value={f.content}
          onChange={(e) => set({ ...f, content: e.target.value })}
          placeholder="Post content"
          rows={5}
          className="text-[13px]"
          data-testid="input-form-content"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs font-semibold">Media URL (optional)</Label>
          <Input
            value={f.mediaUrl}
            onChange={(e) => set({ ...f, mediaUrl: e.target.value })}
            placeholder="https://…"
            className="h-9 text-[13px]"
            data-testid="input-form-media-url"
          />
        </div>
        <div>
          <Label className="text-xs font-semibold">Media name (optional)</Label>
          <Input
            value={f.mediaName}
            onChange={(e) => set({ ...f, mediaName: e.target.value })}
            placeholder="image.png"
            className="h-9 text-[13px]"
            data-testid="input-form-media-name"
          />
        </div>
      </div>
    </div>
  );

  return (
    <div className="p-6 bg-[#f8f9fa] min-h-[calc(100vh-60px)] dark:bg-zinc-950">
      <h1 className="text-[15px] font-bold text-[#495057] tracking-wide uppercase mb-1 dark:text-zinc-400">
        Social Media Posting
      </h1>
      <p className="text-[12px] text-[#6c757d] mb-4 dark:text-zinc-500">
        Create, submit, approve and publish posts. Publishing is recorded internally
        (manual) — posts are not sent to any external platform.
      </p>

      {/* Real, scoped counts from GET /api/social-media/dashboard/summary —
          reflect the active filters; never client-derived from a paged list. */}
      <div className="mb-5 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { label: "Total Posts", value: summary?.total, tone: "text-[#495057] dark:text-zinc-200" },
          { label: "Pending Approval", value: summary?.approval?.PENDING, tone: "text-amber-600 dark:text-amber-400" },
          { label: "Approved", value: summary?.approval?.APPROVED, tone: "text-emerald-600 dark:text-emerald-400" },
          { label: "Scheduled", value: summary?.publishing?.SCHEDULED, tone: "text-indigo-600 dark:text-indigo-400" },
          { label: "Published", value: summary?.publishing?.PUBLISHED, tone: "text-emerald-600 dark:text-emerald-400" },
          { label: "Upcoming", value: summary?.upcomingScheduled, tone: "text-sky-600 dark:text-sky-400" },
        ].map((c) => (
          <div
            key={c.label}
            className="bg-white border border-gray-100 rounded-sm shadow-sm px-4 py-3 dark:bg-zinc-900 dark:border-zinc-800"
            data-testid={`stat-${c.label.toLowerCase().replace(/\s+/g, "-")}`}
          >
            <div className="text-[11px] uppercase tracking-wide text-[#6c757d] dark:text-zinc-500">
              {c.label}
            </div>
            <div className={`text-xl font-bold ${c.tone}`}>
              {summaryLoading ? "…" : summaryError ? "—" : (c.value ?? 0)}
            </div>
          </div>
        ))}
      </div>

      <div className="mb-5 flex flex-wrap items-center gap-3">
        <Button
          className="bg-[#00a65a] hover:bg-[#008d4c] text-white px-4 text-[13px] font-medium tracking-wide h-9 shadow-sm rounded-sm gap-1.5"
          onClick={() => {
            setForm({ ...emptyForm });
            setCreateOpen(true);
          }}
          data-testid="button-new-post"
        >
          <Plus size={15} /> New Post
        </Button>
        <Button
          variant="outline"
          className="px-4 text-[13px] font-medium tracking-wide h-9 shadow-sm rounded-sm gap-1.5"
          onClick={handleExport}
          data-testid="button-export"
        >
          <Download size={15} /> Export CSV
        </Button>

        <div className="flex flex-wrap items-center gap-2 ml-auto">
          <Select value={platformFilter} onValueChange={setPlatformFilter}>
            <SelectTrigger className="h-9 w-32 text-[13px]" data-testid="select-platform-filter">
              <SelectValue placeholder="Platform" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Platforms</SelectItem>
              {PLATFORMS.map((p) => (
                <SelectItem key={p} value={p}>{p}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={accountFilter} onValueChange={setAccountFilter}>
            <SelectTrigger className="h-9 w-40 text-[13px]" data-testid="select-account-filter">
              <SelectValue placeholder="Account" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Accounts</SelectItem>
              {accounts.map((a) => (
                <SelectItem key={a.id} value={a.id}>{accountLabel(a)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={approvalFilter} onValueChange={setApprovalFilter}>
            <SelectTrigger className="h-9 w-36 text-[13px]" data-testid="select-approval-filter">
              <SelectValue placeholder="Approval" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Approval</SelectItem>
              {APPROVAL_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={publishingFilter} onValueChange={setPublishingFilter}>
            <SelectTrigger className="h-9 w-36 text-[13px]" data-testid="select-publishing-filter">
              <SelectValue placeholder="Publishing" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Publishing</SelectItem>
              {PUBLISHING_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            type="date"
            value={scheduledFrom}
            onChange={(e) => setScheduledFrom(e.target.value)}
            className="h-9 w-36 text-[13px]"
            title="Scheduled from"
            aria-label="Scheduled from"
            data-testid="input-scheduled-from"
          />
          <Input
            type="date"
            value={scheduledTo}
            onChange={(e) => setScheduledTo(e.target.value)}
            className="h-9 w-36 text-[13px]"
            title="Scheduled to"
            aria-label="Scheduled to"
            data-testid="input-scheduled-to"
          />
          <Input
            placeholder="Search"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="h-9 w-48 text-[13px]"
            data-testid="input-search"
          />
        </div>
      </div>

      {/* Table */}
      <div className="w-full bg-white shadow-sm border border-gray-100 rounded-sm overflow-x-auto dark:bg-zinc-900 dark:border-zinc-800">
        <table className="w-full text-left border-collapse min-w-[1000px]">
          <thead>
            <tr className="border-b border-gray-100 dark:border-zinc-800" style={{ backgroundColor: "#e2f2e7" }}>
              {["S.No", "Platform", "Account", "Title / Content", "Approval", "Publishing", "Scheduled", "Created By", "Action"].map((h) => (
                <th key={h} className="px-4 py-3 text-[13px] font-bold text-[#212529] whitespace-nowrap dark:text-zinc-100">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-[13px] text-[#6c757d] dark:text-zinc-400">
                  Loading…
                </td>
              </tr>
            ) : isError ? (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-[13px] text-red-600 dark:text-red-400">
                  Failed to load posts: {(error as any)?.message ?? "Unknown error"}
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-[13px] text-[#6c757d] dark:text-zinc-400">
                  No posts found.
                </td>
              </tr>
            ) : (
              rows.map((row, idx) => (
                <tr
                  key={row.id}
                  className="border-b border-gray-50 hover:bg-gray-50 transition-colors dark:hover:bg-zinc-800 dark:border-zinc-800 align-top"
                  data-testid={`row-post-${row.id}`}
                >
                  <td className="px-4 py-4 text-[13px] text-[#212529] font-medium dark:text-zinc-100">{startEntry + idx}</td>
                  <td className="px-4 py-4 text-[13px] text-[#495057] dark:text-zinc-400">
                    <div className="flex items-center gap-1.5">
                      {platformIcon(row.platform)}
                      <span className="capitalize">{row.platform || "—"}</span>
                    </div>
                  </td>
                  <td className="px-4 py-4 text-[13px] text-[#495057] dark:text-zinc-400">{row.socialAccountName ?? "—"}</td>
                  <td className="px-4 py-4 text-[13px] text-[#495057] dark:text-zinc-400 max-w-[280px]">
                    {row.title ? <div className="font-semibold text-[#212529] dark:text-zinc-200">{row.title}</div> : null}
                    <div className="truncate">{row.content}</div>
                    {row.rejectionReason ? (
                      <div className="text-[11px] text-red-600 mt-1">Rejected: {row.rejectionReason}</div>
                    ) : null}
                    {row.cancelReason ? (
                      <div className="text-[11px] text-slate-500 mt-1">Cancelled: {row.cancelReason}</div>
                    ) : null}
                    {row.failureReason ? (
                      <div className="text-[11px] text-red-600 mt-1">Failure: {row.failureReason}</div>
                    ) : null}
                  </td>
                  <td className="px-4 py-4">
                    <span className={`px-2 py-0.5 rounded-[4px] text-[11px] font-bold ${approvalBadge(row.approvalStatus)}`}>
                      {row.approvalStatus}
                    </span>
                  </td>
                  <td className="px-4 py-4">
                    <span className={`px-2 py-0.5 rounded-[4px] text-[11px] font-bold ${publishingBadge(row.publishingStatus)}`}>
                      {row.publishingStatus}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-[12px] text-[#495057] dark:text-zinc-400 whitespace-nowrap">
                    {formatDateTime(row.scheduledAt)}
                  </td>
                  <td className="px-4 py-4 text-[12px] text-[#495057] dark:text-zinc-400 whitespace-nowrap">
                    {row.createdByName ?? "—"}
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <Eye
                        size={16}
                        className="text-[#6c757d] cursor-pointer hover:scale-110 transition-transform"
                        onClick={() => setViewTarget(row)}
                        data-testid={`button-view-${row.id}`}
                      />
                      {canEdit(row) && (
                        <Pencil
                          size={15}
                          className="text-[#3498db] cursor-pointer hover:scale-110 transition-transform"
                          onClick={() => openEdit(row)}
                          data-testid={`button-edit-${row.id}`}
                        />
                      )}
                      {canSubmit(row) && (
                        <Send
                          size={15}
                          className="text-[#00a65a] cursor-pointer hover:scale-110 transition-transform"
                          onClick={() => runAction(row.id, "submit-approval", {}, "Submitted for approval")}
                          data-testid={`button-submit-${row.id}`}
                        />
                      )}
                      {canApprove(row) && (
                        <Check
                          size={16}
                          className="text-[#059669] cursor-pointer hover:scale-110 transition-transform"
                          onClick={() => runAction(row.id, "approve", {}, "Post approved")}
                          data-testid={`button-approve-${row.id}`}
                        />
                      )}
                      {canReject(row) && (
                        <X
                          size={16}
                          className="text-[#e74c3c] cursor-pointer hover:scale-110 transition-transform"
                          onClick={() => {
                            setRejectTarget(row);
                            setRejectReason("");
                          }}
                          data-testid={`button-reject-${row.id}`}
                        />
                      )}
                      {canScheduleRow(row) && (
                        <CalendarClock
                          size={15}
                          className="text-[#6366f1] cursor-pointer hover:scale-110 transition-transform"
                          onClick={() => {
                            setScheduleTarget(row);
                            setScheduleAt(toLocalInput(row.scheduledAt) || nowLocalInput());
                          }}
                          data-testid={`button-schedule-${row.id}`}
                        />
                      )}
                      {canPublishRow(row) && (
                        <Upload
                          size={15}
                          className="text-[#00a65a] cursor-pointer hover:scale-110 transition-transform"
                          onClick={() => {
                            setPublishTarget(row);
                            setPublishConfirm(false);
                          }}
                          data-testid={`button-publish-${row.id}`}
                        />
                      )}
                      {canCancelRow(row) && (
                        <Ban
                          size={15}
                          className="text-[#f39c12] cursor-pointer hover:scale-110 transition-transform"
                          onClick={() => {
                            setCancelTarget(row);
                            setCancelReason("");
                          }}
                          data-testid={`button-cancel-${row.id}`}
                        />
                      )}
                      {canDeleteRow(row) && (
                        <Trash2
                          size={16}
                          className="text-[#e74c3c] cursor-pointer hover:scale-110 transition-transform"
                          onClick={() => {
                            if (window.confirm("Delete this post?")) deleteMutation.mutate(row.id);
                          }}
                          data-testid={`button-delete-${row.id}`}
                        />
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 dark:border-zinc-800">
          <span className="text-[12px] text-[#6c757d] dark:text-zinc-400">
            {total === 0 ? "Showing 0 entries" : `Showing ${startEntry} to ${endEntry} of ${total} entries`}
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              className="h-8 px-3 text-[12px]"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              data-testid="button-prev-page"
            >
              Previous
            </Button>
            <span className="text-[12px] text-[#495057] dark:text-zinc-400">
              {page} / {totalPages}
            </span>
            <Button
              variant="outline"
              className="h-8 px-3 text-[12px]"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              data-testid="button-next-page"
            >
              Next
            </Button>
          </div>
        </div>
      </div>

      {/* Create dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-[560px]">
          <DialogHeader>
            <DialogTitle>New Post</DialogTitle>
            <DialogDescription>Drafts are private until you submit them for approval.</DialogDescription>
          </DialogHeader>
          {renderFormFields(form, setForm)}
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Close</Button>
            <Button
              className="bg-[#00a65a] hover:bg-[#008d4c] text-white"
              onClick={handleCreate}
              disabled={createMutation.isPending}
              data-testid="button-save-post"
            >
              {createMutation.isPending ? "Saving…" : "Create Draft"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog open={!!editTarget} onOpenChange={(o) => !o && setEditTarget(null)}>
        <DialogContent className="sm:max-w-[560px]">
          <DialogHeader>
            <DialogTitle>Edit Post</DialogTitle>
          </DialogHeader>
          {renderFormFields(editForm, setEditForm)}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditTarget(null)}>Close</Button>
            <Button
              className="bg-[#00a65a] hover:bg-[#008d4c] text-white"
              onClick={handleEditSave}
              disabled={updateMutation.isPending}
              data-testid="button-update-post"
            >
              {updateMutation.isPending ? "Saving…" : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View dialog */}
      <Dialog open={!!viewTarget} onOpenChange={(o) => !o && setViewTarget(null)}>
        <DialogContent className="sm:max-w-[560px]">
          <DialogHeader>
            <DialogTitle>{viewTarget?.title || "Post details"}</DialogTitle>
          </DialogHeader>
          {viewTarget && (
            <div className="space-y-2 py-2 text-[13px]">
              <div className="flex items-center gap-2">
                {platformIcon(viewTarget.platform)}
                <span className="capitalize font-medium">{viewTarget.platform}</span>
                <span className="text-[#6c757d]">·</span>
                <span>{viewTarget.socialAccountName ?? "—"}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className={`px-2 py-0.5 rounded-[4px] text-[11px] font-bold ${approvalBadge(viewTarget.approvalStatus)}`}>
                  {viewTarget.approvalStatus}
                </span>
                <span className={`px-2 py-0.5 rounded-[4px] text-[11px] font-bold ${publishingBadge(viewTarget.publishingStatus)}`}>
                  {viewTarget.publishingStatus}
                </span>
              </div>
              <div className="whitespace-pre-wrap border rounded p-2 bg-[#f8f9fa] dark:bg-zinc-800 dark:border-zinc-700">
                {viewTarget.content}
              </div>
              {viewTarget.mediaUrl && (
                <div>
                  Media:{" "}
                  <a href={viewTarget.mediaUrl} target="_blank" rel="noreferrer" className="text-[#00a65a] hover:underline">
                    {viewTarget.mediaName || viewTarget.mediaUrl}
                  </a>
                </div>
              )}
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[12px] text-[#495057] dark:text-zinc-400">
                <div>Created by: {viewTarget.createdByName ?? "—"}</div>
                <div>Created: {formatDateTime(viewTarget.createdAt)}</div>
                <div>Approved by: {viewTarget.approvedByName ?? "—"}</div>
                <div>Scheduled: {formatDateTime(viewTarget.scheduledAt)}</div>
                <div>Published by: {viewTarget.publishedByName ?? "—"}</div>
                <div>Published: {formatDateTime(viewTarget.publishedAt)}</div>
              </div>
              {viewTarget.rejectionReason && (
                <div className="text-[12px] text-red-600">Rejection reason: {viewTarget.rejectionReason}</div>
              )}
              {viewTarget.cancelReason && (
                <div className="text-[12px] text-slate-500">Cancellation reason: {viewTarget.cancelReason}</div>
              )}
              {viewTarget.publishingStatus === "PUBLISHED" && (
                <div className="text-[12px] text-emerald-700 dark:text-emerald-400">
                  Manual/Internal Published — recorded internally; not posted to any external platform.
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setViewTarget(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject dialog */}
      <Dialog open={!!rejectTarget} onOpenChange={(o) => !o && setRejectTarget(null)}>
        <DialogContent className="sm:max-w-[460px]">
          <DialogHeader>
            <DialogTitle>Reject Post</DialogTitle>
            <DialogDescription>A reason is required and is shared with the creator.</DialogDescription>
          </DialogHeader>
          <Textarea
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="Why is this being rejected?"
            rows={4}
            className="text-[13px]"
            data-testid="input-reject-reason"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectTarget(null)}>Close</Button>
            <Button
              className="bg-[#e74c3c] hover:bg-[#c0392b] text-white"
              onClick={handleReject}
              disabled={actionMutation.isPending}
              data-testid="button-confirm-reject"
            >
              Reject
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel dialog */}
      <Dialog open={!!cancelTarget} onOpenChange={(o) => !o && setCancelTarget(null)}>
        <DialogContent className="sm:max-w-[460px]">
          <DialogHeader>
            <DialogTitle>Cancel Post</DialogTitle>
            <DialogDescription>A reason is required. Cancelled posts cannot be published.</DialogDescription>
          </DialogHeader>
          <Textarea
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
            placeholder="Why is this being cancelled?"
            rows={4}
            className="text-[13px]"
            data-testid="input-cancel-reason"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelTarget(null)}>Close</Button>
            <Button
              className="bg-[#f39c12] hover:bg-[#d9870f] text-white"
              onClick={handleCancel}
              disabled={actionMutation.isPending}
              data-testid="button-confirm-cancel"
            >
              Cancel Post
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Schedule dialog */}
      <Dialog open={!!scheduleTarget} onOpenChange={(o) => !o && setScheduleTarget(null)}>
        <DialogContent className="sm:max-w-[460px]">
          <DialogHeader>
            <DialogTitle>Schedule Post</DialogTitle>
            <DialogDescription>Pick a future date/time. Only approved posts can be scheduled.</DialogDescription>
          </DialogHeader>
          <Input
            type="datetime-local"
            value={scheduleAt}
            min={nowLocalInput()}
            onChange={(e) => setScheduleAt(e.target.value)}
            className="h-9 text-[13px]"
            data-testid="input-schedule-at"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setScheduleTarget(null)}>Close</Button>
            <Button
              className="bg-[#6366f1] hover:bg-[#4f46e5] text-white"
              onClick={handleSchedule}
              disabled={actionMutation.isPending}
              data-testid="button-confirm-schedule"
            >
              Schedule
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Publish dialog */}
      <Dialog open={!!publishTarget} onOpenChange={(o) => !o && setPublishTarget(null)}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>Publish Post (Manual / Internal)</DialogTitle>
            <DialogDescription>
              This records an internal, manually-confirmed publication. It does NOT post to
              Facebook/Instagram/LinkedIn or any external platform — no provider is connected.
            </DialogDescription>
          </DialogHeader>
          <label className="flex items-start gap-2 text-[13px] py-1 cursor-pointer">
            <input
              type="checkbox"
              checked={publishConfirm}
              onChange={(e) => setPublishConfirm(e.target.checked)}
              className="mt-0.5"
              data-testid="checkbox-publish-confirm"
            />
            <span>
              I understand this only records the post as Manually/Internally Published in this
              system and does not send it to any external network.
            </span>
          </label>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPublishTarget(null)}>Close</Button>
            <Button
              className="bg-[#00a65a] hover:bg-[#008d4c] text-white"
              onClick={handlePublish}
              disabled={!publishConfirm || actionMutation.isPending}
              data-testid="button-confirm-publish"
            >
              Mark Published
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
