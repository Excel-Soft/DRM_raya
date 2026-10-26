"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { PageError, PageLoading } from "@/components/ui/page-states";
import { Skeleton } from "@/components/ui/skeleton";
import { useApiResource } from "@/lib/hooks/use-api-resource";
import { apiFetch } from "@/lib/api/browser-client";
import { toast } from "@/lib/toast";
import {
  CUSTOMER_GM_BV_POOL,
  CUSTOMER_PRIVATE_POOL,
  customerCreateInvoicePath,
  customerQuotationPath,
} from "@/lib/navigation/customer-routes";
import { CustomerAttributeHistory } from "./customer-attribute-history";
import { FollowupModal } from "./followup-modal";
import { HiOutlineArrowLeft } from "react-icons/hi2";

type ProfileResponse = {
  lead?: {
    id?: string;
    companyName?: string;
    accountName?: string;
    email?: string;
    phone?: string;
    mobile?: string;
    grade?: string;
    drmId?: string;
  };
  phones?: Array<{ label: string; value: string }>;
  lastContactAt?: string | null;
};

const ACTION_CHIPS: Array<{ id: string; label: string; className: string }> = [
  { id: "followup", label: "Followup", className: "bg-emerald-600 hover:bg-emerald-700" },
  { id: "quotation", label: "Quotation", className: "bg-violet-600 hover:bg-violet-700" },
  { id: "invoice", label: "Invoice", className: "bg-indigo-600 hover:bg-indigo-700" },
  { id: "gmdoc", label: "Gm Doc", className: "bg-red-600 hover:bg-red-700" },
  { id: "gmbv", label: "Gm BV submit", className: "bg-amber-600 hover:bg-amber-700" },
  { id: "expiry", label: "Update Expiry", className: "bg-blue-600 hover:bg-blue-700" },
  { id: "rate", label: "Rate Customer", className: "bg-orange-500 hover:bg-orange-600" },
  { id: "sample", label: "Log Sample", className: "bg-sky-500 hover:bg-sky-600" },
];

