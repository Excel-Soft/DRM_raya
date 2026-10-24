"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageError, PageLoading } from "@/components/ui/page-states";
import { useApiResource } from "@/lib/hooks/use-api-resource";
import { apiFetch } from "@/lib/api/browser-client";
import { getAuthHeaders } from "@/lib/auth/session";
import { toast } from "@/lib/toast";
import {
  buildTempContactServiceColumns,
  EMPTY_TEMP_CONTACT_FORM,
  TEMP_CONTACT_FALLBACK_META,
  tempContactFormSchema,
  type DuplicateConflicts,
  type TempContactFormValues,
  type TemporaryContactMeta,
} from "./temporary-contact-constants";
import { CUSTOMER_ADD_CUSTOMER } from "@/lib/navigation/customer-routes";
import { HiOutlineUserPlus } from "react-icons/hi2";

class DuplicateError extends Error {
  conflicts: DuplicateConflicts;

  constructor(message: string, conflicts: Partial<DuplicateConflicts>) {
    super(message);
    this.name = "DuplicateError";
    this.conflicts = {
      customers: conflicts.customers ?? [],
      tempContacts: conflicts.tempContacts ?? [],
    };
  }
}

type TempContactRow = {
  id: string;
  drmId?: string;
  drm_id?: string;
  title?: string;
  personName?: string;
  person_name?: string;
  raw_name?: string;
  email?: string;
  mobile?: string;
  phone?: string;
  source?: string;
  grade?: string;
  comment?: string;
  country?: string;
  status?: string;
  serviceTypes?: string[];
  service_types?: string[] | string;
  createdAt?: string;
  created_at?: string;
};

async function createTemporaryContact(values: TempContactFormValues) {
  const res = await fetch("/api/customer/temporary-contact", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json", ...getAuthHeaders() },
    body: JSON.stringify(values),
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 409) {
    throw new DuplicateError(
      (data?.message as string) || "We found matching records with this email or mobile.",
      (data?.conflicts as Partial<DuplicateConflicts>) || {},
    );
  }
  if (!res.ok) {
    throw new Error((data?.error as string) || "Failed to submit temporary account");
  }
  return data;
}

function formatServiceTypes(raw: TempContactRow["serviceTypes"] | TempContactRow["service_types"]) {
  if (Array.isArray(raw)) return raw.join(", ");
  if (typeof raw === "string" && raw.length) return raw;
  return "—";
}

