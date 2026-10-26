"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
import { LeadPoolDashboardChrome, type LeadPoolSummaryResponse } from "./lead-pool-dashboard-chrome";
import { CUSTOMER_ADD_CUSTOMER, customerCreateInvoicePath } from "@/lib/navigation/customer-routes";
import {
  GRADE_TRACE_TABS,
  poolApiParam,
  poolTitle,
  TRACING_SERVICE_TABS,
  type LeadPoolMode,
  type LeadPoolPageMeta,
} from "./lead-pool-tracing";
import { cn } from "@/lib/utils/cn";
import {
  HiOutlineArrowUpTray,
  HiOutlineClock,
  HiOutlineEnvelope,
  HiOutlineEye,
  HiOutlinePhone,
  HiOutlinePrinter,
  HiOutlineUser,
  HiOutlineUserPlus,
} from "react-icons/hi2";

type PoolRow = {
  id: string;
  drmId?: string;
  companyName?: string;
  company?: string;
  salesPersonName?: string;
  accountName?: string;
  email?: string;
  phone?: string;
  mobile?: string;
  grade?: string;
  createdAt?: string;
  ntn?: string | null;
  cnic?: string | null;
};

function formatPoolDate(val?: string) {
  if (!val) return "—";
  const d = new Date(val);
  return Number.isNaN(d.getTime())
    ? "—"
    : d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function cleanIdField(val?: string | null) {
  if (!val || String(val).toLowerCase() === "null") return "—";
  return val;
}

type ListResponse = { items: PoolRow[]; total: number; page?: number; pageSize?: number };

export function SalesLeadPoolView({
  mode,
  pageMeta,
}: {
  mode: LeadPoolMode;
  pageMeta?: LeadPoolPageMeta;
}) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [gradeFilter, setGradeFilter] = useState("all");
  const [serviceFilter, setServiceFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [listTick, setListTick] = useState(0);
  const [followTarget, setFollowTarget] = useState<{ id: string; name: string } | null>(null);
  const [claimTarget, setClaimTarget] = useState<PoolRow | null>(null);
  const [claiming, setClaiming] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const pageSize = 25;

  const { data: poolSummary } = useApiResource<LeadPoolSummaryResponse>(
    mode === "private" ? "/api/sales/lead-pools/summary" : null,
  );

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedSearch(search.trim()), 400);
    return () => window.clearTimeout(t);
  }, [search]);

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
      page: String(page),
      pageSize: String(pageSize),
    });
    if (debouncedSearch) params.set("search", debouncedSearch);
    if (gradeFilter !== "all" && !debouncedSearch) params.set("grade", gradeFilter);
    if (serviceFilter !== "all") params.set("serviceFilter", serviceFilter);
    if (statusFilter) params.set("statusFilter", statusFilter);
    if (listTick > 0) params.set("refresh", String(listTick));
    return `/api/sales/lead-pools/list?${params.toString()}`;
  }, [poolParam, page, pageSize, debouncedSearch, gradeFilter, serviceFilter, statusFilter, listTick]);

  const { data: listData, loading, error, refetch } = useApiResource<ListResponse>(listPath);
  const items = listData?.items ?? [];
  const total = listData?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const invalidateList = () => setListTick((n) => n + 1);

  const confirmClaim = async () => {
    if (!claimTarget) return;
    setClaiming(true);
    try {
      await apiFetch("/api/pools/claim", { method: "POST", json: { customerId: claimTarget.id } });
      toast.success("Customer moved to your Private Pool.");
      setClaimTarget(null);
      invalidateList();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to pick customer.");
    } finally {
      setClaiming(false);
    }
  };

  const moveToPublic = async (row: PoolRow) => {
    try {
      await apiFetch(`/api/sales/customers/${row.id}/pick`, { method: "POST", json: {} });
      toast.success("Customer moved to Public Pool.");
      invalidateList();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to move customer.");
    }
  };

  const pickupAddCustomer = (row: PoolRow) => {
    sessionStorage.setItem("pickupPublicPool", JSON.stringify(row));
    router.push(`${CUSTOMER_ADD_CUSTOMER}?fromPublicPool=true`);
  };

  return (
    <Card>
      <PageHeader
        eyebrow={pageMeta?.eyebrow ?? "Customer"}
        title={pageMeta?.title ?? poolTitle(mode)}
        description={
          pageMeta?.description ??
          (mode === "public"
            ? "Browse unassigned leads and pick customers into your private pool."
            : "Your assigned leads — search, follow up, or release to public pool.")
        }
      />

      {mode === "private" ? (
        <LeadPoolDashboardChrome
          summary={poolSummary}
          statusFilter={statusFilter}
          onStatusFilter={(s) => {
            setStatusFilter(s);
            setPage(1);
          }}
          activePool="private"
        />
      ) : null}

      <div className="mb-4">
        <label className="mb-1 block text-xs font-semibold text-zinc-600 dark:text-zinc-400">Search Customer</label>
        <Input
          placeholder="Company name, mobile, or email"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
        />
      </div>

      <p className="mb-2 text-xs font-bold uppercase tracking-wide text-zinc-500">Tracing — service</p>
      <div className="mb-3 flex flex-wrap gap-1">
        {TRACING_SERVICE_TABS.map((tab) => {
          const count = tracingSummary?.[tab.labelKey] ?? 0;
          const active = serviceFilter === tab.listServiceFilter;
          return (
            <button
              key={tab.labelKey}
              type="button"
              onClick={() => {
                setServiceFilter(active ? "all" : tab.listServiceFilter);
                setPage(1);
              }}
              className={cn(
                "rounded px-3 py-2 text-xs font-bold text-white",
                active ? "ring-2 ring-emerald-400 ring-offset-1" : tab.color,
              )}
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
              onClick={() => {
                setGradeFilter(active ? "all" : g);
                setPage(1);
              }}
              className={cn(
                "rounded px-2 py-1 text-xs font-semibold",
                active
                  ? "bg-emerald-700 text-white"
                  : "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200",
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
        <>
          <div className="mb-2 flex items-center justify-between">
            <Badge variant="neutral">{total} records</Badge>
          </div>
          <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
            <table className="w-full min-w-[1280px] text-left text-xs">
              <thead className="bg-zinc-50 dark:bg-zinc-900/80">
                <tr>
                  {[
                    "DRM ID",
                    "Co Name",
                    "Sale Person",
                    "Acc Holder",
                    "Email",
                    "Contact No",
                    "NTN",
                    "CNIC",
                    "Account Create Date",
                    "Action",
                  ].map((h) => (
                    <th key={h} className="whitespace-nowrap px-2 py-3 text-[10px] font-bold uppercase">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="px-4 py-10 text-center text-zinc-500">
                      No customers found.
                    </td>
                  </tr>
                ) : (
                  items.map((row) => {
                    const name = row.companyName || row.company || "Unknown";
                    const phone = row.phone || row.mobile || "";
                    const email = row.email || "";
                    const wa = phone ? phone.replace(/\D/g, "") : "";
                    return (
                      <tr
                        key={row.id}
                        className="cursor-pointer border-t border-zinc-100 hover:bg-zinc-50/80 dark:border-zinc-800 dark:hover:bg-zinc-900/40"
                        onClick={() => router.push(`/customers/attribute/${row.id}`)}
                      >
                        <td className="px-2 py-2 font-mono text-emerald-700 dark:text-emerald-400">{row.drmId || "—"}</td>
                        <td className="max-w-[140px] truncate px-2 py-2 font-semibold">{name}</td>
                        <td className="px-2 py-2">{row.salesPersonName || "—"}</td>
                        <td className="max-w-[120px] truncate px-2 py-2">{row.accountName || "—"}</td>
                        <td className="max-w-[160px] truncate px-2 py-2">{email || "—"}</td>
                        <td className="whitespace-nowrap px-2 py-2">{phone || "—"}</td>
                        <td className="px-2 py-2 text-center font-mono">{cleanIdField(row.ntn)}</td>
                        <td className="px-2 py-2 text-center font-mono">{cleanIdField(row.cnic)}</td>
                        <td className="whitespace-nowrap px-2 py-2">{formatPoolDate(row.createdAt)}</td>
                        <td className="px-2 py-2" onClick={(e) => e.stopPropagation()}>
                          <div className="flex flex-wrap items-center gap-0.5">
                            <Link
                              href={`/customers/attribute/${row.id}`}
                              title="Profile"
                              className="inline-flex h-7 w-7 items-center justify-center rounded hover:bg-zinc-200 dark:hover:bg-zinc-800"
                            >
                              <HiOutlineUser className="h-3.5 w-3.5" />
                            </Link>
                            <Link
                              href={`/customers/attribute/${row.id}`}
                              title="View"
                              className="inline-flex h-7 w-7 items-center justify-center rounded hover:bg-zinc-200 dark:hover:bg-zinc-800"
                            >
                              <HiOutlineEye className="h-3.5 w-3.5" />
                            </Link>
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              className="h-7 w-7 p-0"
                              title="Follow up"
                              onClick={() => setFollowTarget({ id: row.id, name })}
                            >
                              <HiOutlineClock className="h-3.5 w-3.5" />
                            </Button>
                            {email ? (
                              <a
                                href={`mailto:${email}`}
                                title="Email"
                                className="inline-flex h-7 w-7 items-center justify-center rounded hover:bg-zinc-200 dark:hover:bg-zinc-800"
                              >
                                <HiOutlineEnvelope className="h-3.5 w-3.5" />
                              </a>
                            ) : null}
                            {wa ? (
                              <a
                                href={`https://wa.me/${wa}`}
                                target="_blank"
                                rel="noreferrer"
                                title="WhatsApp"
                                className="inline-flex h-7 w-7 items-center justify-center rounded hover:bg-zinc-200 dark:hover:bg-zinc-800"
                              >
                                <span className="text-[10px] font-bold">WA</span>
                              </a>
                            ) : null}
                            {phone ? (
                              <a
                                href={`tel:${phone}`}
                                title="Call"
                                className="inline-flex h-7 w-7 items-center justify-center rounded hover:bg-zinc-200 dark:hover:bg-zinc-800"
                              >
                                <HiOutlinePhone className="h-3.5 w-3.5" />
                              </a>
                            ) : null}
                            <Link
                              href={customerCreateInvoicePath(String(row.id))}
                              title="Invoice"
                              className="rounded bg-emerald-600 px-1.5 py-0.5 text-[9px] font-bold uppercase text-white hover:bg-emerald-700"
                            >
                              Invoice
                            </Link>
                            <button
                              type="button"
                              title="Print"
                              className="inline-flex h-7 w-7 items-center justify-center rounded hover:bg-zinc-200 dark:hover:bg-zinc-800"
                              onClick={() => window.print()}
                            >
                              <HiOutlinePrinter className="h-3.5 w-3.5" />
                            </button>
                            {mode === "public" ? (
                              <>
                                <Button type="button" size="sm" className="h-7 px-2 text-[10px]" onClick={() => setClaimTarget(row)}>
                                  Pick
                                </Button>
                                <Button type="button" size="sm" variant="ghost" className="h-7 px-2 text-[10px]" onClick={() => pickupAddCustomer(row)}>
                                  Form
                                </Button>
                              </>
                            ) : (
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                className="h-7 w-7 p-0"
                                title="Move to public pool"
                                onClick={() => void moveToPublic(row)}
                              >
                                <HiOutlineArrowUpTray className="h-3.5 w-3.5" />
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex items-center justify-between text-sm">
            <span className="text-zinc-500">
              Page {page} of {totalPages} ({total} total)
            </span>
            <div className="flex gap-2">
              <Button type="button" variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                Previous
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        </>
      )}

      {claimTarget ? (
        <dialog open className="fixed inset-0 z-50 m-auto max-w-md rounded-xl border border-zinc-200 bg-white p-6 shadow-xl dark:border-zinc-700 dark:bg-zinc-900">
          <h3 className="text-lg font-semibold">Pick customer</h3>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            Move <strong>{claimTarget.companyName || claimTarget.company}</strong> to your Private Pool?
          </p>
          <div className="mt-6 flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setClaimTarget(null)}>
              Cancel
            </Button>
            <Button type="button" disabled={claiming} onClick={() => void confirmClaim()}>
              {claiming ? "Picking…" : "Confirm"}
            </Button>
          </div>
        </dialog>
      ) : null}

      <FollowupModal
        open={!!followTarget}
        onClose={() => {
          setFollowTarget(null);
          invalidateList();
        }}
        customerId={followTarget?.id}
        companyName={followTarget?.name}
      />
    </Card>
  );
}
