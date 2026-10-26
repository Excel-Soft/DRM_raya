"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { HiOutlineChevronDown, HiOutlineChevronUp, HiOutlineLockClosed } from "react-icons/hi2";

export type FollowupSubserviceOption = { id: string; code: string; name: string };
export type FollowupServiceOption = {
  id: string;
  code: string;
  name: string;
  subServices?: FollowupSubserviceOption[];
};

export type SubserviceDetail = {
  purpose?: string;
  grade?: string;
  method?: string;
  comment?: string;
  talkTimeMinutes?: number | null;
  date?: string;
  note?: string;
  attachments?: Array<{
    fileName?: string | null;
    fileUrl?: string | null;
    mimeType?: string | null;
    sizeBytes?: number | null;
  }>;
  file?: File | null;
  fileName?: string;
};

export function normalizeFollowupCode(value: string) {
  return value?.toString().trim().toUpperCase().replace(/[\s-]+/g, "_");
}

const purposeOptions = [
  { code: "NEW_SELL", label: "New Sell" },
  { code: "INFORM", label: "Inform" },
  { code: "PAYMENT_RECOVERY", label: "Payment Recovery" },
  { code: "AB_PAYMENT", label: "Ab Payment" },
  { code: "PROJECT_DATA", label: "Project Data" },
  { code: "RENEW_SELL", label: "Renew Sell" },
  { code: "SEMINAR", label: "Seminar" },
  { code: "WEBINAR", label: "Webinar" },
  { code: "TRAINING", label: "Training" },
  { code: "ANYDESK", label: "Anydesk" },
];

const gradeOptions = ["A+", "A", "A-", "B+", "B", "B-", "C+", "C", "D"];

const methodOptions = [
  { code: "MOBILE", label: "Mobile" },
  { code: "WHATSAPP", label: "Whatsapp" },
  { code: "WH_CALL", label: "WH-Call" },
  { code: "IN_MEETING", label: "In-meeting" },
  { code: "OUT_MEETING", label: "Out-meeting" },
  { code: "E_MAIL", label: "E-mail" },
  { code: "APPOINTMENT", label: "Appointment" },
  { code: "SEMINAR", label: "Seminar" },
  { code: "OL_MEETING", label: "OL-Meeting" },
];

const commentOptions = [
  { code: "INTRODUCTION_MESSAGE", label: "Introduction Message" },
  { code: "INTRODUCTION_CALL", label: "Introduction Call" },
  { code: "PROMOTION_SHARED", label: "Promotion Shared" },
  { code: "PROMOTION_DISCUSSION", label: "Promotion Discussion" },
  { code: "FOLLOW_UP_SCHEDULED", label: "Follow-Up Scheduled" },
  { code: "QUOTATION_SENT", label: "Quotation Sent" },
  { code: "QUOTATION_REVISED", label: "Quotation Revised" },
  { code: "QUOTATION_APPROVED", label: "Quotation Approved" },
  { code: "INVOICE_SENT", label: "Invoice Sent" },
  { code: "AWAITING_PAYMENT", label: "Awaiting Payment" },
  { code: "INVOICE_OVERDUE", label: "Invoice Overdue" },
];

type Props = {
  services: FollowupServiceOption[];
  selectedServiceCodes: Set<string>;
  selectedSubservices: Record<string, Set<string>>;
  subserviceDetails: Record<string, SubserviceDetail>;
  onToggleService: (serviceId: string, checked: boolean) => void;
  onToggleSubservice: (serviceId: string, subId: string, checked: boolean) => void;
  onUpdateDetail: (subId: string, patch: Partial<SubserviceDetail>) => void;
  lockedSubservices?: Record<string, { lockedByName: string }>;
};