export function CustomerAttributeView({ customerId }: { customerId: string }) {
  const [followOpen, setFollowOpen] = useState(false);
  const [rateOpen, setRateOpen] = useState(false);
  const [sampleOpen, setSampleOpen] = useState(false);
  const [rating, setRating] = useState("5");
  const [ratingNote, setRatingNote] = useState("");
  const [sampleProduct, setSampleProduct] = useState("");
  const [sampleNote, setSampleNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const { data: profile, loading: profileLoading, error: profileError, refetch } = useApiResource<ProfileResponse>(
    customerId ? `/api/sales/leads/${customerId}/profile` : null,
  );

  const { data: followups } = useApiResource<unknown[]>(customerId ? `/api/sales/customers/${customerId}/followups` : null);

  const { data: gmEntries } = useApiResource<unknown[]>(
    customerId ? `/api/sales/customers/${customerId}/gm-entries` : null,
  );

  const lead = profile?.lead ?? {};
  const phones =
    profile?.phones?.length
      ? profile.phones
      : [
          lead.phone ? { label: "Phone", value: lead.phone } : null,
          lead.mobile ? { label: "Mobile", value: lead.mobile } : null,
        ].filter(Boolean) as Array<{ label: string; value: string }>;

  const grade = lead.grade || "—";
  const contactRows = useMemo(() => (Array.isArray(followups) ? followups : []), [followups]);
  const contactCount = contactRows.length;

  const lastContact = useMemo(() => {
    if (profile?.lastContactAt) return new Date(profile.lastContactAt).toLocaleString();
    const first = contactRows[0] as Record<string, unknown> | undefined;
    const dateVal = first?.createdAt ?? first?.created_at;
    if (dateVal) return new Date(String(dateVal)).toLocaleString();
    return "Never";
  }, [profile?.lastContactAt, contactRows]);

  const gmDocGateSubmitted = useMemo(() => {
    const latest = Array.isArray(gmEntries) && gmEntries.length ? (gmEntries[0] as Record<string, unknown>) : null;
    return Boolean(latest?.gmDocSubmittedAt);
  }, [gmEntries]);

  const runAction = (id: string) => {
    switch (id) {
      case "followup":
        setFollowOpen(true);
        break;
      case "quotation":
        window.location.href = customerQuotationPath(customerId);
        break;
      case "invoice":
        window.location.href = customerCreateInvoicePath(customerId);
        break;
      case "gmdoc":
        toast.message("GM Doc upload — use legacy Attribute modal until PMS doc flow is ported.");
        break;
      case "gmbv":
        if (!gmDocGateSubmitted) {
          toast.error("Submit GM Doc first.");
          return;
        }
        window.location.href = `${CUSTOMER_GM_BV_POOL}?customerId=${customerId}`;
        break;
      case "expiry":
        toast.message("Update Expiry — opening lead expiry API next; use legacy for full edit.");
        break;
      case "rate":
        setRateOpen(true);
        break;
      case "sample":
        setSampleOpen(true);
        break;
      default:
        break;
    }
  };

  const submitRating = async () => {
    setSubmitting(true);
    try {
      await apiFetch("/api/service/feedback", {
        method: "POST",
        json: { customerId, rating: Number(rating), note: ratingNote || undefined },
      });
      toast.success("Rating recorded.");
      setRateOpen(false);
      setRatingNote("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to record rating.");
    } finally {
      setSubmitting(false);
    }
  };

  const submitSample = async () => {
    setSubmitting(true);
    try {
      await apiFetch("/api/service/sample-requests", {
        method: "POST",
        json: { customerId, productName: sampleProduct || undefined, note: sampleNote || undefined },
      });
      toast.success("Sample request logged.");
      setSampleOpen(false);
      setSampleProduct("");
      setSampleNote("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to log sample.");
    } finally {
      setSubmitting(false);
    }
  };

  if (profileError) {
    return <PageError message={profileError} onRetry={refetch} />;
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 pb-8">
      <Link
        href={CUSTOMER_PRIVATE_POOL}
        className="inline-flex items-center gap-2 text-sm font-bold uppercase tracking-tight text-zinc-600 hover:text-emerald-600 dark:text-zinc-400"
      >
        <HiOutlineArrowLeft className="h-4 w-4 text-emerald-600" />
        Back to Private Pool
      </Link>

      <p className="text-sm font-bold uppercase tracking-wide text-zinc-500">Attribute</p>

      {profileLoading ? (
        <Card className="p-8">
          <div className="mx-auto flex max-w-md flex-col items-center gap-4">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-10 w-10 rounded-full" />
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-56" />
            <div className="flex gap-2">
              <Skeleton className="h-9 w-28" />
              <Skeleton className="h-9 w-28" />
            </div>
            <div className="flex flex-wrap justify-center gap-2 pt-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-7 w-20 rounded" />
              ))}
            </div>
          </div>
        </Card>
      ) : (
        <Card className="p-6 md:p-8">
          <div className="mx-auto flex max-w-lg flex-col items-center text-center">
            <h1 className="text-base font-bold text-zinc-800 dark:text-zinc-100">{lead.companyName || "Unknown company"}</h1>
            {lead.drmId ? (
              <Badge variant="neutral" className="mt-2 font-mono text-xs">
                {lead.drmId}
              </Badge>
            ) : null}
            <div className="mt-3 flex h-9 w-9 items-center justify-center rounded-full bg-amber-100 text-xs font-bold text-amber-700 dark:bg-amber-950/50 dark:text-amber-400">
              {grade}
            </div>
            <p className="mt-3 text-sm font-bold text-zinc-700 dark:text-zinc-300">{lead.accountName || "—"}</p>
            <p className="text-sm text-zinc-500">{lead.email || "No email"}</p>

            <div className="mt-4 flex flex-wrap justify-center gap-3">
              {phones.map((p, i) => (
                <div key={`${p.label}-${i}`} className="flex flex-col items-center gap-1">
                  <a
                    href={`tel:${p.value}`}
                    className="rounded bg-emerald-600 px-5 py-1.5 text-sm font-bold text-white hover:bg-emerald-700"
                  >
                    {p.value}
                  </a>
                  <span className="text-[10px] text-zinc-500">{p.label}</span>
                </div>
              ))}
            </div>

            <div className="mt-6 flex w-full max-w-sm justify-evenly">
              <div className="text-center">
                <p className="text-xs text-zinc-500">Grade</p>
                <div className="mt-1 flex h-9 w-9 items-center justify-center rounded-full bg-amber-100 text-xs font-bold text-amber-700">
                  {grade}
                </div>
              </div>
              <div className="text-center">
                <p className="text-xs text-zinc-500">Contact</p>
                <div className="mt-1 flex h-9 w-9 items-center justify-center rounded-full bg-red-100 text-sm font-bold text-red-600">
                  {contactCount}
                </div>
              </div>
            </div>

            <div className="mt-4 w-full max-w-xs">
              <p className="text-xs text-zinc-500">Last contact</p>
              <div className="mt-1 rounded bg-zinc-800 px-3 py-1.5 text-xs font-medium text-white dark:bg-zinc-950">{lastContact}</div>
            </div>

            <div className="mt-6 flex flex-wrap justify-center gap-1.5">
              {ACTION_CHIPS.map((chip) => (
                <button
                  key={chip.id}
                  type="button"
                  disabled={chip.id === "gmbv" && !gmDocGateSubmitted}
                  title={chip.id === "gmbv" && !gmDocGateSubmitted ? "Submit GM Doc first" : undefined}
                  onClick={() => runAction(chip.id)}
                  className={`rounded px-2.5 py-1 text-xs font-semibold text-white shadow-sm disabled:cursor-not-allowed disabled:opacity-50 ${chip.className}`}
                >
                  {chip.label}
                </button>
              ))}
            </div>
          </div>
        </Card>
      )}

      <CustomerAttributeHistory customerId={customerId} onEditContact={() => setFollowOpen(true)} />

      <FollowupModal
        open={followOpen}
        onClose={() => setFollowOpen(false)}
        customerId={customerId}
        companyName={lead.companyName}
      />

      {rateOpen ? (
        <dialog open className="fixed inset-0 z-50 m-auto max-w-md rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-700 dark:bg-zinc-900">
          <h3 className="font-semibold">Rate customer satisfaction</h3>
          <label className="mt-4 block text-sm">
            Rating (1–5)
            <Input className="mt-1" type="number" min={1} max={5} value={rating} onChange={(e) => setRating(e.target.value)} />
          </label>
          <label className="mt-3 block text-sm">
            Note
            <Textarea className="mt-1" rows={3} value={ratingNote} onChange={(e) => setRatingNote(e.target.value)} />
          </label>
          <div className="mt-4 flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setRateOpen(false)}>
              Cancel
            </Button>
            <Button type="button" disabled={submitting} onClick={() => void submitRating()}>
              Submit
            </Button>
          </div>
        </dialog>
      ) : null}

      {sampleOpen ? (
        <dialog open className="fixed inset-0 z-50 m-auto max-w-md rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-700 dark:bg-zinc-900">
          <h3 className="font-semibold">Log sample request</h3>
          <label className="mt-4 block text-sm">
            Product
            <Input className="mt-1" value={sampleProduct} onChange={(e) => setSampleProduct(e.target.value)} />
          </label>
          <label className="mt-3 block text-sm">
            Note
            <Textarea className="mt-1" rows={3} value={sampleNote} onChange={(e) => setSampleNote(e.target.value)} />
          </label>
          <div className="mt-4 flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setSampleOpen(false)}>
              Cancel
            </Button>
            <Button type="button" disabled={submitting} onClick={() => void submitSample()}>
              Submit
            </Button>
          </div>
        </dialog>
      ) : null}
    </div>
  );
}

export function CustomerAttributePageShell({ customerId }: { customerId: string }) {
  if (!customerId) return <PageLoading label="Loading customer…" />;
  return <CustomerAttributeView customerId={customerId} />;
}
