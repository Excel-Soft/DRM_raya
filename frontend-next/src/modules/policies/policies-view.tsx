"use client";

import { useMemo, useState } from "react";
import { apiFetch } from "@/lib/api/browser-client";
import { ApiError } from "@/lib/api/errors";
import { useAuth } from "@/providers/auth-provider";
import { userCanManagePolicies } from "@/lib/auth/role-utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { NoticeNavTabs } from "@/modules/notice/notice-nav";
import { DrmSection, NoticeShell } from "@/modules/notice/notice-ui";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { Field } from "@/components/ui/field";
import { FormBanner, SubmitButton } from "@/components/ui/form-feedback";
import { Input } from "@/components/ui/input";
import { PageError, PageForbidden, PageLoading } from "@/components/ui/page-states";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useApiResource } from "@/lib/hooks/use-api-resource";
import { toast } from "@/lib/toast";

export type DrmPolicyRow = {
  id: string;
  head: string;
  type: string | null;
  fileUrl: string | null;
  penalty: string | null;
  minAllow: number | null;
  maxAllow: number | null;
  description: string | null;
  status: string;
  createdAt: string;
};

const POLICY_TYPES = [
  { value: "monthly_time", label: "Monthly Time" },
  { value: "daily_target", label: "Daily Target" },
  { value: "behavioral", label: "Behavioral" },
  { value: "attendance", label: "Attendance" },
];

const emptyForm = () => ({
  head: "",
  type: "",
  penalty: "",
  minAllow: "",
  maxAllow: "",
  description: "",
  fileUrl: "",
});

