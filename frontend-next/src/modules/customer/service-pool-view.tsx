"use client";

import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { PageHeader } from "@/components/ui/page-header";
import { PageError, PageLoading } from "@/components/ui/page-states";
import { useApiResource } from "@/lib/hooks/use-api-resource";
import { apiFetch } from "@/lib/api/browser-client";
import { toast } from "@/lib/toast";
import { FollowupModal } from "./followup-modal";
import { HiOutlineEye, HiOutlineUserPlus } from "react-icons/hi2";
import { cn } from "@/lib/utils/cn";

type ServicePoolSummary = {
  allInService: number;
  dropoutIn1Year: number;
  dropoutMoreThan1Year: number;
  currentQ: number;
  duplicateData: number;
};

type ServicePoolEntry = {
  id: string;
  customerId: string;
  drmId: string | null;
  companyName: string;
  serviceCode: string | null;
  subserviceCode: string | null;
  salesPersonName: string | null;
  servicePersonName: string | null;
  servicePersonId: string | null;
  taPersonName: string | null;
  accountHolder: string | null;
  contactNo: string | null;
  bvDate: string | null;
};

type UserOption = { id: string; name?: string | null; full_name?: string | null; fullName?: string | null; role?: string; roles?: string[]; email?: string };

function userLabel(u: UserOption): string {
  return u.fullName || u.name || u.full_name || u.email || u.id;
}

function useCanAssignServicePool() {
  const [canAssign, setCanAssign] = useState(false);
  useEffect(() => {
    const roleStr = sessionStorage.getItem("activeRoleId") || sessionStorage.getItem("userRole") || "";
    const normalizedRole = roleStr.toLowerCase().replace(/\s+/g, "_");
    setCanAssign(
      normalizedRole.includes("manager") ||
        normalizedRole.includes("admin") ||
        normalizedRole === "super_hod" ||
        normalizedRole === "hod",
    );
  }, []);
  return canAssign;
}

function AssignServicePoolDialog({
  entry,
  onClose,
  onSaved,
}: {
  entry: ServicePoolEntry | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const open = !!entry;
  const [assignTo, setAssignTo] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (entry) setAssignTo(entry.servicePersonId || "");
  }, [entry]);

  const usersPath = open ? "/api/users?role=all" : null;
  const { data: usersResponse, loading } = useApiResource<{ users: UserOption[] }>(usersPath);

  const userOptions = (usersResponse?.users ?? []).filter((u) => {
    return u.role === "service_executive" || (Array.isArray(u.roles) && u.roles.includes("service_executive"));
  });

  if (!open || !entry) return null;

  const save = async () => {
    if (!assignTo) return;
    setSaving(true);
    try {
      await apiFetch(`/api/sales/service-pool/${entry.id}/assign`, {
        method: "PATCH",
        json: { servicePersonId: assignTo },
      });
      toast.success("Customer assigned successfully.");
      onSaved();
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not assign.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <dialog open className="fixed inset-0 z-50 m-auto max-w-md rounded-xl border border-zinc-200 bg-white p-6 shadow-xl dark:border-zinc-700 dark:bg-zinc-900">
      <h3 className="text-base font-semibold">Assign Customer</h3>
      <div className="mt-4 space-y-3">
        <label className="block text-sm">
          Company
          <Input readOnly value={entry.companyName} className="mt-1 bg-zinc-50 dark:bg-zinc-800" />
        </label>
        <label className="block text-sm">
          User
          <Select
            className="mt-1 w-full"
            value={assignTo}
            onChange={(e) => setAssignTo(e.target.value)}
            disabled={loading}
          >
            <option value="">Choose…</option>
            {userOptions.map((u) => (
              <option key={u.id} value={u.id}>
                {userLabel(u)}
              </option>
            ))}
          </Select>
        </label>
      </div>
      <div className="mt-6 flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onClose}>
          Close
        </Button>
        <Button type="button" disabled={!assignTo || saving} onClick={() => void save()}>
          {saving ? "Saving…" : "Save"}
        </Button>
      </div>
    </dialog>
  );
}

