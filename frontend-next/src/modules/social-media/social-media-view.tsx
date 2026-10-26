"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/legacy/button";
import { Button as NextButton } from "@/components/ui/button";
import { Badge, type BadgeVariant } from "@/components/ui/badge";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { DrmSection, drmFieldClass } from "@/modules/users/users-ui";
import { cn } from "@/lib/utils/cn";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
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
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/legacy/select";
import {
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
  Music2,
} from "lucide-react";
import { FaFacebook, FaInstagram, FaLinkedin, FaYoutube } from "react-icons/fa";
import { apiRequest, apiRequestJson, queryClient } from "@/lib/query/query-client";
import { useToast } from "@/lib/hooks/use-legacy-toast";
import { PageHeader } from "@/components/ui/page-header";

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
  likes: number;
  comments: number;
  shares: number;
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
      return <FaFacebook size={15} className="text-[#4267B2]" aria-hidden />;
    case "instagram":
      return <FaInstagram size={15} className="text-[#E1306C]" aria-hidden />;
    case "linkedin":
      return <FaLinkedin size={15} className="text-[#0077b5]" aria-hidden />;
    case "youtube":
      return <FaYoutube size={15} className="text-[#FF0000]" aria-hidden />;
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

function approvalBadgeVariant(status: string): BadgeVariant {
  if (status === "APPROVED") return "success";
  if (status === "PENDING") return "warning";
  if (status === "REJECTED") return "neutral";
  return "neutral";
}

function publishingBadgeVariant(status: string): BadgeVariant {
  if (status === "PUBLISHED") return "success";
  if (status === "SCHEDULED" || status === "READY") return "brand";
  if (status === "FAILED") return "warning";
  return "neutral";
}

function ApprovalStatusBadge({ status }: { status: string }) {
  return (
    <Badge
      variant={approvalBadgeVariant(status)}
      className={cn(
        "normal-case tracking-normal",
        status === "REJECTED" && "bg-red-50 text-red-800 dark:bg-red-950 dark:text-red-200",
      )}
    >
      {status}
    </Badge>
  );
}

function PublishingStatusBadge({ status }: { status: string }) {
  return (
    <Badge variant={publishingBadgeVariant(status)} className="normal-case tracking-normal">
      {status}
    </Badge>
  );
}

const socialDialogClass =
  "gap-0 overflow-hidden border-zinc-200 bg-white p-0 dark:border-zinc-800 dark:bg-zinc-900 sm:max-w-[560px] sm:rounded-2xl";

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

