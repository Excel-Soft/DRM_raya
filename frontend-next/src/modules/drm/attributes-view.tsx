"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest, mutationRequest } from "@/lib/query/query-client";
import { toast } from "@/lib/toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { BuyerDetailTree } from "@/modules/drm/components/buyer-detail-tree";
import { DepartmentsManager } from "@/modules/drm/components/departments-manager";
import { QaAttributeTree } from "@/modules/drm/components/qa-attribute-tree";
import { ServiceCatalogTree } from "@/modules/drm/components/service-catalog-tree";
import { DrmCategoryNav, DrmFormModal } from "@/modules/drm/drm-ui";
import { FiPlus, FiTrash2 } from "react-icons/fi";

const ATTRIBUTE_CATEGORIES = [
  "Company Detail",
  "Company Business Type",
  "Service Type",
  "RC Link",
  "Source",
  "Job Designation",
  "Q & A",
  "Service for Quotation",
  "Whatsapp Message",
  "Contact Attribute",
  "Donation Head",
  "Penalty Head",
  "Company Branch",
  "Country",
  "Govt Leave",
  "Account Monthly Task",
  "Buyer Detail",
  "Portfolio Categories",
  "Alibaba Packages",
  "Departments",
] as const;

type AttributeRow = {
  id: string;
  name: string;
  amount?: string | null;
  dateLabel?: string | null;
  branch?: string | null;
};

