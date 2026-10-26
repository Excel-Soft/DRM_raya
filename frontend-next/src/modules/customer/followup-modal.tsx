"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useApiResource } from "@/lib/hooks/use-api-resource";
import { getAuthHeaders } from "@/lib/auth/session";
import { toast } from "@/lib/toast";
import {
  FollowCustomerServicesPanel,
  normalizeFollowupCode,
  type FollowupServiceOption,
  type SubserviceDetail,
} from "./follow-customer-services-panel";

const RESERVATION_OPTIONS = [
  { value: "MOBILE", label: "Mobile" },
  { value: "W_CALL", label: "W-Call" },
  { value: "ON_SITE_APPOINTMENT", label: "On-Site Appointment" },
  { value: "E_MAIL", label: "E-mail" },
  { value: "VM_APPOINTMENT", label: "Vm Appointment" },
  { value: "FAX", label: "Fax" },
  { value: "NO_NEED", label: "No Need" },
];

type FollowupModalProps = {
  open: boolean;
  onClose: () => void;
  customerId?: string;
  companyName?: string;
  onBeforeSubmit?: () => Promise<void>;
};

function FollowupServicesSkeleton() {
  return (
    <div className="space-y-3 rounded-xl border border-zinc-200 bg-zinc-50/80 p-4 dark:border-zinc-800 dark:bg-zinc-900/40">
      <Skeleton className="h-4 w-36" />
      <div className="flex flex-wrap gap-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-40 rounded-lg" />
        ))}
      </div>
      <Skeleton className="h-24 w-full rounded-lg" />
    </div>
  );
}