function formatCreatedDate(value?: string) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function TemporaryContactView() {
  const router = useRouter();
  const [form, setForm] = useState<TempContactFormValues>(EMPTY_TEMP_CONTACT_FORM);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [conflicts, setConflicts] = useState<DuplicateConflicts | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [liveDuplicate, setLiveDuplicate] = useState({ emailExists: false, mobileExists: false });
  const [savedFlash, setSavedFlash] = useState(false);

  const { data: meta, loading: metaLoading, error: metaError, refetch: refetchMeta } =
    useApiResource<TemporaryContactMeta>("/api/customer/temporary-contact/meta");

  const {
    data: contactsList,
    loading: contactsLoading,
    error: contactsError,
    refetch: refetchContacts,
  } = useApiResource<TempContactRow[]>("/api/customer/temporary-contact");

  const contacts = contactsList ?? [];

  const availableMeta = useMemo(
    () => ({
      titles: meta?.titles?.length ? meta.titles : TEMP_CONTACT_FALLBACK_META.titles,
      sources: meta?.sources ?? [],
      grades: meta?.grades?.length ? meta.grades : TEMP_CONTACT_FALLBACK_META.grades,
      serviceTypes: meta?.serviceTypes?.length ? meta.serviceTypes : TEMP_CONTACT_FALLBACK_META.serviceTypes,
    }),
    [meta],
  );

  const serviceTypeColumns = useMemo(
    () => buildTempContactServiceColumns(availableMeta.serviceTypes as string[]),
    [availableMeta.serviceTypes],
  );

  const setField = useCallback(<K extends keyof TempContactFormValues>(key: K, value: TempContactFormValues[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setFieldErrors((prev) => {
      const next = { ...prev };
      delete next[key as string];
      return next;
    });
  }, []);

  useEffect(() => {
    const email = form.email.trim();
    const mobile = form.mobile;
    const emailLooksComplete = /\S+@\S+\.\S+/.test(email);
    const mobileDigits = mobile.replace(/\D/g, "");
    const mobileLooksComplete = mobileDigits.length >= 7;

    if (!emailLooksComplete && !mobileLooksComplete) {
      setLiveDuplicate({ emailExists: false, mobileExists: false });
      return;
    }

    const timer = window.setTimeout(async () => {
      try {
        const params = new URLSearchParams();
        if (emailLooksComplete) params.set("email", email);
        if (mobileLooksComplete) params.set("mobile", mobile);
        const data = await apiFetch<{ emailExists?: boolean; mobileExists?: boolean }>(
          `/api/customer/temporary-contact/check-duplicate?${params.toString()}`,
        );
        const emailExists = emailLooksComplete && !!data.emailExists;
        const mobileExists = mobileLooksComplete && !!data.mobileExists;
        setLiveDuplicate({ emailExists, mobileExists });
        setFieldErrors((prev) => {
          const next = { ...prev };
          if (emailExists) next.email = "This email already exists";
          else if (next.email === "This email already exists") delete next.email;
          if (mobileExists) next.mobile = "This mobile number already exists";
          else if (next.mobile === "This mobile number already exists") delete next.mobile;
          return next;
        });
      } catch {
        /* submit-time 409 still guards */
      }
    }, 450);

    return () => window.clearTimeout(timer);
  }, [form.email, form.mobile]);

  const hasConflicts =
    !!conflicts && ((conflicts.customers?.length ?? 0) > 0 || (conflicts.tempContacts?.length ?? 0) > 0);

  const goToConvertForm = (contact: TempContactRow) => {
    sessionStorage.setItem(
      "convertTempContact",
      JSON.stringify({
        id: contact.id,
        title: contact.title,
        personName: contact.personName || contact.person_name || contact.raw_name,
        email: contact.email,
        mobile: contact.mobile || contact.phone,
        source: contact.source,
        grade: contact.grade,
        comment: contact.comment,
        country: contact.country,
        serviceTypes: contact.serviceTypes || contact.service_types || [],
      }),
    );
    router.push(`${CUSTOMER_ADD_CUSTOMER}?fromTempContact=${contact.id}`);
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setConflicts(null);
    const parsed = tempContactFormSchema.safeParse(form);
    if (!parsed.success) {
      const next: Record<string, string> = {};
      parsed.error.issues.forEach((issue) => {
        const key = issue.path[0];
        if (typeof key === "string") next[key] = issue.message;
      });
      setFieldErrors(next);
      return;
    }
    if (liveDuplicate.emailExists || liveDuplicate.mobileExists) {
      toast.error("Resolve duplicate email or mobile before submitting.");
      return;
    }

    setSubmitting(true);
    try {
      await createTemporaryContact(parsed.data);
      toast.success("Temporary account saved.");
      setSavedFlash(true);
      window.setTimeout(() => setSavedFlash(false), 4000);
      setForm(EMPTY_TEMP_CONTACT_FORM);
      setFieldErrors({});
      refetchContacts();
    } catch (err) {
      if (err instanceof DuplicateError) {
        setConflicts(err.conflicts);
        const all = [...err.conflicts.customers, ...err.conflicts.tempContacts];
        const submittedEmail = form.email.trim().toLowerCase();
        const submittedMobileDigits = form.mobile.replace(/\D/g, "");
        const next = { ...fieldErrors };
        if (all.some((c) => c.email?.trim().toLowerCase() === submittedEmail)) {
          next.email = "This email already exists";
        }
        if (all.some((c) => c.mobile?.replace(/\D/g, "") === submittedMobileDigits)) {
          next.mobile = "This mobile number already exists";
        }
        setFieldErrors(next);
        toast.error(err.message);
        return;
      }
      toast.error(err instanceof Error ? err.message : "Failed to submit temporary account.");
    } finally {
      setSubmitting(false);
    }
  };

  if (metaError) {
    return (
      <Card>
        <PageHeader eyebrow="Customer" title="Temporary Contact" />
        <PageError message={metaError} onRetry={refetchMeta} />
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <PageHeader
          eyebrow="Temporary Account"
          title="Temporary Account"
          description="Capture quick lead details that can be promoted later."
        />
        {savedFlash ? (
          <p className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200">
            Saved successfully.
          </p>
        ) : null}

        <form onSubmit={onSubmit} className="space-y-5">
          {hasConflicts ? (
            <div
              className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-amber-950 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100"
              data-testid="alert-duplicate"
            >
              <p className="font-semibold">We found matching records</p>
              <p className="mt-1 text-sm">
                Email or mobile already exists in customers or temporary contacts. Please review before proceeding.
              </p>
              {conflicts?.customers?.length ? (
                <div className="mt-3">
                  <p className="text-xs font-semibold uppercase text-zinc-600 dark:text-zinc-400">Customers</p>
                  <ul className="mt-1 space-y-1 text-sm">
                    {conflicts.customers.map((item) => (
                      <li key={`customer-${item.id}`}>
                        <span className="font-medium">{item.name || "Unknown"}</span>
                        {item.email ? ` • ${item.email}` : ""}
                        {item.mobile ? ` • ${item.mobile}` : ""}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {conflicts?.tempContacts?.length ? (
                <div className="mt-3">
                  <p className="text-xs font-semibold uppercase text-zinc-600 dark:text-zinc-400">Temporary Contacts</p>
                  <ul className="mt-1 space-y-1 text-sm">
                    {conflicts.tempContacts.map((item) => (
                      <li key={`temp-${item.id}`}>
                        <span className="font-medium">{item.name || "Unknown"}</span>
                        {item.email ? ` • ${item.email}` : ""}
                        {item.mobile ? ` • ${item.mobile}` : ""}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          ) : null}

          <div className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
            <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">Primary Detail</h2>
            <p className="mb-4 text-sm text-zinc-500">Who are you capturing this request for?</p>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Field id="temp-title" label="Title *" error={fieldErrors.title}>
                <Select
                  id="temp-title"
                  disabled={metaLoading}
                  value={form.title}
                  onChange={(e) => setField("title", e.target.value)}
                  invalid={!!fieldErrors.title}
                >
                  <option value="">Choose…</option>
                  {availableMeta.titles.map((title) => (
                    <option key={title} value={title}>
                      {title}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field id="temp-fullName" label="Person Full Name *" error={fieldErrors.fullName}>
                <Input
                  id="temp-fullName"
                  placeholder="Enter full name"
                  value={form.fullName}
                  onChange={(e) => setField("fullName", e.target.value)}
                  invalid={!!fieldErrors.fullName}
                />
              </Field>
              <Field id="temp-email" label="Email *" error={fieldErrors.email}>
                <Input
                  id="temp-email"
                  type="email"
                  placeholder="name@email.com"
                  value={form.email}
                  onChange={(e) => setField("email", e.target.value)}
                  invalid={!!fieldErrors.email}
                />
              </Field>
              <Field id="temp-mobile" label="Mobile *" error={fieldErrors.mobile}>
                <Input
                  id="temp-mobile"
                  placeholder="Enter company mobile no"
                  maxLength={11}
                  value={form.mobile}
                  onChange={(e) => setField("mobile", e.target.value.replace(/\D/g, "").slice(0, 11))}
                  invalid={!!fieldErrors.mobile}
                />
              </Field>
            </div>
            <Field id="temp-comment" label="Your Comment" className="mt-4">
              <Textarea
                id="temp-comment"
                placeholder="Add any context for this lead"
                className="resize-none"
                value={form.comment ?? ""}
                onChange={(e) => setField("comment", e.target.value)}
              />
            </Field>
          </div>

          <div className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
            <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">Lead Detail</h2>
            <p className="mb-4 text-sm text-zinc-500">Source, grade, and services of interest.</p>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Field id="temp-source" label="Source *" error={fieldErrors.source}>
                <Select
                  id="temp-source"
                  disabled={metaLoading}
                  value={form.source}
                  onChange={(e) => setField("source", e.target.value)}
                  invalid={!!fieldErrors.source}
                >
                  <option value="">Choose…</option>
                  {availableMeta.sources.map((source) => (
                    <option key={source} value={source}>
                      {source}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field id="temp-grade" label="Grade *" error={fieldErrors.grade}>
                <Select
                  id="temp-grade"
                  disabled={metaLoading}
                  value={form.grade}
                  onChange={(e) => setField("grade", e.target.value)}
                  invalid={!!fieldErrors.grade}
                >
                  <option value="">Choose…</option>
                  {availableMeta.grades.map((grade) => (
                    <option key={grade} value={grade}>
                      {grade}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>

            <div className="mt-4">
              <p className="mb-2 text-sm font-medium text-zinc-800 dark:text-zinc-200">Service Type</p>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                {serviceTypeColumns.map((column, columnIndex) => (
                  <div key={`service-column-${columnIndex}`} className="space-y-2">
                    {column.map((service) => (
                      <label
                        key={service}
                        className="flex items-start gap-2 rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                      >
                        <input
                          type="checkbox"
                          className="mt-0.5"
                          checked={form.serviceTypes.includes(service)}
                          onChange={() => {
                            setForm((prev) => {
                              const next = new Set(prev.serviceTypes);
                              if (next.has(service)) next.delete(service);
                              else next.add(service);
                              return { ...prev, serviceTypes: Array.from(next) };
                            });
                          }}
                        />
                        <span className="leading-snug">{service}</span>
                      </label>
                    ))}
                  </div>
                ))}
              </div>
              <p className="mt-2 text-xs text-zinc-500">Select at least one service (recommended).</p>
            </div>

            <div className="mt-6 flex justify-end">
              <Button
                type="submit"
                disabled={submitting || liveDuplicate.emailExists || liveDuplicate.mobileExists}
              >
                {submitting ? "Submitting…" : "Submit form"}
              </Button>
            </div>
          </div>
        </form>
      </Card>

      <Card>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-zinc-200 pb-3 dark:border-zinc-800">
          <div>
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Temporary Contacts List</h2>
            <p className="text-xs text-zinc-500">All temporary lead contacts captured in the system.</p>
          </div>
          <Badge variant="neutral">Total: {contacts.length}</Badge>
        </div>

        {contactsError ? (
          <PageError message={contactsError} onRetry={refetchContacts} />
        ) : contactsLoading ? (
          <PageLoading label="Loading temporary contacts…" />
        ) : (
          <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
            <table className="w-full min-w-[960px] text-left text-xs">
              <thead className="bg-zinc-50 dark:bg-zinc-900/80">
                <tr>
                  {[
                    "#",
                    "DRM ID",
                    "Person Name",
                    "Email",
                    "Mobile",
                    "Source",
                    "Grade",
                    "Service Types",
                    "Status",
                    "Created Date",
                    "Action",
                  ].map((h) => (
                    <th key={h} className="px-3 py-3 font-semibold text-zinc-700 dark:text-zinc-200">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {contacts.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="px-4 py-10 text-center text-zinc-500">
                      No temporary contacts recorded yet.
                    </td>
                  </tr>
                ) : (
                  contacts.map((contact, idx) => {
                    const services = formatServiceTypes(contact.serviceTypes ?? contact.service_types);
                    const status = contact.status || "Pending";
                    return (
                      <tr key={contact.id} className="border-t border-zinc-100 dark:border-zinc-800">
                        <td className="px-3 py-2 font-mono text-zinc-500">{idx + 1}</td>
                        <td className="px-3 py-2 font-semibold">{contact.drmId || contact.drm_id || "—"}</td>
                        <td className="px-3 py-2 font-medium">
                          {contact.title ? `${contact.title}. ` : ""}
                          {contact.personName || contact.person_name || contact.raw_name || "—"}
                        </td>
                        <td className="px-3 py-2">{contact.email || "—"}</td>
                        <td className="px-3 py-2">{contact.mobile || contact.phone || "—"}</td>
                        <td className="px-3 py-2">{contact.source || "—"}</td>
                        <td className="px-3 py-2">
                          <Badge variant="warning">{contact.grade || "—"}</Badge>
                        </td>
                        <td className="max-w-[220px] truncate px-3 py-2" title={String(services)}>
                          {services}
                        </td>
                        <td className="px-3 py-2">
                          <Badge variant="brand">{status}</Badge>
                        </td>
                        <td className="px-3 py-2 text-zinc-500">
                          {formatCreatedDate(contact.createdAt || contact.created_at)}
                        </td>
                        <td className="px-3 py-2">
                          {status === "Pending" ? (
                            <Button type="button" size="sm" variant="secondary" onClick={() => goToConvertForm(contact)}>
                              <HiOutlineUserPlus className="mr-1 h-4 w-4" />
                              Convert to Customer
                            </Button>
                          ) : (
                            "—"
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
