import React, { useMemo, useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { CalendarClock, ChevronDown, ChevronUp, Upload as UploadIcon } from "lucide-react";

export type FollowupSubserviceOption = { id: string; code: string; name: string };
export type FollowupServiceOption = { id: string; code: string; name: string; subServices?: FollowupSubserviceOption[] };

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

const normalizeCode = (value: string) => value?.toString().trim().toUpperCase().replace(/[\s-]+/g, "_");

type Props = {
  services: FollowupServiceOption[];
  selectedServiceCodes: Set<string>;
  selectedSubservices: Record<string, Set<string>>;
  subserviceDetails: Record<string, SubserviceDetail>;
  onToggleService: (serviceId: string, checked: boolean) => void;
  onToggleSubservice: (serviceId: string, subId: string, checked: boolean) => void;
  onUpdateDetail: (subId: string, patch: Partial<SubserviceDetail>) => void;
  onCallMethodSelect?: () => void;
};

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

const gradeOptions = ["A+", "A", "A-", "B+", "B", "B-", "C+", "C", "D"].map((g) => ({ code: g, label: g }));

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

export function FollowCustomerServicesPanel({
  services,
  selectedServiceCodes,
  selectedSubservices,
  subserviceDetails,
  onToggleService,
  onToggleSubservice,
  onUpdateDetail,
  onCallMethodSelect,
}: Props) {
  const orderedServices = useMemo(() => {
    const order = ["ALIBABA_MEMBERSHIP", "ALIBABA_SERVICES", "DESIGN_DEVELOPMENT", "DOMAIN_HOSTING"];
    const map = new Map(services.map((s) => [normalizeCode(s.code), s]));
    return order.map((code) => map.get(code)).filter(Boolean) as FollowupServiceOption[];
  }, [services]);

  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [visibleCount, setVisibleCount] = useState<Record<string, number>>({});

  const handleLoadMore = (svc: FollowupServiceOption) => {
    setVisibleCount((prev) => {
      const key = normalizeCode(svc.code);
      const current = prev[key] ?? 5;
      const next = Math.min((svc.subServices?.length ?? 0), current + 5);
      return { ...prev, [key]: next };
    });
  };

  const getVisibleSubservices = (svc: FollowupServiceOption) => {
    const key = normalizeCode(svc.code);
    const max = visibleCount[key] ?? 5;
    return (svc.subServices ?? []).slice(0, max);
  };

  return (
    <div className="space-y-3">
      <div className="rounded-md border p-3 bg-card shadow-sm">
        <p className="text-sm font-semibold mb-2">Select Services *</p>
        <div className="flex flex-wrap gap-4">
          {orderedServices.length === 0 && (
            <p className="text-sm text-muted-foreground">No services available</p>
          )}
          {orderedServices.map((svc) => {
            const isSelected = selectedServiceCodes.has(normalizeCode(svc.code));
            const hasSub = (svc.subServices?.length ?? 0) > 0;
            const headerToggle = () =>
              setExpanded((prev) => {
                const next = new Set(prev);
                if (next.has(svc.id)) next.delete(svc.id);
                else next.add(svc.id);
                return next;
              });
            return (
              <label
                key={svc.id}
                className="flex items-center gap-2 text-sm font-semibold px-3 py-2 rounded-md border bg-card hover:bg-muted/50 transition-colors"
              >
                <Checkbox
                  checked={isSelected}
                  onCheckedChange={(checked) => onToggleService(svc.id, !!checked)}
                />
                {svc.name}
                {hasSub && (
                  <button
                    type="button"
                    className="p-1 rounded hover:bg-muted ml-1"
                    onClick={(e) => {
                      e.preventDefault();
                      headerToggle();
                    }}
                  >
                    {expanded.has(svc.id) ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </button>
                )}
              </label>
            );
          })}
        </div>
      </div>

      <div className="space-y-3">
        {orderedServices.map((svc) => {
          const isSelected = selectedServiceCodes.has(normalizeCode(svc.code));
          const hasSub = (svc.subServices?.length ?? 0) > 0;
          const isExpanded = expanded.has(svc.id) || isSelected;
          if (!hasSub || !isExpanded) return null;
          return (
            <div key={svc.id} className="rounded-md border bg-card overflow-hidden">
              <div className="flex items-center justify-between px-3 py-2 border-b bg-muted/40">
                <p className="text-sm font-semibold">{svc.name} - Sub Services</p>
                <button
                  type="button"
                  className="p-1 rounded hover:bg-muted"
                  onClick={() =>
                    setExpanded((prev) => {
                      const next = new Set(prev);
                      if (next.has(svc.id)) next.delete(svc.id);
                      else next.add(svc.id);
                      return next;
                    })
                  }
                >
                  {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </button>
              </div>
              <div className="px-3 pb-3 pt-2">
                <div className="space-y-2">
                  {getVisibleSubservices(svc).map((sub) => {
                    const subSelected = selectedSubservices[normalizeCode(svc.code)]?.has(sub.id) ?? false;
                    const detail = subserviceDetails[sub.id] || {};
                    return (
                      <div
                        key={sub.id}
                        className={`relative border rounded-md px-4 py-3 transition-all duration-200 ${
                          subSelected 
                            ? "bg-emerald-50/50 border-emerald-500/30 shadow-sm ring-1 ring-emerald-500/10" 
                            : "bg-card border-slate-200"
                        }`}
                      >
                        <div className={`grid gap-3 items-end ${subSelected ? "grid-cols-1 md:grid-cols-2 lg:flex lg:flex-nowrap lg:gap-2" : "grid-cols-1"}`}>
                          <div className={`flex items-end ${subSelected ? "lg:pb-1 lg:min-w-[140px]" : ""}`}>
                            <label className={`flex items-center gap-2 text-sm transition-colors ${subSelected ? "text-emerald-900 font-bold" : "text-foreground"}`}>
                              <Checkbox
                                checked={subSelected}
                                onCheckedChange={(checked) => onToggleSubservice(svc.id, sub.id, !!checked)}
                              />
                              <span className="font-medium whitespace-nowrap subServiceName">{sub.name}</span>
                            </label>
                          </div>
                          {subSelected && (
                            <>
                              <div className="field-block flex-1 min-w-[120px]">
                                <span className="field-label">Purpose*</span>
                                <Select
                                  value={detail.purpose ?? ""}
                                  onValueChange={(v) => onUpdateDetail(sub.id, { purpose: v })}
                                >
                                  <SelectTrigger className="field-control w-full">
                                    <SelectValue placeholder="Purpose" />
                                  </SelectTrigger>
                                  <SelectContent position="popper" className="z-[80]">
                                    {purposeOptions.map((opt) => (
                                      <SelectItem key={opt.code} value={opt.code}>
                                        {opt.label}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>

                              <div className="field-block flex-1 min-w-[100px]">
                                <span className="field-label">Grade*</span>
                                <Select
                                  value={detail.grade ?? ""}
                                  onValueChange={(v) => onUpdateDetail(sub.id, { grade: v })}
                                >
                                  <SelectTrigger className="field-control w-full">
                                    <SelectValue placeholder="Grade" />
                                  </SelectTrigger>
                                  <SelectContent position="popper" className="z-[80]">
                                    {gradeOptions.map((opt) => (
                                      <SelectItem key={opt.code} value={opt.code}>
                                        {opt.label}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>

                              <div className="field-block flex-1 min-w-[120px]">
                                <span className="field-label">Method*</span>
                                <Select
                                  value={detail.method ?? ""}
                                  onValueChange={(v) => {
                                    onUpdateDetail(sub.id, { method: v });
                                    if (v) {
                                      onCallMethodSelect?.();
                                    } else {
                                      onUpdateDetail(sub.id, { talkTimeMinutes: null });
                                    }
                                  }}
                                >
                                  <SelectTrigger className="field-control w-full">
                                    <SelectValue placeholder="Method" />
                                  </SelectTrigger>
                                  <SelectContent position="popper" className="z-[80]">
                                    {methodOptions.map((opt) => (
                                      <SelectItem key={opt.code} value={opt.code}>
                                        {opt.label}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>

                              {detail.method && (
                                  <div className="field-block flex-1 min-w-[80px]">
                                    <span className="field-label">Talk Time (Minutes)</span>
                                    <Input
                                      type="number"
                                      min={1}
                                      max={600}
                                      className="field-control w-full"
                                      value={detail.talkTimeMinutes ?? ""}
                                      onChange={(e) =>
                                        onUpdateDetail(sub.id, {
                                          talkTimeMinutes: e.target.value ? Number(e.target.value) : null,
                                        })
                                      }
                                    />
                                  </div>
                                )}

                              <div className="field-block flex-1 min-w-[150px]">
                                <span className="field-label">Comment*</span>
                                <Select
                                  value={detail.comment ?? ""}
                                  onValueChange={(v) => onUpdateDetail(sub.id, { comment: v })}
                                >
                                  <SelectTrigger className="field-control w-full">
                                    <SelectValue placeholder="Comment" />
                                  </SelectTrigger>
                                  <SelectContent position="popper" className="z-[80]">
                                    {commentOptions.map((opt) => (
                                      <SelectItem key={opt.code} value={opt.code}>
                                        {opt.label}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>

                              <div className="field-block flex-1 min-w-[180px]">
                                <span className="field-label">Date/Time</span>
                                <div className="dtWrap">
                                  <Input
                                    type="datetime-local"
                                    placeholder="dd/mm/yyyy --:-- --"
                                    value={detail.date ?? ""}
                                    onChange={(e) => onUpdateDetail(sub.id, { date: e.target.value })}
                                    className="dt-input"
                                  />
                                  <button
                                    type="button"
                                    aria-label="Open date/time"
                                    className="dtIconBtn"
                                    onClick={(e) => {
                                      const input = e.currentTarget.parentElement?.querySelector(
                                        'input[type="datetime-local"]',
                                      ) as HTMLInputElement | null;
                                      input?.focus();
                                      // @ts-ignore
                                      input?.showPicker?.();
                                    }}
                                  >
                                    <CalendarClock className="h-4 w-4 text-emerald-600" />
                                  </button>
                                </div>
                              </div>

                              <div className="field-block flex-1 min-w-[150px]">
                                <span className="field-label">Choose files</span>
                                <div className="flex items-center gap-2">
                                  <label className="inline-flex items-center gap-2 px-3 py-2 border rounded-md bg-card hover:bg-muted cursor-pointer w-full justify-center field-control">
                                    <UploadIcon className="h-4 w-4" />
                                    <span className="text-sm">Choose File</span>
                                    <input
                                      type="file"
                                      className="hidden"
                                      onChange={(e) => {
                                        const file = e.target.files?.[0] ?? null;
                                        onUpdateDetail(sub.id, { file, fileName: file?.name });
                                      }}
                                    />
                                  </label>
                                  <span className="text-xs text-muted-foreground truncate file-name">
                                    {detail.fileName || "No file chosen"}
                                  </span>
                                </div>
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  {(svc.subServices?.length ?? 0) > (visibleCount[normalizeCode(svc.code)] ?? 5) && (
                    <div className="flex justify-center pt-1">
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-primary border-primary/20 hover:bg-primary/5"
                        onClick={() => handleLoadMore(svc)}
                      >
                        Load More
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
