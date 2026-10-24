"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest, mutationRequest } from "@/lib/query/query-client";
import { toast } from "@/lib/toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { DrmFormModal } from "@/modules/drm/drm-ui";
import { FiEdit2, FiPlus, FiTrash2 } from "react-icons/fi";

interface DepartmentRow {
  id: string;
  code: string;
  name: string;
  isActive: boolean;
  sortOrder: number;
}

interface DepartmentFormState {
  name: string;
  code: string;
  isActive: boolean;
}

const emptyForm: DepartmentFormState = { name: "", code: "", isActive: true };

export function DepartmentsManager() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState<DepartmentFormState>(emptyForm);
  const queryClient = useQueryClient();

  const { data: departments = [], isLoading, isError, refetch } = useQuery<DepartmentRow[]>({
    queryKey: ["/api/drm/departments", "all"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/drm/departments?includeInactive=true");
      const body = await res.json();
      return body.data ?? [];
    },
  });

  const invalidate = () => void queryClient.invalidateQueries({ queryKey: ["/api/drm/departments"] });

  const saveMutation = useMutation({
    mutationFn: async (input: DepartmentFormState) =>
      editingId
        ? mutationRequest("PATCH", `/api/drm/departments/${editingId}`, {
            name: input.name,
            code: input.code.trim() || undefined,
            isActive: input.isActive,
          })
        : mutationRequest("POST", "/api/drm/departments", {
            name: input.name,
            code: input.code.trim() || undefined,
            isActive: input.isActive,
          }),
    onSuccess: () => {
      invalidate();
      setDialogOpen(false);
      setEditingId(null);
      setForm(emptyForm);
      toast.success(editingId ? "Department updated." : "Department added.");
    },
    onError: (error: Error) => toast.error(error.message || "Save failed."),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => mutationRequest("DELETE", `/api/drm/departments/${id}`),
    onSuccess: () => {
      invalidate();
      setDeleteId(null);
      toast.success("Department removed.");
    },
    onError: (error: Error) => toast.error(error.message || "Delete failed."),
  });

  const openAdd = () => {
    setEditingId(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (dept: DepartmentRow) => {
    setEditingId(dept.id);
    setForm({ name: dept.name, code: dept.code, isActive: dept.isActive });
    setDialogOpen(true);
  };

  const columns = useMemo((): DataTableColumn<DepartmentRow>[] => {
    return [
      { id: "name", header: "Name", cell: (d) => <span className="font-medium">{d.name}</span> },
      {
        id: "code",
        header: "Code",
        cell: (d) => <span className="font-mono text-xs text-zinc-600 dark:text-zinc-400">{d.code}</span>,
      },
      {
        id: "status",
        header: "Status",
        cell: (d) => <Badge variant={d.isActive ? "success" : "neutral"}>{d.isActive ? "Active" : "Inactive"}</Badge>,
      },
      {
        id: "actions",
        header: "",
        headerClassName: "w-24 text-right",
        className: "text-right",
        cell: (d) => (
          <div className="flex justify-end gap-1">
            <Button type="button" variant="ghost" size="sm" aria-label={`Edit ${d.name}`} onClick={() => openEdit(d)}>
              <FiEdit2 className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40"
              aria-label={`Delete ${d.name}`}
              onClick={() => setDeleteId(d.id)}
            >
              <FiTrash2 className="h-4 w-4" />
            </Button>
          </div>
        ),
      },
    ];
  }, []);

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button type="button" variant="primary" size="sm" onClick={openAdd}>
          <FiPlus className="mr-1.5 h-4 w-4" />
          Add department
        </Button>
      </div>

      <DataTable
        caption="Departments"
        columns={columns}
        rows={departments}
        rowKey={(d) => d.id}
        loading={isLoading}
        error={isError ? "Could not load departments." : null}
        onRetry={() => void refetch()}
        emptyMessage="No departments yet."
      />

      <DrmFormModal
        open={dialogOpen}
        title={editingId ? "Edit department" : "Add department"}
        onClose={() => {
          setDialogOpen(false);
          setEditingId(null);
          setForm(emptyForm);
        }}
        footer={
          <>
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setDialogOpen(false);
                setEditingId(null);
                setForm(emptyForm);
              }}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="primary"
              disabled={!form.name.trim() || saveMutation.isPending}
              onClick={() => saveMutation.mutate(form)}
            >
              {saveMutation.isPending ? "Saving…" : editingId ? "Save changes" : "Add department"}
            </Button>
          </>
        }
      >
        <Field id="dept-name" label="Name">
          <Input
            id="dept-name"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder="Department name"
          />
        </Field>
        <Field
          id="dept-code"
          label="Code"
          hint="Stable identifier used in Allowed Departments and project settings."
        >
          <Input
            id="dept-code"
            value={form.code}
            onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))}
            placeholder="Auto from name if blank"
          />
        </Field>
        <label className="flex cursor-pointer items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-zinc-300 text-emerald-600 focus:ring-emerald-600/40"
            checked={form.isActive}
            onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
          />
          Active
        </label>
      </DrmFormModal>

      <ConfirmDialog
        open={deleteId !== null}
        title="Delete department?"
        description="Existing records may still reference this department code."
        confirmLabel="Delete"
        destructive
        pending={deleteMutation.isPending}
        onCancel={() => setDeleteId(null)}
        onConfirm={() => {
          if (deleteId) deleteMutation.mutate(deleteId);
        }}
      />
    </div>
  );
}
