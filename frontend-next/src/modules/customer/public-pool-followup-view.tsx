"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { PageLoading } from "@/components/ui/page-states";
import { useApiResource } from "@/lib/hooks/use-api-resource";
import { apiFetch } from "@/lib/api/browser-client";
import { toast } from "@/lib/toast";
import { FollowupModal } from "./followup-modal";
import { HiOutlineChatBubbleLeftRight, HiOutlineEye } from "react-icons/hi2";
import { cn } from "@/lib/utils/cn";

const MAIN_SERVICE_NAMES: Record<string, string> = {
  "1": "Alibaba Membership",
  "2": "Alibaba Services",
  "3": "Design Development",
  "4": "Domain Hosting",
  "5": "AI Services",
};

type SubServiceRow = { name: string; count: number };

type CustomerRow = {
  id: string;
  com_id?: string;
  cname?: string;
  account_name?: string;
  email?: string;
  phone?: string;
  assigned_to?: string;
};

export function PublicPoolFollowupView() {
  const [selectedMainService, setSelectedMainService] = useState<string | null>(null);
  const [selectedSubService, setSelectedSubService] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [followTarget, setFollowTarget] = useState<{ id: string; name: string } | null>(null);
  const [customersTick, setCustomersTick] = useState(0);

  const { data: mainServices, loading: isLoadingMain } = useApiResource<Record<string, number>>(
    "/api/sales/public-pool-followup/main-services",
  );

  const subPath =
    selectedMainService !== null
      ? `/api/sales/public-pool-followup/sub-services?mainServiceId=${selectedMainService}`
      : null;
  const { data: subServices, loading: isLoadingSub } = useApiResource<SubServiceRow[]>(subPath);

  const customersPath =
    selectedSubService !== null
      ? `/api/sales/public-pool-followup/customers?subService=${encodeURIComponent(selectedSubService)}&page=${page}&_=${customersTick}`
      : null;
  const { data: customersData, loading: isLoadingCustomers } = useApiResource<{
    data: CustomerRow[];
    hasNextPage?: boolean;
  }>(customersPath);

  const claimLead = async (customerId: string) => {
    try {
      await apiFetch(`/api/sales/leads/${customerId}/assign`, { method: "POST", json: {} });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to claim this lead");
      throw e;
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <PageHeader
          eyebrow="Customer"
          title="Public Pool (Follow up)"
          description="View and follow-up with companies inactive for 60+ days."
        />
      </Card>

      <Card>
        <h2 className="mb-3 text-lg font-semibold">Main Services</h2>
        {isLoadingMain ? (
          <PageLoading label="Loading main services…" />
        ) : (
          <div className="flex flex-wrap gap-3">
            {Object.entries(MAIN_SERVICE_NAMES).map(([id, name]) => {
              const count = mainServices?.[id] || 0;
              const isSelected = selectedMainService === id;
              return (
                <Button
                  key={id}
                  type="button"
                  variant={isSelected ? "primary" : "secondary"}
                  onClick={() => {
                    setSelectedMainService(id);
                    setSelectedSubService(null);
                    setPage(1);
                  }}
                  className="min-w-[150px] justify-between"
                >
                  <span>{name}</span>
                  <Badge variant={isSelected ? "brand" : "neutral"} className="ml-2">
                    {count}
                  </Badge>
                </Button>
              );
            })}
          </div>
        )}
      </Card>

      {selectedMainService ? (
        <Card>
          <h2 className="mb-3 text-lg font-semibold">Sub Services</h2>
          {isLoadingSub ? (
            <PageLoading label="Loading sub services…" />
          ) : (
            <div className="flex flex-wrap gap-2">
              {(subServices ?? []).map((sub) => {
                const isSelected = selectedSubService === sub.name;
                return (
                  <button
                    key={sub.name}
                    type="button"
                    onClick={() => {
                      setSelectedSubService(sub.name);
                      setPage(1);
                    }}
                    className={cn(
                      "inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm",
                      isSelected
                        ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30"
                        : "border-zinc-200 dark:border-zinc-700",
                    )}
                  >
                    {sub.name}
                    <Badge variant="neutral">{sub.count}</Badge>
                  </button>
                );
              })}
            </div>
          )}
        </Card>
      ) : null}

      {selectedSubService ? (
        <Card>
          <h2 className="mb-3 text-lg font-semibold">Companies for {selectedSubService}</h2>
          {isLoadingCustomers ? (
            <PageLoading label="Loading companies…" />
          ) : (
            <>
              <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
                <table className="w-full min-w-[800px] text-left text-sm">
                  <thead className="bg-zinc-50 dark:bg-zinc-900/80">
                    <tr>
                      {["Company ID", "Co Name", "Acc Holder", "Email", "Contact No", "Assigned To", "Action"].map((h) => (
                        <th key={h} className="px-3 py-3 font-semibold">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(customersData?.data?.length ?? 0) === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-4 py-10 text-center text-zinc-500">
                          No companies found matching the criteria.
                        </td>
                      </tr>
                    ) : (
                      customersData?.data?.map((customer) => (
                        <tr key={customer.id} className="border-t border-zinc-100 dark:border-zinc-800">
                          <td className="px-3 py-2 font-medium text-blue-700 dark:text-blue-400">{customer.com_id || "-"}</td>
                          <td className="px-3 py-2">{customer.cname || "Unknown"}</td>
                          <td className="px-3 py-2">{customer.account_name || "-"}</td>
                          <td className="px-3 py-2">{customer.email || "-"}</td>
                          <td className="px-3 py-2">{customer.phone || "-"}</td>
                          <td className="px-3 py-2">{customer.assigned_to || "Unassigned"}</td>
                          <td className="space-x-2 px-3 py-2 text-right">
                            <a
                              href={`/sales/customers/${customer.id}`}
                              className="inline-flex items-center gap-1 rounded-lg border border-zinc-200 px-2 py-1 text-xs dark:border-zinc-700"
                            >
                              <HiOutlineEye className="h-4 w-4" /> View
                            </a>
                            <Button type="button" size="sm" onClick={() => setFollowTarget({ id: customer.id, name: customer.cname || "Unknown" })}>
                              <HiOutlineChatBubbleLeftRight className="mr-1 h-4 w-4" />
                              Follow Up
                            </Button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              <div className="mt-4 flex items-center justify-between">
                <Button type="button" variant="secondary" size="sm" disabled={page === 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
                  Previous
                </Button>
                <span className="text-sm text-zinc-500">Page {page}</span>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={!customersData?.hasNextPage}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </Button>
              </div>
            </>
          )}
        </Card>
      ) : null}

      <FollowupModal
        open={!!followTarget}
        onClose={() => {
          setFollowTarget(null);
          setCustomersTick((n) => n + 1);
        }}
        customerId={followTarget?.id}
        companyName={followTarget?.name}
        onBeforeSubmit={followTarget ? () => claimLead(followTarget.id) : undefined}
      />
    </div>
  );
}
