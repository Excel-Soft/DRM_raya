"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { PageError, PageLoading } from "@/components/ui/page-states";
import { useApiResource } from "@/lib/hooks/use-api-resource";
import { apiFetch } from "@/lib/api/browser-client";
import { toast } from "@/lib/toast";
import { FollowupModal } from "./followup-modal";
import {
  GRADE_TRACE_TABS,
  poolApiParam,
  poolTitle,
  TRACING_SERVICE_TABS,
  type LeadPoolMode,
  type LeadPoolPageMeta,
} from "./lead-pool-tracing";
import { cn } from "@/lib/utils/cn";
import { HiOutlineUserPlus } from "react-icons/hi2";

type PoolRow = {
  id: string;
  drmId?: string;
  companyName?: string;
  salesPersonName?: string;
  accountName?: string;
  email?: string;
  phone?: string;
  ntn?: string;
  cnic?: string;
  createdAt?: string;
};

type ListResponse = { items: PoolRow[]; total?: number };

export function ServiceLeadPoolView({
  mode,
  pageMeta,
}: {
  mode: LeadPoolMode;
  pageMeta?: LeadPoolPageMeta;
}) {
  const [searchCustomer, setSearchCustomer] = useState("");
  const [serviceFilter, setServiceFilter] = useState("all");
  const [gradeFilter, setGradeFilter] = useState("all");
  const [listTick, setListTick] = useState(0);
  const [followTarget, setFollowTarget] = useState<{ id: string; name: string } | null>(null);
  const [claimTarget, setClaimTarget] = useState<PoolRow | null>(null);
  const [claiming, setClaiming] = useState(false);

  const poolParam = poolApiParam(mode);

  const tracingPath = useMemo(() => {
    const params = new URLSearchParams({ pool: poolParam });
    if (serviceFilter !== "all") params.set("serviceFilter", serviceFilter);
    return `/api/sales/tracing/summary?${params.toString()}`;
  }, [poolParam, serviceFilter]);

  const { data: tracingSummary } = useApiResource<Record<string, number>>(tracingPath);

  const listPath = useMemo(() => {
    const params = new URLSearchParams({
      pool: poolParam,
      page: "1",
      pageSize: "50",
    });
    if (searchCustomer.trim()) params.set("search", searchCustomer.trim());
    if (gradeFilter !== "all") params.set("grade", gradeFilter);
    if (serviceFilter !== "all") params.set("serviceFilter", serviceFilter);
    if (listTick > 0) params.set("refresh", String(listTick));
    return `/api/sales/lead-pools/list?${params.toString()}`;
  }, [poolParam, searchCustomer, gradeFilter, serviceFilter, listTick]);

  const { data: listData, loading, error, refetch } = useApiResource<ListResponse>(listPath);
  const displayData = listData?.items ?? [];

  const confirmClaim = async () => {
    if (!claimTarget) return;
    setClaiming(true);
    try {
      await apiFetch("/api/pools/claim", { method: "POST", json: { customerId: claimTarget.id } });
      toast.success("Customer moved to your Private Pool.");
      setClaimTarget(null);
      setListTick((n) => n + 1);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to pick customer.");
    } finally {
      setClaiming(false);
    }
  };

  const logAction = async (customerId: string, action: string, meta?: Record<string, unknown>) => {
    try {
      await apiFetch(`/api/sales/leads/${customerId}/actions`, { method: "POST", json: { action, meta } });
    } catch {
      /* non-blocking */
    }
  };

  return (
    <Card>
      <PageHeader
        eyebrow={pageMeta?.eyebrow ?? "Customer"}
        title={pageMeta?.title ?? poolTitle(mode)}
        description={pageMeta?.description ?? "Service role pool view (tracing filters and lead list)."}
      />

      <div className="mb-4">
        <label className="mb-1 block text-xs font-semibold text-zinc-600">Search Customer</label>
        <Input
          placeholder="Enter company name/mobile/email"
          value={searchCustomer}
          onChange={(e) => setSearchCustomer(e.target.value)}
        />
      </div>

      <p className="mb-2 text-xs font-bold uppercase text-zinc-500">Tracing</p>
      <div className="mb-3 flex flex-wrap gap-1">
        {TRACING_SERVICE_TABS.map((tab) => {
          const count = tracingSummary?.[tab.labelKey] ?? 0;
          const active = serviceFilter === tab.listServiceFilter;
          return (
            <button
              key={tab.labelKey}
              type="button"
              onClick={() => setServiceFilter(active ? "all" : tab.listServiceFilter)}
              className={cn("flex-1 min-w-[140px] rounded py-2 text-xs font-bold text-white", active ? "bg-emerald-700" : tab.color)}
            >
              {tab.label} {count}
            </button>
          );
        })}
      </div>

      <div className="mb-4 flex flex-wrap gap-1">
        {GRADE_TRACE_TABS.map((g) => {
          const count = tracingSummary?.[g] ?? 0;
          const active = gradeFilter === g;
          return (
            <button
              key={g}
              type="button"
              onClick={() => setGradeFilter(active ? "all" : g)}
              className={cn(
                "flex-1 min-w-[60px] rounded py-1.5 text-xs font-bold text-white",
                active ? "bg-emerald-800" : "bg-zinc-500",
              )}
            >
              {g} {count}
            </button>
          );
        })}
      </div>

      {error ? (
        <PageError message={error} onRetry={refetch} />
      ) : loading ? (
        <PageLoading label="Loading customers…" />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
          <table className="w-full min-w-[1000px] text-left text-xs">
            <thead className="bg-zinc-50 dark:bg-zinc-900/80">
              <tr>
                {["DRM ID", "Co Name", "Sale Person", "Acc Holder", "Email", "Contact", "NTN", "CNIC", "Created", "Action"].map(
                  (h) => (
                    <th key={h} className="px-3 py-3 font-semibold">
                      {h}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {displayData.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-4 py-10 text-center text-zinc-500">
                    No customers found.
                  </td>
                </tr>
              ) : (
                displayData.map((row) => (
                  <tr
                    key={row.id}
                    className="cursor-pointer border-t border-zinc-100 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900/50"
                    onClick={() => setFollowTarget({ id: row.id, name: row.companyName || "Unknown" })}
                  >
                    <td className="px-3 py-2 font-semibold text-emerald-600">{row.drmId || row.id.slice(0, 8)}</td>
                    <td className="px-3 py-2 font-medium">{row.companyName}</td>
                    <td className="px-3 py-2">{row.salesPersonName || "—"}</td>
                    <td className="px-3 py-2">{row.accountName || "—"}</td>
                    <td className="px-3 py-2">{row.email || "—"}</td>
                    <td className="px-3 py-2">{row.phone || "—"}</td>
                    <td className="px-3 py-2">{row.ntn || "—"}</td>
                    <td className="px-3 py-2">{row.cnic || "—"}</td>
                    <td className="px-3 py-2">
                      {row.createdAt ? new Date(row.createdAt).toLocaleDateString() : "—"}
                    </td>
                    <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                      <div className="flex flex-wrap gap-1">
                        <Link href={`/customers/attribute/${row.id}`} className="rounded bg-emerald-600 px-2 py-1 text-white hover:bg-emerald-700">
                          View
                        </Link>
                        <Button type="button" size="sm" variant="secondary" onClick={() => setFollowTarget({ id: row.id, name: row.companyName || "" })}>
                          Follow
                        </Button>
                        {row.email ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              void logAction(row.id, "email", { email: row.email });
                              window.location.href = `mailto:${row.email}`;
                            }}
                          >
                            Email
                          </Button>
                        ) : null}
                        {mode === "public" ? (
                          <Button type="button" size="sm" onClick={() => setClaimTarget(row)}>
                            <HiOutlineUserPlus className="h-3 w-3" />
                          </Button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {claimTarget ? (
        <dialog open className="fixed inset-0 z-50 m-auto max-w-md rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-700 dark:bg-zinc-900">
          <h3 className="font-semibold">Pick {claimTarget.companyName}</h3>
          <div className="mt-4 flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setClaimTarget(null)}>
              Cancel
            </Button>
            <Button type="button" disabled={claiming} onClick={() => void confirmClaim()}>
              {claiming ? "…" : "Confirm pick"}
            </Button>
          </div>
        </dialog>
      ) : null}

      <FollowupModal
        open={!!followTarget}
        onClose={() => {
          setFollowTarget(null);
          setListTick((n) => n + 1);
        }}
        customerId={followTarget?.id}
        companyName={followTarget?.name}
      />
    </Card>
  );
}