export function ServicePoolView() {
  const canAssign = useCanAssignServicePool();
  const [page, setPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeFilter, setActiveFilter] = useState<string>("allInService");
  const [selectedEntry, setSelectedEntry] = useState<ServicePoolEntry | null>(null);
  const [followupEntry, setFollowupEntry] = useState<ServicePoolEntry | null>(null);
  const [listTick, setListTick] = useState(0);
  const pageSize = 10;

  const { data: summary } = useApiResource<ServicePoolSummary>("/api/sales/service-pool/summary");

  const listPath = useMemo(() => {
    const params = new URLSearchParams();
    params.set("page", String(page));
    params.set("pageSize", String(pageSize));
    if (searchTerm) params.set("search", searchTerm);
    if (activeFilter === "allInService") params.set("status", "active");
    else if (activeFilter === "dropoutIn1Year") params.set("dropoutCategory", "dropout_in_1_year");
    else if (activeFilter === "dropoutMoreThan1Year") params.set("dropoutCategory", "dropout_more_than_1_year");
    else if (activeFilter === "duplicateData") params.set("duplicates", "true");
    else if (activeFilter === "currentQ") params.set("currentQ", "true");
    params.set("_", String(listTick));
    return `/api/sales/service-pool/list?${params.toString()}`;
  }, [page, searchTerm, activeFilter, listTick]);

  const { data: listData, loading, error, refetch } = useApiResource<{ items: ServicePoolEntry[]; total: number }>(
    listPath,
  );

  const filters = [
    { key: "dropoutIn1Year", label: "Dropout In 1-Year", count: summary?.dropoutIn1Year || 0 },
    { key: "dropoutMoreThan1Year", label: "Dropout More Than 1-Year", count: summary?.dropoutMoreThan1Year || 0 },
    { key: "currentQ", label: "Current Q", count: summary?.currentQ || 0 },
    { key: "allInService", label: "All In Service", count: summary?.allInService || 0 },
    { key: "duplicateData", label: "Service Pool Duplicate Data", count: summary?.duplicateData || 0 },
  ];

  const total = listData?.total ?? 0;
  const items = listData?.items ?? [];
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const exportRows = async () => {
    const params = new URLSearchParams(listPath.split("?")[1] || "");
    params.set("page", "1");
    params.set("pageSize", "10000");
    params.delete("_");
    const data = await apiFetch<{ items: ServicePoolEntry[] }>(`/api/sales/service-pool/list?${params.toString()}`);
    return data.items ?? [];
  };

  const handleCopy = async () => {
    try {
      const data = await exportRows();
      if (!data.length) return;
      const header = "#\tDRM ID\tCompany\tSale Person\tService Person\tTA Person\tAcc Holder\tContact No\n";
      const text = data
        .map(
          (d, i) =>
            `${i + 1}\t${d.drmId || "-"}\t${d.companyName}\t${d.salesPersonName || "-"}\t${d.servicePersonName || "-"}\t${d.taPersonName || "-"}\t${d.accountHolder || "-"}\t${d.contactNo || "-"}`,
        )
        .join("\n");
      await navigator.clipboard.writeText(header + text);
      toast.success("Copied to clipboard.");
    } catch {
      toast.error("Failed to copy.");
    }
  };

  const handleCsv = async () => {
    try {
      const data = await exportRows();
      if (!data.length) return;
      const header = ["#", "DRM ID", "Company", "Sale Person", "Service Person", "TA Person", "Acc Holder", "Contact No"];
      const rows = data.map((d, i) =>
        [i + 1, d.drmId || "-", d.companyName, d.salesPersonName || "-", d.servicePersonName || "-", d.taPersonName || "-", d.accountHolder || "-", d.contactNo || "-"]
          .map((c) => `"${String(c).replace(/"/g, '""')}"`)
          .join(","),
      );
      const blob = new Blob([[header.join(","), ...rows].join("\n")], { type: "text/csv;charset=utf-8;" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = "ServicePool.csv";
      link.click();
    } catch {
      toast.error("Failed to export CSV.");
    }
  };

  return (
    <Card>
      <PageHeader eyebrow="Customer" title="Service Pool" description="In-service customers, tracing filters, and assignments." />

      <div className="mb-4 space-y-2">
        <label className="text-xs font-semibold text-zinc-600 dark:text-zinc-400">Search Customer</label>
        <Input
          placeholder="Enter company name/mobile/email"
          value={searchTerm}
          onChange={(e) => {
            setSearchTerm(e.target.value);
            setPage(1);
          }}
        />
      </div>

      <div className="mb-4 flex flex-wrap gap-2 border-b border-zinc-200 pb-4 dark:border-zinc-800">
        {filters.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => {
              setActiveFilter(f.key);
              setPage(1);
            }}
            className={cn(
              "flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium",
              activeFilter === f.key
                ? "border-zinc-400 bg-zinc-200 dark:border-zinc-500 dark:bg-zinc-800"
                : "border-transparent bg-zinc-100 dark:bg-zinc-800/50",
            )}
          >
            {f.label}
            <Badge variant="warning">{f.count}</Badge>
          </button>
        ))}
      </div>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex overflow-hidden rounded-lg bg-zinc-600 text-xs font-semibold text-white">
          <button type="button" className="border-r border-zinc-500 px-3 py-2 hover:bg-zinc-500" onClick={() => void handleCopy()}>
            Copy
          </button>
          <button type="button" className="px-3 py-2 hover:bg-zinc-500" onClick={() => void handleCsv()}>
            CSV
          </button>
        </div>
        <Badge variant="neutral">{total} records</Badge>
      </div>

      {error ? (
        <PageError message={error} onRetry={refetch} />
      ) : loading ? (
        <PageLoading label="Loading service pool…" />
      ) : (
        <>
          <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
            <table className="w-full min-w-[1100px] text-left text-sm">
              <thead className="bg-zinc-50 dark:bg-zinc-900/80">
                <tr>
                  {["#", "DRM ID", "Company", "Service", "Sale Person", "Service Person", "TA Person", "Acc Holder", "Contact No", "BV-Date", "Action"].map(
                    (h) => (
                      <th key={h} className="px-3 py-3 font-semibold text-zinc-700 dark:text-zinc-200">
                        {h}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="px-4 py-10 text-center text-zinc-500">
                      No records found.
                    </td>
                  </tr>
                ) : (
                  items.map((row, index) => (
                    <tr key={row.id} className="border-t border-zinc-100 dark:border-zinc-800">
                      <td className="px-3 py-2">{(page - 1) * pageSize + index + 1}</td>
                      <td className="px-3 py-2">
                        <button
                          type="button"
                          className="font-medium text-emerald-700 hover:underline dark:text-emerald-400"
                          onClick={() => setFollowupEntry(row)}
                        >
                          {row.drmId || "-"}
                        </button>
                      </td>
                      <td className="px-3 py-2 font-semibold">{row.companyName}</td>
                      <td className="px-3 py-2 text-xs">
                        {row.serviceCode ? (
                          <>
                            <div>{row.serviceCode.replace(/_/g, " ")}</div>
                            {row.subserviceCode ? (
                              <div className="text-zinc-500">{row.subserviceCode.replace(/_/g, " ")}</div>
                            ) : null}
                          </>
                        ) : (
                          "-"
                        )}
                      </td>
                      <td className="px-3 py-2">{row.salesPersonName || "-"}</td>
                      <td className="px-3 py-2">{row.servicePersonName || "-"}</td>
                      <td className="px-3 py-2">{row.taPersonName || "-"}</td>
                      <td className="px-3 py-2">{row.accountHolder || "-"}</td>
                      <td className="px-3 py-2">{row.contactNo || "-"}</td>
                      <td className="px-3 py-2">
                        <Badge variant={row.bvDate ? "success" : "neutral"}>{row.bvDate ? "Complete" : "Pending"}</Badge>
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex items-center justify-center gap-2">
                          <a
                            href={`/customers/attribute/${row.customerId}`}
                            title="View Attribute"
                            className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-emerald-600 text-white hover:bg-emerald-700"
                          >
                            <HiOutlineEye className="h-4 w-4" />
                          </a>
                          {canAssign ? (
                            <button
                              type="button"
                              title="Manage"
                              className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-blue-600 text-white hover:bg-blue-700"
                              onClick={() => setSelectedEntry(row)}
                            >
                              <HiOutlineUserPlus className="h-4 w-4" />
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex items-center justify-between text-sm text-zinc-600 dark:text-zinc-400">
            <span>
              Showing {(page - 1) * pageSize + 1} to {Math.min(page * pageSize, total)} of {total} entries
            </span>
            <div className="flex gap-2">
              <Button type="button" variant="secondary" size="sm" disabled={page === 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
                Previous
              </Button>
              <span className="flex items-center px-2 font-medium">{page}</span>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                Next
              </Button>
            </div>
          </div>
        </>
      )}

      <AssignServicePoolDialog
        entry={selectedEntry}
        onClose={() => setSelectedEntry(null)}
        onSaved={() => setListTick((n) => n + 1)}
      />

      <FollowupModal
        open={!!followupEntry}
        onClose={() => setFollowupEntry(null)}
        customerId={followupEntry?.customerId}
        companyName={followupEntry?.companyName}
      />
    </Card>
  );
}