export function FollowupModal({ open, onClose, customerId, companyName, onBeforeSubmit }: FollowupModalProps) {
  const servicesPath = open ? "/api/sales/services" : null;
  const { data: servicesRes, loading: servicesLoading } = useApiResource<{ success?: boolean; items: FollowupServiceOption[] }>(
    servicesPath,
  );
  const followupServices = servicesRes?.items ?? [];

  const mePath = open ? "/api/auth/me" : null;
  const { data: meData, loading: meLoading } = useApiResource<{ id: string }>(mePath);

  const locksPath = open && customerId ? `/api/sales/customers/${customerId}/service-locks` : null;
  const { data: locksRes, loading: locksLoading } = useApiResource<{
    locks: Array<{ subServiceId: string; lockedByUserId: string; lockedByName: string }>;
  }>(locksPath);

  const lockedSubservices = useMemo(() => {
    return Object.fromEntries(
      (locksRes?.locks || [])
        .filter((l) => l.lockedByUserId !== meData?.id)
        .map((l) => [l.subServiceId, { lockedByName: l.lockedByName }]),
    );
  }, [locksRes?.locks, meData?.id]);

  const [selectedServiceCodes, setSelectedServiceCodes] = useState<Set<string>>(new Set());
  const [selectedSubservices, setSelectedSubservices] = useState<Record<string, Set<string>>>({});
  const [subserviceDetails, setSubserviceDetails] = useState<Record<string, SubserviceDetail>>({});
  const [reservationType, setReservationType] = useState("");
  const [note, setNote] = useState("");
  const [nextDate, setNextDate] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const panelLoading = servicesLoading || meLoading || locksLoading;

  useEffect(() => {
    if (!open) {
      setSelectedServiceCodes(new Set());
      setSelectedSubservices({});
      setSubserviceDetails({});
      setReservationType("");
      setNote("");
      setNextDate("");
    }
  }, [open]);

  const handleToggleService = (serviceId: string, checked: boolean) => {
    const svc = followupServices.find((s) => s.id === serviceId);
    const serviceCode = svc ? normalizeFollowupCode(svc.code) : null;
    if (!serviceCode) return;
    setSelectedServiceCodes((prev) => {
      const next = new Set(prev);
      if (checked) next.add(serviceCode);
      else next.delete(serviceCode);
      return next;
    });
    if (!checked) {
      setSelectedSubservices((prev) => {
        const next = { ...prev };
        delete next[serviceCode];
        return next;
      });
      setSubserviceDetails((prev) => {
        const next = { ...prev };
        svc?.subServices?.forEach((sub) => {
          delete next[sub.id];
        });
        return next;
      });
    }
  };

  const handleToggleSubservice = (serviceId: string, subserviceId: string, checked: boolean) => {
    const svc = followupServices.find((s) => s.id === serviceId);
    const serviceCode = svc ? normalizeFollowupCode(svc.code) : null;
    if (!serviceCode) return;
    if (checked) {
      setSelectedServiceCodes((prev) => new Set(prev).add(serviceCode));
    }
    setSelectedSubservices((prev) => {
      const next = { ...prev };
      const current = new Set(next[serviceCode] ?? []);
      if (checked) current.add(subserviceId);
      else current.delete(subserviceId);
      if (current.size > 0) next[serviceCode] = current;
      else delete next[serviceCode];
      return next;
    });
    if (!checked) {
      setSubserviceDetails((prev) => {
        const next = { ...prev };
        delete next[subserviceId];
        return next;
      });
    }
  };

  const handleUpdateDetail = (subId: string, patch: Partial<SubserviceDetail>) => {
    setSubserviceDetails((prev) => ({ ...prev, [subId]: { ...(prev[subId] || {}), ...patch } }));
  };

  const submitFollowup = async () => {
    if (!customerId || selectedServiceCodes.size === 0) return;
    setSubmitting(true);
    try {
      await onBeforeSubmit?.();

      const subIdToMeta = new Map<string, { serviceId: string; subCode: string; serviceCode: string }>();
      followupServices.forEach((svc) => {
        const svcCode = normalizeFollowupCode(svc.code);
        svc.subServices?.forEach((sub) => {
          subIdToMeta.set(sub.id, { serviceId: svc.id, subCode: normalizeFollowupCode(sub.code), serviceCode: svcCode });
        });
      });

      const subServicesPayload: Record<string, string[]> = {};
      Object.entries(selectedSubservices).forEach(([serviceCode, set]) => {
        if (!selectedServiceCodes.has(serviceCode)) return;
        const codes = Array.from(set)
          .map((subId) => subIdToMeta.get(subId))
          .filter(Boolean)
          .map((meta) => meta!.subCode);
        if (codes.length) subServicesPayload[serviceCode] = Array.from(new Set(codes));
      });

      const detailPayloads: unknown[] = [];
      Object.entries(selectedSubservices).forEach(([serviceCode, set]) => {
        if (!selectedServiceCodes.has(serviceCode)) return;
        set.forEach((subId) => {
          const meta = subIdToMeta.get(subId);
          if (!meta) return;
          const detail = subserviceDetails[subId] || {};
          const purpose = detail.purpose ?? "";
          const grade = detail.grade ?? "";
          const method = detail.method ?? "";
          const comment = detail.comment ?? "";
          const noteValue = detail.note ?? comment ?? "Note";
          if ([purpose, grade, method, comment, noteValue].every((v) => !v)) return;
          detailPayloads.push({
            serviceCode: meta.serviceCode,
            subServiceCode: meta.subCode,
            serviceId: meta.serviceId,
            subServiceId: subId,
            purpose,
            grade,
            method,
            comment,
            note: noteValue,
            dateTime: detail.date ? new Date(detail.date).toISOString() : "",
            talkTimeMinutes: method ? (detail.talkTimeMinutes ?? null) : null,
            attachments: detail.attachments ?? [],
          });
        });
      });

      const res = await fetch("/api/sales/followups", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({
          customerId,
          services: Array.from(selectedServiceCodes),
          subServices: subServicesPayload,
          subServiceDetails: detailPayloads,
          reservationType: reservationType || undefined,
          note: note || undefined,
          nextDate: nextDate || undefined,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (json?.error === "ALL_SERVICES_LOCKED") {
          const names = (json.locked || []).map((l: { name: string; reason: string }) => `${l.name} (${l.reason})`).join(", ");
          throw new Error(`All selected services are currently locked: ${names}`);
        }
        throw new Error(json?.error || json?.message || "Failed to log follow-up");
      }

      if (json?.locked?.length) {
        const names = json.locked.map((l: { name: string; reason: string }) => `${l.name} (${l.reason})`).join(", ");
        toast.message(`Follow-up logged with some services skipped: ${names}`);
      } else {
        toast.success("Follow-up logged.");
      }
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to log follow-up");
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-3 backdrop-blur-[2px] sm:p-4">
      <div
        role="dialog"
        aria-modal
        className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-700 dark:bg-zinc-950"
      >
        <header className="flex shrink-0 items-start justify-between gap-4 border-b border-zinc-200 bg-gradient-to-r from-emerald-50/90 to-white px-5 py-4 dark:border-zinc-800 dark:from-emerald-950/30 dark:to-zinc-950">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-emerald-700 dark:text-emerald-400">Follow the customer</p>
            <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-50">{companyName || "Customer follow-up"}</h2>
          </div>
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>
            Close
          </Button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          <div className="mx-auto flex max-w-4xl flex-col gap-5">
            {panelLoading ? (
              <FollowupServicesSkeleton />
            ) : (
              <FollowCustomerServicesPanel
                services={followupServices}
                selectedServiceCodes={selectedServiceCodes}
                selectedSubservices={selectedSubservices}
                subserviceDetails={subserviceDetails}
                onToggleService={handleToggleService}
                onToggleSubservice={handleToggleSubservice}
                onUpdateDetail={handleUpdateDetail}
                lockedSubservices={lockedSubservices}
              />
            )}

            <div className="grid gap-4 rounded-xl border border-zinc-200 bg-zinc-50/50 p-4 dark:border-zinc-800 dark:bg-zinc-900/30 md:grid-cols-2">
              <label className="block text-sm">
                <span className="mb-1.5 block font-semibold text-zinc-700 dark:text-zinc-200">Reservation</span>
                <Select className="w-full text-sm" value={reservationType} onChange={(e) => setReservationType(e.target.value)}>
                  <option value="">Select reservation</option>
                  {RESERVATION_OPTIONS.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </Select>
              </label>
              <label className="block text-sm">
                <span className="mb-1.5 block font-semibold text-zinc-700 dark:text-zinc-200">Next date</span>
                <Input type="datetime-local" className="text-sm" value={nextDate} onChange={(e) => setNextDate(e.target.value)} />
              </label>
              <label className="block text-sm md:col-span-2">
                <span className="mb-1.5 block font-semibold text-zinc-700 dark:text-zinc-200">Note</span>
                <Textarea rows={3} className="text-sm" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional follow-up note" />
              </label>
            </div>
          </div>
        </div>

        <footer className="flex shrink-0 justify-end gap-2 border-t border-zinc-200 bg-zinc-50/80 px-5 py-3 dark:border-zinc-800 dark:bg-zinc-900/50">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="button"
            disabled={!customerId || selectedServiceCodes.size === 0 || submitting || panelLoading}
            onClick={() => void submitFollowup()}
          >
            {submitting ? "Submitting…" : "Submit follow-up"}
          </Button>
        </footer>
      </div>
    </div>
  );
}