export function FollowCustomerServicesPanel({
  services,
  selectedServiceCodes,
  selectedSubservices,
  subserviceDetails,
  onToggleService,
  onToggleSubservice,
  onUpdateDetail,
  lockedSubservices,
}: Props) {
  const orderedServices = useMemo(() => {
    const order = ["ALIBABA_MEMBERSHIP", "ALIBABA_SERVICES", "DESIGN_DEVELOPMENT", "DOMAIN_HOSTING", "AI_SERVICES"];
    const map = new Map(services.map((s) => [normalizeFollowupCode(s.code), s]));
    return order.map((code) => map.get(code)).filter(Boolean) as FollowupServiceOption[];
  }, [services]);

  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [visibleCount, setVisibleCount] = useState<Record<string, number>>({});

  const handleLoadMore = (svc: FollowupServiceOption) => {
    const key = normalizeFollowupCode(svc.code);
    setVisibleCount((prev) => {
      const current = prev[key] ?? 5;
      const next = Math.min(svc.subServices?.length ?? 0, current + 5);
      return { ...prev, [key]: next };
    });
  };

  const getVisibleSubservices = (svc: FollowupServiceOption) => {
    const key = normalizeFollowupCode(svc.code);
    const max = visibleCount[key] ?? 5;
    return (svc.subServices ?? []).slice(0, max);
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <p className="mb-3 text-sm font-bold text-zinc-800 dark:text-zinc-100">Select services *</p>
        <div className="flex flex-wrap gap-2">
          {orderedServices.length === 0 && <p className="text-sm text-zinc-500">No services available</p>}
          {orderedServices.map((svc) => {
            const code = normalizeFollowupCode(svc.code);
            const isSelected = selectedServiceCodes.has(code);
            const hasSub = (svc.subServices?.length ?? 0) > 0;
            return (
              <label
                key={svc.id}
                className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-semibold transition-colors ${
                  isSelected
                    ? "border-emerald-400 bg-emerald-50 text-emerald-900 dark:border-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-100"
                    : "border-zinc-200 hover:border-zinc-300 dark:border-zinc-700 dark:hover:border-zinc-600"
                }`}
              >
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={(e) => onToggleService(svc.id, e.target.checked)}
                />
                {svc.name}
                {hasSub ? (
                  <button
                    type="button"
                    className="ml-1 rounded p-1 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                    onClick={(e) => {
                      e.preventDefault();
                      setExpanded((prev) => {
                        const next = new Set(prev);
                        if (next.has(svc.id)) next.delete(svc.id);
                        else next.add(svc.id);
                        return next;
                      });
                    }}
                  >
                    {expanded.has(svc.id) ? (
                      <HiOutlineChevronUp className="h-4 w-4" />
                    ) : (
                      <HiOutlineChevronDown className="h-4 w-4" />
                    )}
                  </button>
                ) : null}
              </label>
            );
          })}
        </div>
      </div>

      {orderedServices.map((svc) => {
        const code = normalizeFollowupCode(svc.code);
        const isSelected = selectedServiceCodes.has(code);
        const hasSub = (svc.subServices?.length ?? 0) > 0;
        const isExpanded = expanded.has(svc.id) || isSelected;
        if (!hasSub || !isExpanded) return null;

        return (
          <div key={svc.id} className="overflow-hidden rounded-xl border border-zinc-200 shadow-sm dark:border-zinc-800">
            <div className="flex items-center justify-between border-b border-zinc-200 bg-zinc-50 px-4 py-2.5 dark:border-zinc-800 dark:bg-zinc-900/80">
              <p className="text-sm font-bold text-zinc-800 dark:text-zinc-100">{svc.name} — categories</p>
            </div>
            <div className="space-y-3 p-4">
              {getVisibleSubservices(svc).map((sub) => {
                const subSelected = selectedSubservices[code]?.has(sub.id) ?? false;
                const detail = subserviceDetails[sub.id] || {};
                const lock = lockedSubservices?.[sub.id];
                return (
                  <div
                    key={sub.id}
                    title={
                      lock ? `Locked by ${lock.lockedByName} — already followed up within the last 60 days` : undefined
                    }
                    className={`rounded-md border px-3 py-3 ${
                      lock
                        ? "border-zinc-200 opacity-60 dark:border-zinc-700"
                        : subSelected
                          ? "border-emerald-300 bg-emerald-50/40 dark:border-emerald-900 dark:bg-emerald-950/20"
                          : "border-zinc-200 dark:border-zinc-700"
                    }`}
                  >
                    <label
                      className={`flex cursor-pointer items-center gap-2 text-sm ${lock ? "cursor-not-allowed" : ""}`}
                    >
                      <input
                        type="checkbox"
                        checked={subSelected}
                        disabled={!!lock}
                        onChange={(e) => onToggleSubservice(svc.id, sub.id, e.target.checked)}
                      />
                      <span className="font-medium">{sub.name}</span>
                      {lock ? (
                        <span className="inline-flex items-center gap-1 text-[11px] text-amber-700 dark:text-amber-400">
                          <HiOutlineLockClosed className="h-3 w-3" />
                          Locked by {lock.lockedByName}
                        </span>
                      ) : null}
                    </label>

                    {subSelected && !lock ? (
                      <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
                        <label className="block text-xs">
                          <span className="font-semibold text-emerald-700 dark:text-emerald-400">Purpose*</span>
                          <Select
                            className="mt-1 w-full text-sm"
                            value={detail.purpose ?? ""}
                            onChange={(e) => onUpdateDetail(sub.id, { purpose: e.target.value })}
                          >
                            <option value="">Purpose</option>
                            {purposeOptions.map((opt) => (
                              <option key={opt.code} value={opt.code}>
                                {opt.label}
                              </option>
                            ))}
                          </Select>
                        </label>
                        <label className="block text-xs">
                          <span className="font-semibold text-emerald-700 dark:text-emerald-400">Grade*</span>
                          <Select
                            className="mt-1 w-full text-sm"
                            value={detail.grade ?? ""}
                            onChange={(e) => onUpdateDetail(sub.id, { grade: e.target.value })}
                          >
                            <option value="">Grade</option>
                            {gradeOptions.map((g) => (
                              <option key={g} value={g}>
                                {g}
                              </option>
                            ))}
                          </Select>
                        </label>
                        <label className="block text-xs">
                          <span className="font-semibold text-emerald-700 dark:text-emerald-400">Method*</span>
                          <Select
                            className="mt-1 w-full text-sm"
                            value={detail.method ?? ""}
                            onChange={(e) => {
                              const v = e.target.value;
                              onUpdateDetail(sub.id, { method: v, talkTimeMinutes: v ? detail.talkTimeMinutes ?? null : null });
                            }}
                          >
                            <option value="">Method</option>
                            {methodOptions.map((opt) => (
                              <option key={opt.code} value={opt.code}>
                                {opt.label}
                              </option>
                            ))}
                          </Select>
                        </label>
                        {detail.method ? (
                          <label className="block text-xs">
                            <span className="font-semibold text-emerald-700 dark:text-emerald-400">Talk Time (min)</span>
                            <Input
                              type="number"
                              min={1}
                              max={600}
                              className="mt-1 text-sm"
                              value={detail.talkTimeMinutes ?? ""}
                              onChange={(e) =>
                                onUpdateDetail(sub.id, {
                                  talkTimeMinutes: e.target.value ? Number(e.target.value) : null,
                                })
                              }
                            />
                          </label>
                        ) : null}
                        <label className="block text-xs">
                          <span className="font-semibold text-emerald-700 dark:text-emerald-400">Comment*</span>
                          <Select
                            className="mt-1 w-full text-sm"
                            value={detail.comment ?? ""}
                            onChange={(e) => onUpdateDetail(sub.id, { comment: e.target.value })}
                          >
                            <option value="">Comment</option>
                            {commentOptions.map((opt) => (
                              <option key={opt.code} value={opt.code}>
                                {opt.label}
                              </option>
                            ))}
                          </Select>
                        </label>
                        <label className="block text-xs">
                          <span className="font-semibold text-emerald-700 dark:text-emerald-400">Date/Time</span>
                          <Input
                            type="datetime-local"
                            className="mt-1 text-sm"
                            value={detail.date ?? ""}
                            onChange={(e) => onUpdateDetail(sub.id, { date: e.target.value })}
                          />
                        </label>
                        <label className="block text-xs">
                          <span className="font-semibold text-emerald-700 dark:text-emerald-400">Choose file</span>
                          <Input
                            type="file"
                            className="mt-1 text-sm"
                            onChange={(e) => {
                              const file = e.target.files?.[0] ?? null;
                              onUpdateDetail(sub.id, { file, fileName: file?.name });
                            }}
                          />
                          <span className="text-[11px] text-zinc-500">{detail.fileName || "No file chosen"}</span>
                        </label>
                      </div>
                    ) : null}
                  </div>
                );
              })}
              {(svc.subServices?.length ?? 0) > (visibleCount[code] ?? 5) ? (
                <div className="flex justify-center pt-1">
                  <Button type="button" variant="secondary" size="sm" onClick={() => handleLoadMore(svc)}>
                    Load More
                  </Button>
                </div>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}