export function SocialMediaPage() {
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
  const engagementMutation = useMutation({
    mutationFn: (vars: { id: string; likes: number; comments: number; shares: number }) =>
      apiRequestJson("PATCH", `/api/social-media/posts/${vars.id}/engagement`, { likes: vars.likes, comments: vars.comments, shares: vars.shares }),
    onSuccess: (row: any) => {
      toast({ title: "Engagement updated" });
      setViewTarget(row);
      invalidate();
    },
    onError: (err: any) =>
      toast({ title: "Failed to update engagement", description: err?.message, variant: "destructive" }),
  });
  const [engagementDraft, setEngagementDraft] = useState({ likes: "0", comments: "0", shares: "0" });
  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequestJson("DELETE", `/api/social-media/posts/${id}`),
    onSuccess: () => {
      toast({ title: "Post deleted" });
      invalidate();
    },
    onError: (err: any) =>
      toast({ title: "Failed to delete post", description: err?.message, variant: "destructive" }),
  });
  const [deleteConfirmPost, setDeleteConfirmPost] = useState<any | null>(null);
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

  const postColumns = useMemo((): DataTableColumn<PostRow>[] => {
    const serialFor = (row: PostRow) => {
      const idx = rows.indexOf(row);
      return idx >= 0 ? startEntry + idx : "—";
    };

    const actionIconClass = "h-8 w-8 shrink-0 p-0";

    return [
      {
        id: "serial",
        header: "#",
        headerClassName: "w-12",
        cell: (row) => (
          <span className="font-medium tabular-nums text-zinc-900 dark:text-zinc-100">{serialFor(row)}</span>
        ),
      },
      {
        id: "platform",
        header: "Platform",
        cell: (row) => (
          <div className="flex items-center gap-1.5 capitalize text-zinc-700 dark:text-zinc-300">
            {platformIcon(row.platform)}
            {row.platform || "—"}
          </div>
        ),
      },
      {
        id: "account",
        header: "Account",
        cell: (row) => <span className="text-zinc-600 dark:text-zinc-400">{row.socialAccountName ?? "—"}</span>,
      },
      {
        id: "content",
        header: "Title / content",
        cell: (row) => (
          <div className="max-w-[280px] text-sm text-zinc-600 dark:text-zinc-400">
            {row.title ? <div className="font-medium text-zinc-900 dark:text-zinc-100">{row.title}</div> : null}
            <div className="truncate">{row.content}</div>
            {row.rejectionReason ? (
              <div className="mt-1 text-xs text-red-600 dark:text-red-400">Rejected: {row.rejectionReason}</div>
            ) : null}
            {row.cancelReason ? (
              <div className="mt-1 text-xs text-zinc-500">Cancelled: {row.cancelReason}</div>
            ) : null}
            {row.failureReason ? (
              <div className="mt-1 text-xs text-red-600 dark:text-red-400">Failure: {row.failureReason}</div>
            ) : null}
          </div>
        ),
      },
      {
        id: "approval",
        header: "Approval",
        cell: (row) => <ApprovalStatusBadge status={row.approvalStatus} />,
      },
      {
        id: "publishing",
        header: "Publishing",
        cell: (row) => <PublishingStatusBadge status={row.publishingStatus} />,
      },
      {
        id: "scheduled",
        header: "Scheduled",
        cell: (row) => (
          <span className="whitespace-nowrap text-sm text-zinc-500 dark:text-zinc-400">
            {formatDateTime(row.scheduledAt)}
          </span>
        ),
      },
      {
        id: "createdBy",
        header: "Created by",
        cell: (row) => (
          <span className="whitespace-nowrap text-sm text-zinc-500 dark:text-zinc-400">
            {row.createdByName ?? "—"}
          </span>
        ),
      },
      {
        id: "actions",
        header: "",
        headerClassName: "w-[200px] text-right",
        className: "text-right",
        cell: (row) => (
          <div className="flex flex-wrap items-center justify-end gap-0.5">
            <NextButton
              type="button"
              variant="ghost"
              size="sm"
              className={actionIconClass}
              aria-label="View post"
              onClick={() => {
                setViewTarget(row);
                setEngagementDraft({
                  likes: String(row.likes ?? 0),
                  comments: String(row.comments ?? 0),
                  shares: String(row.shares ?? 0),
                });
              }}
              data-testid={`button-view-${row.id}`}
            >
              <Eye className="h-4 w-4" />
            </NextButton>
            {canEdit(row) && (
              <NextButton
                type="button"
                variant="ghost"
                size="sm"
                className={actionIconClass}
                aria-label="Edit post"
                onClick={() => openEdit(row)}
                data-testid={`button-edit-${row.id}`}
              >
                <Pencil className="h-4 w-4" />
              </NextButton>
            )}
            {canSubmit(row) && (
              <NextButton
                type="button"
                variant="ghost"
                size="sm"
                className={cn(actionIconClass, "text-emerald-600")}
                aria-label="Submit for approval"
                onClick={() => runAction(row.id, "submit-approval", {}, "Submitted for approval")}
                data-testid={`button-submit-${row.id}`}
              >
                <Send className="h-4 w-4" />
              </NextButton>
            )}
            {canApprove(row) && (
              <NextButton
                type="button"
                variant="ghost"
                size="sm"
                className={cn(actionIconClass, "text-emerald-600")}
                aria-label="Approve post"
                onClick={() => runAction(row.id, "approve", {}, "Post approved")}
                data-testid={`button-approve-${row.id}`}
              >
                <Check className="h-4 w-4" />
              </NextButton>
            )}
            {canReject(row) && (
              <NextButton
                type="button"
                variant="ghost"
                size="sm"
                className={cn(actionIconClass, "text-red-600")}
                aria-label="Reject post"
                onClick={() => {
                  setRejectTarget(row);
                  setRejectReason("");
                }}
                data-testid={`button-reject-${row.id}`}
              >
                <X className="h-4 w-4" />
              </NextButton>
            )}
            {canScheduleRow(row) && (
              <NextButton
                type="button"
                variant="ghost"
                size="sm"
                className={actionIconClass}
                aria-label="Schedule post"
                onClick={() => {
                  setScheduleTarget(row);
                  setScheduleAt(toLocalInput(row.scheduledAt) || nowLocalInput());
                }}
                data-testid={`button-schedule-${row.id}`}
              >
                <CalendarClock className="h-4 w-4" />
              </NextButton>
            )}
            {canPublishRow(row) && (
              <NextButton
                type="button"
                variant="ghost"
                size="sm"
                className={cn(actionIconClass, "text-emerald-600")}
                aria-label="Publish post"
                onClick={() => {
                  setPublishTarget(row);
                  setPublishConfirm(false);
                }}
                data-testid={`button-publish-${row.id}`}
              >
                <Upload className="h-4 w-4" />
              </NextButton>
            )}
            {canCancelRow(row) && (
              <NextButton
                type="button"
                variant="ghost"
                size="sm"
                className={cn(actionIconClass, "text-amber-600")}
                aria-label="Cancel post"
                onClick={() => {
                  setCancelTarget(row);
                  setCancelReason("");
                }}
                data-testid={`button-cancel-${row.id}`}
              >
                <Ban className="h-4 w-4" />
              </NextButton>
            )}
            {canDeleteRow(row) && (
              <NextButton
                type="button"
                variant="ghost"
                size="sm"
                className={cn(actionIconClass, "text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40")}
                aria-label="Delete post"
                onClick={() => setDeleteConfirmPost(row)}
                data-testid={`button-delete-${row.id}`}
              >
                <Trash2 className="h-4 w-4" />
              </NextButton>
            )}
          </div>
        ),
      },
    ];
  }, [
    rows,
    startEntry,
    canEdit,
    canSubmit,
    canApprove,
    canReject,
    canScheduleRow,
    canPublishRow,
    canCancelRow,
    canDeleteRow,
    openEdit,
    runAction,
  ]);

  const filterControls = (
    <div className="relative z-30 flex max-w-full flex-wrap items-end gap-2">
      <Select value={platformFilter} onValueChange={setPlatformFilter}>
        <SelectTrigger className={cn(drmFieldClass, "h-9 w-[8.5rem] text-sm")} data-testid="select-platform-filter">
          <SelectValue placeholder="Platform" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All platforms</SelectItem>
          {PLATFORMS.map((p) => (
            <SelectItem key={p} value={p}>
              {p}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={accountFilter} onValueChange={setAccountFilter}>
        <SelectTrigger className={cn(drmFieldClass, "h-9 w-40 text-sm")} data-testid="select-account-filter">
          <SelectValue placeholder="Account" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All accounts</SelectItem>
          {accounts.map((a) => (
            <SelectItem key={a.id} value={a.id}>
              {accountLabel(a)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={approvalFilter} onValueChange={setApprovalFilter}>
        <SelectTrigger className={cn(drmFieldClass, "h-9 w-36 text-sm")} data-testid="select-approval-filter">
          <SelectValue placeholder="Approval" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All approval</SelectItem>
          {APPROVAL_STATUSES.map((s) => (
            <SelectItem key={s} value={s}>
              {s}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={publishingFilter} onValueChange={setPublishingFilter}>
        <SelectTrigger className={cn(drmFieldClass, "h-9 w-36 text-sm")} data-testid="select-publishing-filter">
          <SelectValue placeholder="Publishing" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All publishing</SelectItem>
          {PUBLISHING_STATUSES.map((s) => (
            <SelectItem key={s} value={s}>
              {s}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Input
        type="date"
        value={scheduledFrom}
        onChange={(e) => setScheduledFrom(e.target.value)}
        className={cn(drmFieldClass, "h-9 w-36 text-sm")}
        title="Scheduled from"
        aria-label="Scheduled from"
        data-testid="input-scheduled-from"
      />
      <Input
        type="date"
        value={scheduledTo}
        onChange={(e) => setScheduledTo(e.target.value)}
        className={cn(drmFieldClass, "h-9 w-36 text-sm")}
        title="Scheduled to"
        aria-label="Scheduled to"
        data-testid="input-scheduled-to"
      />
      <Input
        placeholder="Search…"
        value={searchInput}
        onChange={(e) => setSearchInput(e.target.value)}
        className={cn(drmFieldClass, "h-9 min-w-[10rem] text-sm")}
        data-testid="input-search"
      />
    </div>
  );

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
            <SelectTrigger className={cn(drmFieldClass, "h-9 text-sm")} data-testid="select-form-platform">
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
            <SelectTrigger className={cn(drmFieldClass, "h-9 text-sm")} data-testid="select-form-account">
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
          className={cn(drmFieldClass, "h-9 text-sm")}
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
          className={cn(drmFieldClass, "text-sm")}
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
            className={cn(drmFieldClass, "h-9 text-sm")}
            data-testid="input-form-media-url"
          />
        </div>
        <div>
          <Label className="text-xs font-semibold">Media name (optional)</Label>
          <Input
            value={f.mediaName}
            onChange={(e) => set({ ...f, mediaName: e.target.value })}
            placeholder="image.png"
            className={cn(drmFieldClass, "h-9 text-sm")}
            data-testid="input-form-media-name"
          />
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Social media"
        title="Add post / statistics"
        description="Create, submit, approve, and record internal publication. Posts are not sent to external platforms."
        actions={
          <div className="flex flex-wrap gap-2">
            <NextButton type="button" variant="secondary" size="sm" onClick={handleExport} data-testid="button-export">
              <Download className="mr-2 h-4 w-4" />
              Export CSV
            </NextButton>
            <NextButton
              type="button"
              variant="primary"
              size="sm"
              onClick={() => {
                setForm({ ...emptyForm });
                setCreateOpen(true);
              }}
              data-testid="button-new-post"
            >
              <Plus className="mr-2 h-4 w-4" />
              New post
            </NextButton>
          </div>
        }
      />

      <DrmSection title="Overview" description="Counts respect the filters below (server summary).">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {[
            { label: "Total posts", value: summary?.total, tone: "text-zinc-900 dark:text-zinc-100" },
            { label: "Pending approval", value: summary?.approval?.PENDING, tone: "text-amber-600 dark:text-amber-400" },
            { label: "Approved", value: summary?.approval?.APPROVED, tone: "text-emerald-600 dark:text-emerald-400" },
            { label: "Scheduled", value: summary?.publishing?.SCHEDULED, tone: "text-indigo-600 dark:text-indigo-400" },
            { label: "Published", value: summary?.publishing?.PUBLISHED, tone: "text-emerald-600 dark:text-emerald-400" },
            { label: "Upcoming", value: summary?.upcomingScheduled, tone: "text-sky-600 dark:text-sky-400" },
          ].map((c) => (
            <div
              key={c.label}
              className="rounded-xl border border-zinc-200 bg-zinc-50/80 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-950/50"
              data-testid={`stat-${c.label.toLowerCase().replace(/\s+/g, "-")}`}
            >
              <div className="text-[11px] font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                {c.label}
              </div>
              <div className={cn("text-xl font-semibold tabular-nums", c.tone)}>
                {summaryLoading ? "…" : summaryError ? "—" : (c.value ?? 0)}
              </div>
            </div>
          ))}
        </div>
      </DrmSection>

      <DrmSection title="Posts" description="Lifecycle actions per row (view, edit, approve, schedule, publish)." actions={filterControls}>
        <DataTable
          columns={postColumns}
          rows={rows}
          rowKey={(row) => row.id}
          loading={isLoading}
          error={isError ? ((error as Error)?.message ?? "Failed to load posts") : null}
          emptyMessage="No posts match your filters."
          className="min-w-[1000px]"
        />
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-zinc-200 pt-3 dark:border-zinc-800">
          <span className="text-xs text-zinc-500 dark:text-zinc-400">
            {total === 0 ? "Showing 0 entries" : `Showing ${startEntry}–${endEntry} of ${total}`}
          </span>
          <div className="flex items-center gap-2">
            <NextButton
              type="button"
              variant="secondary"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              data-testid="button-prev-page"
            >
              Previous
            </NextButton>
            <span className="text-xs tabular-nums text-zinc-600 dark:text-zinc-400">
              {page} / {totalPages}
            </span>
            <NextButton
              type="button"
              variant="secondary"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              data-testid="button-next-page"
            >
              Next
            </NextButton>
          </div>
        </div>
      </DrmSection>

      {/* Create dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className={socialDialogClass}>
          <DialogHeader className="border-b border-zinc-200 px-6 py-4 dark:border-zinc-800">
            <DialogTitle className="text-zinc-900 dark:text-zinc-100">New post</DialogTitle>
            <DialogDescription className="text-zinc-500 dark:text-zinc-400">
              Drafts are private until you submit them for approval.
            </DialogDescription>
          </DialogHeader>
          <div className="px-6 py-2">{renderFormFields(form, setForm)}</div>
          <DialogFooter className="gap-2 border-t border-zinc-200 px-6 py-4 dark:border-zinc-800 sm:justify-end">
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Close
            </Button>
            <Button
              className="bg-emerald-600 text-white hover:bg-emerald-700"
              onClick={handleCreate}
              disabled={createMutation.isPending}
              data-testid="button-save-post"
            >
              {createMutation.isPending ? "Saving…" : "Create draft"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit dialog */}
      <Dialog open={!!editTarget} onOpenChange={(o) => !o && setEditTarget(null)}>
        <DialogContent className={socialDialogClass}>
          <DialogHeader className="border-b border-zinc-200 px-6 py-4 dark:border-zinc-800">
            <DialogTitle className="text-zinc-900 dark:text-zinc-100">Edit post</DialogTitle>
          </DialogHeader>
          <div className="px-6 py-2">{renderFormFields(editForm, setEditForm)}</div>
          <DialogFooter className="gap-2 border-t border-zinc-200 px-6 py-4 dark:border-zinc-800 sm:justify-end">
            <Button variant="outline" onClick={() => setEditTarget(null)}>
              Close
            </Button>
            <Button
              className="bg-emerald-600 text-white hover:bg-emerald-700"
              onClick={handleEditSave}
              disabled={updateMutation.isPending}
              data-testid="button-update-post"
            >
              {updateMutation.isPending ? "Saving…" : "Save changes"}
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
                <ApprovalStatusBadge status={viewTarget.approvalStatus} />
                <PublishingStatusBadge status={viewTarget.publishingStatus} />
              </div>
              <div className="whitespace-pre-wrap rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-sm dark:border-zinc-700 dark:bg-zinc-800/80">
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
              <div className="border rounded p-3 dark:border-zinc-700 space-y-2">
                <div className="text-[12px] font-semibold text-[#495057] dark:text-zinc-400">
                  Engagement{viewTarget.publishingStatus !== "PUBLISHED" && " (recorded once published)"}
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <label className="text-[11px] text-[#6c757d] dark:text-zinc-500">
                    Likes
                    <Input
                      type="number"
                      min={0}
                      value={engagementDraft.likes}
                      onChange={(e) => setEngagementDraft((d) => ({ ...d, likes: e.target.value }))}
                      className="mt-1 h-8 text-[12.5px]"
                      disabled={!canManage(viewTarget)}
                    />
                  </label>
                  <label className="text-[11px] text-[#6c757d] dark:text-zinc-500">
                    Comments
                    <Input
                      type="number"
                      min={0}
                      value={engagementDraft.comments}
                      onChange={(e) => setEngagementDraft((d) => ({ ...d, comments: e.target.value }))}
                      className="mt-1 h-8 text-[12.5px]"
                      disabled={!canManage(viewTarget)}
                    />
                  </label>
                  <label className="text-[11px] text-[#6c757d] dark:text-zinc-500">
                    Shares
                    <Input
                      type="number"
                      min={0}
                      value={engagementDraft.shares}
                      onChange={(e) => setEngagementDraft((d) => ({ ...d, shares: e.target.value }))}
                      className="mt-1 h-8 text-[12.5px]"
                      disabled={!canManage(viewTarget)}
                    />
                  </label>
                </div>
                {canManage(viewTarget) && (
                  <Button
                    size="sm"
                    disabled={engagementMutation.isPending}
                    onClick={() => engagementMutation.mutate({
                      id: viewTarget.id,
                      likes: Math.max(0, parseInt(engagementDraft.likes, 10) || 0),
                      comments: Math.max(0, parseInt(engagementDraft.comments, 10) || 0),
                      shares: Math.max(0, parseInt(engagementDraft.shares, 10) || 0),
                    })}
                  >
                    {engagementMutation.isPending ? "Saving…" : "Save Engagement"}
                  </Button>
                )}
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

      <AlertDialog open={!!deleteConfirmPost} onOpenChange={(open) => !open && setDeleteConfirmPost(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure you want to delete this post?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the SMM post <strong>{deleteConfirmPost?.title}</strong> and cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={() => {
                if (deleteConfirmPost) {
                  deleteMutation.mutate(deleteConfirmPost.id);
                  setDeleteConfirmPost(null);
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