export function AttributesPage() {
  const [selectedCategory, setSelectedCategory] = useState<string>(ATTRIBUTE_CATEGORIES[0]);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [newItemName, setNewItemName] = useState("");
  const [newItemAmount, setNewItemAmount] = useState("");
  const [newItemDateLabel, setNewItemDateLabel] = useState("");
  const [newItemBranch, setNewItemBranch] = useState("");
  const queryClient = useQueryClient();

  const isBranchCategory = selectedCategory === "Company Branch";
  const isServiceCategory = selectedCategory === "Service for Quotation";
  const isQaCategory = selectedCategory === "Q & A";
  const isPenaltyCategory = selectedCategory === "Penalty Head";
  const isGovtLeaveCategory = selectedCategory === "Govt Leave";
  const isAccountTaskCategory = selectedCategory === "Account Monthly Task";
  const isBuyerDetailCategory = selectedCategory === "Buyer Detail";
  const isDepartmentCategory = selectedCategory === "Departments";

  const listEnabled = !isServiceCategory && !isQaCategory && !isBuyerDetailCategory && !isDepartmentCategory;

  const { data: attributes = [], isLoading, isError, refetch } = useQuery<AttributeRow[]>({
    queryKey: isBranchCategory ? ["/api/drm/branches", "all"] : ["/api/attributes", selectedCategory],
    queryFn: async () => {
      if (isBranchCategory) {
        const res = await apiRequest("GET", "/api/drm/branches?includeInactive=true");
        const body = await res.json();
        return (body.data ?? []).map((b: { id: string; name: string }) => ({ id: b.id, name: b.name }));
      }
      const res = await apiRequest("GET", `/api/attributes/${encodeURIComponent(selectedCategory)}`);
      return res.json();
    },
    enabled: listEnabled,
  });

  const addMutation = useMutation({
    mutationFn: async (input: { name: string; amount?: string; dateLabel?: string; branch?: string }) =>
      isBranchCategory
        ? mutationRequest("POST", "/api/drm/branches", { name: input.name })
        : mutationRequest("POST", "/api/attributes", {
            category: selectedCategory,
            name: input.name,
            ...(isPenaltyCategory && input.amount ? { amount: input.amount } : {}),
            ...((isGovtLeaveCategory || isAccountTaskCategory) && input.dateLabel ? { dateLabel: input.dateLabel } : {}),
            ...(isAccountTaskCategory && input.branch ? { branch: input.branch } : {}),
          }),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: isBranchCategory ? ["/api/drm/branches"] : ["/api/attributes", selectedCategory],
      });
      setNewItemName("");
      setNewItemAmount("");
      setNewItemDateLabel("");
      setNewItemBranch("");
      setIsAddOpen(false);
      toast.success("Item added.");
    },
    onError: (error: Error) => toast.error(error.message || "Failed to add item."),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await mutationRequest("DELETE", isBranchCategory ? `/api/drm/branches/${id}` : `/api/attributes/${id}`);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: isBranchCategory ? ["/api/drm/branches"] : ["/api/attributes", selectedCategory],
      });
      setDeleteId(null);
      toast.success("Item removed.");
    },
    onError: (error: Error) => toast.error(error.message || "Failed to delete item."),
  });

  const nameHeader = isPenaltyCategory ? "Name" : "Title";

  const columns = useMemo((): DataTableColumn<AttributeRow>[] => {
    const cols: DataTableColumn<AttributeRow>[] = [
      {
        id: "name",
        header: nameHeader,
        cell: (row) => <span className="font-medium">{row.name}</span>,
      },
    ];
    if (isAccountTaskCategory) {
      cols.push({
        id: "branch",
        header: "Branch",
        cell: (row) => row.branch ?? "—",
        className: "text-zinc-600 dark:text-zinc-400",
      });
    }
    if (isGovtLeaveCategory || isAccountTaskCategory) {
      cols.push({
        id: "date",
        header: "Date",
        cell: (row) => (
          <span className="font-medium text-amber-800 dark:text-amber-200">{row.dateLabel ?? "—"}</span>
        ),
      });
    }
    if (isPenaltyCategory) {
      cols.push({
        id: "amount",
        header: "Amount",
        cell: (row) => (
          <span className="font-medium text-amber-800 dark:text-amber-200">{row.amount ?? "—"}</span>
        ),
      });
    }
    cols.push({
      id: "actions",
      header: "",
      headerClassName: "w-14 text-right",
      className: "text-right",
      cell: (row) => (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="text-red-600 hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-950/40"
          aria-label={`Delete ${row.name}`}
          onClick={() => setDeleteId(row.id)}
        >
          <FiTrash2 className="h-4 w-4" />
        </Button>
      ),
    });
    return cols;
  }, [isAccountTaskCategory, isGovtLeaveCategory, isPenaltyCategory, nameHeader]);

  const specialView =
    isServiceCategory ? (
      <ServiceCatalogTree />
    ) : isQaCategory ? (
      <QaAttributeTree />
    ) : isBuyerDetailCategory ? (
      <BuyerDetailTree />
    ) : isDepartmentCategory ? (
      <DepartmentsManager />
    ) : null;

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="DRM Setting"
        title="Attributes"
        description="Manage lookup lists and hierarchies used across customers, projects, and quotations."
        actions={
          listEnabled ? (
            <Button type="button" variant="primary" size="sm" onClick={() => setIsAddOpen(true)}>
              <FiPlus className="mr-1.5 h-4 w-4" />
              Add {selectedCategory}
            </Button>
          ) : null
        }
      />

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
        <DrmCategoryNav
          categories={ATTRIBUTE_CATEGORIES}
          selected={selectedCategory}
          onSelect={setSelectedCategory}
          label="Attribute"
        />

        <Card className="min-w-0 flex-1 !p-0">
          <div className="border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{selectedCategory}</h2>
              {listEnabled && !isLoading ? (
                <Badge variant="neutral">{attributes.length} items</Badge>
              ) : null}
            </div>
          </div>

          <div className="p-4">
            {specialView ?? (
              <DataTable
                caption={`${selectedCategory} attributes`}
                columns={columns}
                rows={attributes}
                rowKey={(r) => r.id}
                loading={isLoading}
                error={isError ? "Could not load attributes." : null}
                onRetry={() => void refetch()}
                emptyMessage="No items yet. Use Add to create the first entry."
              />
            )}
          </div>
        </Card>
      </div>

      <DrmFormModal
        open={isAddOpen}
        title={`Add ${selectedCategory}`}
        onClose={() => setIsAddOpen(false)}
        footer={
          <>
            <Button type="button" variant="secondary" onClick={() => setIsAddOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="primary"
              disabled={!newItemName.trim() || addMutation.isPending}
              onClick={() =>
                addMutation.mutate({
                  name: newItemName,
                  amount: newItemAmount.trim(),
                  dateLabel: newItemDateLabel.trim(),
                  branch: newItemBranch.trim(),
                })
              }
            >
              {addMutation.isPending ? "Adding…" : "Add item"}
            </Button>
          </>
        }
      >
        <Field id="attr-name" label="Name">
          <Input
            id="attr-name"
            placeholder="Enter name…"
            value={newItemName}
            onChange={(e) => setNewItemName(e.target.value)}
          />
        </Field>
        {isPenaltyCategory ? (
          <Field id="attr-amount" label="Amount">
            <Input
              id="attr-amount"
              type="number"
              placeholder="Default deduction amount"
              value={newItemAmount}
              onChange={(e) => setNewItemAmount(e.target.value)}
            />
          </Field>
        ) : null}
        {isAccountTaskCategory ? (
          <Field id="attr-branch" label="Branch">
            <Input
              id="attr-branch"
              placeholder="Branch name"
              value={newItemBranch}
              onChange={(e) => setNewItemBranch(e.target.value)}
            />
          </Field>
        ) : null}
        {isGovtLeaveCategory || isAccountTaskCategory ? (
          <Field id="attr-date" label="Date label">
            <Input
              id="attr-date"
              placeholder={isGovtLeaveCategory ? "e.g. 01 May" : "Day of month, e.g. 15"}
              value={newItemDateLabel}
              onChange={(e) => setNewItemDateLabel(e.target.value)}
            />
          </Field>
        ) : null}
      </DrmFormModal>

      <ConfirmDialog
        open={deleteId !== null}
        title="Delete this item?"
        description="This cannot be undone. Other records may still reference this value."
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