export function PoliciesView() {
  const { user } = useAuth();
  const canManage = userCanManagePolicies(user?.activeRoleId ?? null, user?.roles);
  const { data, loading, error, forbidden, refetch } = useApiResource<DrmPolicyRow[]>("/api/policies");
  const rows = Array.isArray(data) ? data : [];

  const [search, setSearch] = useState("");
  const [form, setForm] = useState(emptyForm);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitPending, setSubmitPending] = useState(false);
  const [banner, setBanner] = useState<{ variant: "success" | "error"; message: string } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DrmPolicyRow | null>(null);
  const [deletePending, setDeletePending] = useState(false);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (p) =>
        p.head.toLowerCase().includes(q) ||
        (p.type?.toLowerCase().includes(q) ?? false) ||
        (p.description?.toLowerCase().includes(q) ?? false),
    );
  }, [rows, search]);

  const columns: DataTableColumn<DrmPolicyRow>[] = [
    {
      id: "head",
      header: "Policy head",
      cell: (p) => <span className="font-medium text-zinc-900 dark:text-zinc-100">{p.head}</span>,
    },
    {
      id: "type",
      header: "Type",
      cell: (p) => p.type || "—",
      className: "whitespace-nowrap text-zinc-600 dark:text-zinc-400",
    },
    {
      id: "penalty",
      header: "Penalty",
      cell: (p) => (p.penalty != null ? p.penalty : "—"),
      className: "tabular-nums",
    },
    {
      id: "allow",
      header: "Min / max",
      cell: (p) =>
        p.minAllow != null || p.maxAllow != null ? `${p.minAllow ?? "—"} / ${p.maxAllow ?? "—"}` : "—",
      className: "tabular-nums text-zinc-600 dark:text-zinc-400",
    },
    {
      id: "status",
      header: "Status",
      cell: (p) => <Badge variant={p.status === "active" ? "success" : "neutral"}>{p.status}</Badge>,
    },
    {
      id: "created",
      header: "Created",
      cell: (p) => (p.createdAt ? new Date(p.createdAt).toLocaleString() : "—"),
      className: "whitespace-nowrap text-xs text-zinc-500",
    },
    ...(canManage
      ? [
          {
            id: "actions",
            header: "Actions",
            cell: (p: DrmPolicyRow) => (
              <Button type="button" variant="danger" size="sm" onClick={() => setDeleteTarget(p)}>
                Delete
              </Button>
            ),
            className: "whitespace-nowrap",
          } as DataTableColumn<DrmPolicyRow>,
        ]
      : []),
  ];

  const onCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setBanner(null);
    if (!form.head.trim()) {
      setFormError("Policy head is required.");
      return;
    }
    setSubmitPending(true);
    try {
      await apiFetch("/api/policies", {
        method: "POST",
        json: {
          head: form.head.trim(),
          type: form.type || undefined,
          penalty: form.penalty === "" ? undefined : form.penalty,
          minAllow: form.minAllow === "" ? undefined : Number(form.minAllow),
          maxAllow: form.maxAllow === "" ? undefined : Number(form.maxAllow),
          description: form.description || undefined,
          fileUrl: form.fileUrl || undefined,
        },
      });
      setForm(emptyForm());
      setBanner({ variant: "success", message: "Policy created successfully." });
      toast.success("Policy created successfully.");
      refetch();
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Failed to create policy.";
      setBanner({ variant: "error", message: msg });
      toast.error(msg);
    } finally {
      setSubmitPending(false);
    }
  };

  const onConfirmDelete = async () => {
    if (!deleteTarget) return;
    setDeletePending(true);
    try {
      await apiFetch(`/api/policies/${deleteTarget.id}`, { method: "DELETE" });
      setDeleteTarget(null);
      setBanner({ variant: "success", message: "Policy deleted." });
      toast.success("Policy deleted.");
      refetch();
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : "Failed to delete policy.";
      setBanner({ variant: "error", message: msg });
      toast.error(msg);
    } finally {
      setDeletePending(false);
    }
  };

  return (
    <NoticeShell
      title="DRM policies"
      description="Penalty and compliance rules. Writes require a managerial role (enforced by Express)."
      actions={<NoticeNavTabs />}
    >
      {banner ? (
        <FormBanner variant={banner.variant}>{banner.message}</FormBanner>
      ) : null}

      {canManage ? (
        <DrmSection title="Create policy">
        <form onSubmit={onCreate} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field id="policy-head" label="Policy head" error={formError ?? undefined}>
              <Input
                id="policy-head"
                value={form.head}
                onChange={(e) => setForm((f) => ({ ...f, head: e.target.value }))}
                invalid={Boolean(formError)}
              />
            </Field>
            <Field id="policy-type" label="Policy type">
              <Select
                id="policy-type"
                value={form.type}
                onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
              >
                <option value="">Choose…</option>
                {POLICY_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field id="policy-penalty" label="Penalty amount">
              <Input
                id="policy-penalty"
                type="number"
                step="0.01"
                value={form.penalty}
                onChange={(e) => setForm((f) => ({ ...f, penalty: e.target.value }))}
              />
            </Field>
            <Field id="policy-min" label="Min allow">
              <Input
                id="policy-min"
                type="number"
                value={form.minAllow}
                onChange={(e) => setForm((f) => ({ ...f, minAllow: e.target.value }))}
              />
            </Field>
            <Field id="policy-max" label="Max allow">
              <Input
                id="policy-max"
                type="number"
                value={form.maxAllow}
                onChange={(e) => setForm((f) => ({ ...f, maxAllow: e.target.value }))}
              />
            </Field>
            <Field id="policy-file" label="File URL (optional)" hint="Legacy supports image upload; URL field only in Next pilot.">
              <Input
                id="policy-file"
                value={form.fileUrl}
                onChange={(e) => setForm((f) => ({ ...f, fileUrl: e.target.value }))}
              />
            </Field>
          </div>
          <Field id="policy-desc" label="Description">
            <Textarea
              id="policy-desc"
              rows={3}
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            />
          </Field>
          <SubmitButton pending={submitPending}>Create policy</SubmitButton>
        </form>
        </DrmSection>
      ) : null}

      <DrmSection
        title="Policy list"
        actions={
          <Input
            placeholder="Search by head, type, or description…"
            aria-label="Search policies"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 max-w-xs text-sm"
          />
        }
      >
      {forbidden ? (
        <PageForbidden message="You do not have permission to view policies." />
      ) : loading ? (
        <PageLoading label="Loading policies…" />
      ) : error ? (
        <PageError message={error} onRetry={refetch} />
      ) : (
        <DataTable
          caption="DRM policies"
          columns={columns}
          rows={filtered}
          rowKey={(p) => p.id}
          emptyMessage={search ? "No policies match your search." : "No policies configured yet."}
        />
      )}
      </DrmSection>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete policy?"
        description={deleteTarget ? `Remove “${deleteTarget.head}”. This cannot be undone.` : undefined}
        destructive
        pending={deletePending}
        confirmLabel="Delete"
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => void onConfirmDelete()}
      />
    </NoticeShell>
  );
}
