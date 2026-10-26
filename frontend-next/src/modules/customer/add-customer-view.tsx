"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api/browser-client";
import { ApiError } from "@/lib/api/errors";
import { useApiResource } from "@/lib/hooks/use-api-resource";
import { toast } from "@/lib/toast";
import {
  AB_TYPES,
  COMPANY_TYPES,
  customerFormSchema,
  EMPTY_CUSTOMER_FORM,
  GRADES,
  REGIONS,
  SERVICE_TYPES,
  SOURCES,
  STATUSES,
  TITLES,
  type CustomerFormData,
} from "./add-customer-constants";
import { buildCreateCustomerPayload } from "./add-customer-payload";
import { BusinessLineTreeSelect } from "./business-line-tree-select";
import {
  downloadCustomerImportTemplate,
  importCustomersFromCsvFile,
  type ImportResult,
} from "./add-customer-import";
import {
  CUSTOMER_DUPLICATE_CHECKER,
  CUSTOMER_PRIVATE_POOL,
  CUSTOMER_PUBLIC_POOL,
  CUSTOMER_TEMP_CONTACT,
} from "@/lib/navigation/customer-routes";
import { generateAddCustomerTestData } from "./add-customer-autofill";
import { HiOutlineArrowLeft, HiOutlineMagnifyingGlass, HiOutlineSparkles } from "react-icons/hi2";

function DynamicListField({
  label,
  values,
  fieldChecks,
  prefix,
  onChange,
  onBlur,
  onAdd,
  onRemove,
  placeholder,
  type = "text",
}: {
  label: string;
  values: string[];
  fieldChecks: Record<string, { available: boolean; message: string }>;
  prefix: string;
  onChange: (index: number, value: string) => void;
  onBlur: (index: number, value: string) => void;
  onAdd: () => void;
  onRemove: (index: number) => void;
  placeholder: string;
  type?: string;
}) {
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
        {label} <span className="text-red-500">*</span>{" "}
        <span className="text-xs font-normal text-zinc-500">({values.length}/5 max)</span>
      </p>
      {values.map((val, index) => {
        const isLast = index === values.length - 1;
        const showAdd = isLast && values.length < 5;
        const key = `${prefix}_${index}`;
        return (
          <div key={index} className="space-y-1">
            <div className="flex gap-2">
              <Input
                type={type}
                placeholder={index === 0 ? placeholder : `Additional ${label.toLowerCase()}`}
                value={val}
                onChange={(e) => onChange(index, e.target.value)}
                onBlur={(e) => onBlur(index, e.target.value)}
              />
              <Button
                type="button"
                variant={showAdd ? "primary" : "danger"}
                className="shrink-0 px-3"
                onClick={() => (showAdd ? onAdd() : onRemove(index))}
              >
                {showAdd ? "+" : "−"}
              </Button>
            </div>
            {fieldChecks[key]?.message ? (
              <p className="text-xs text-red-600 dark:text-red-400">{fieldChecks[key].message}</p>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

export function AddCustomerView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const fromTempContactId = searchParams.get("fromTempContact") || undefined;
  const isFromPublicPool = searchParams.get("fromPublicPool") === "true";

  const [form, setForm] = useState<CustomerFormData>(EMPTY_CUSTOMER_FORM);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [emailsList, setEmailsList] = useState<string[]>([""]);
  const [mobilesList, setMobilesList] = useState<string[]>([""]);
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [companyCheck, setCompanyCheck] = useState({ available: true, message: "" });
  const [fieldChecks, setFieldChecks] = useState<Record<string, { available: boolean; message: string }>>({});
  const [editCustomerId, setEditCustomerId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: products } = useApiResource<{ id: string; name: string }[]>("/api/posting/products");

  const setF = useCallback(<K extends keyof CustomerFormData>(key: K, value: CustomerFormData[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setFieldErrors((prev) => {
      const next = { ...prev };
      delete next[key as string];
      return next;
    });
  }, []);

  const pageTitle = useMemo(() => {
    if (isFromPublicPool) return "Pick Up Customer";
    if (fromTempContactId) return "Convert to Customer";
    return "Add Customer";
  }, [fromTempContactId, isFromPublicPool]);

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- one-time sessionStorage prefill from legacy flows */
    let raw: string | null = null;
    if (isFromPublicPool) raw = sessionStorage.getItem("pickupPublicPool");
    else if (fromTempContactId) raw = sessionStorage.getItem("convertTempContact");

    if (!raw) return;
    try {
      const source = JSON.parse(raw) as Record<string, unknown>;
      if (fromTempContactId && source.id !== fromTempContactId) return;

      if (isFromPublicPool) {
        setEditCustomerId(String(source.id ?? ""));
        const emailList = Array.isArray(source.emails) && source.emails.length
          ? (source.emails as string[])
          : source.email
            ? [String(source.email)]
            : [""];
        const mobileList = Array.isArray(source.mobiles) && source.mobiles.length
          ? (source.mobiles as string[])
          : source.mobile
            ? [String(source.mobile)]
            : [""];
        setEmailsList(emailList);
        setMobilesList(mobileList);
        setForm((prev) => ({
          ...prev,
          companyName: String(source.companyName ?? source.company ?? ""),
          accountName: String(source.accountName ?? source.accHolder ?? ""),
          email: emailList[0] || "",
          emails: emailList,
          phone: String(source.phone ?? source.contactNo ?? ""),
          mobile: mobileList[0] || "",
          mobiles: mobileList,
          country: String(source.country ?? ""),
          city: String(source.city ?? ""),
          address: String(source.address ?? ""),
          website: String(source.website ?? ""),
          cnic: String(source.cnic ?? ""),
          ntn: String(source.ntn ?? ""),
          source: String(source.source ?? ""),
          grade: String(source.grade ?? ""),
          status: String(source.status ?? "New"),
          comment: String(source.lastNote ?? source.comment ?? ""),
          region: String(source.region ?? ""),
          title: String(source.title ?? ""),
          personName: String(source.personName ?? ""),
          designation: String(source.designation ?? ""),
          companyType: String(source.companyType ?? ""),
          businessLine: String(source.businessLine ?? ""),
          rcLink: String(source.rcLink ?? ""),
          abType: String(source.abType ?? ""),
        }));
        setSelectedServices((source.serviceTypes as string[]) ?? (source.service_types as string[]) ?? []);
        sessionStorage.removeItem("pickupPublicPool");
        return;
      }

      const region = REGIONS.includes(String(source.country)) ? String(source.country) : "";
      if (source.email) setEmailsList([String(source.email)]);
      if (source.mobile) setMobilesList([String(source.mobile)]);
      setForm((prev) => ({
        ...prev,
        companyName: String(source.personName ?? ""),
        email: String(source.email ?? ""),
        emails: source.email ? [String(source.email)] : [],
        phone: String(source.mobile ?? ""),
        source: String(source.source ?? ""),
        grade: String(source.grade ?? ""),
        comment: String(source.comment ?? ""),
        country: region,
        region,
        serviceTypes: (source.serviceTypes as string[]) ?? [],
      }));
      setSelectedServices((source.serviceTypes as string[]) ?? []);
      sessionStorage.removeItem("convertTempContact");
    } catch {
      /* ignore bad session payload */
    }
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [fromTempContactId, isFromPublicPool]);

  const handleCompanyNameBlur = async (name: string) => {
    const trimmed = name.trim();
    if (trimmed.length < 2 || editCustomerId) return;
    try {
      const result = await apiFetch<{ available?: boolean }>(
        `/api/sales/customers/check-company?name=${encodeURIComponent(trimmed)}`,
      );
      if (result.available === false) {
        setCompanyCheck({ available: false, message: "Company name already exists!" });
      } else setCompanyCheck({ available: true, message: "" });
    } catch {
      /* non-blocking */
    }
  };

  const handleFieldBlur = useCallback(
    async (fieldPath: string, value: string) => {
      const val = value?.trim();
      if (!val || val.length < 2) {
        setFieldChecks((prev) => ({ ...prev, [fieldPath]: { available: true, message: "" } }));
        return;
      }
      const isEmail = fieldPath.startsWith("email");
      const isMobile = fieldPath.startsWith("mobile");
      const checkField = isEmail ? "email" : isMobile ? "mobile" : fieldPath;

      if (isEmail) {
        const count = emailsList.filter((e) => e.trim().toLowerCase() === val.toLowerCase()).length;
        if (count > 1) {
          setFieldChecks((prev) => ({
            ...prev,
            [fieldPath]: { available: false, message: "Duplicate email on this form" },
          }));
          return;
        }
      }
      if (isMobile) {
        const count = mobilesList.filter((m) => m.trim() === val.trim()).length;
        if (count > 1) {
          setFieldChecks((prev) => ({
            ...prev,
            [fieldPath]: { available: false, message: "Duplicate mobile number on this form" },
          }));
          return;
        }
        const phoneVal = (form.phone || "").replace(/\D/g, "");
        const thisVal = val.replace(/\D/g, "");
        if (phoneVal && thisVal && phoneVal === thisVal) {
          setFieldChecks((prev) => ({
            ...prev,
            [fieldPath]: { available: false, message: "Same as Contact No — already exists on this form" },
          }));
          return;
        }
      }
      if (fieldPath === "phone") {
        const thisVal = val.replace(/\D/g, "");
        const firstMobile = (mobilesList[0] || "").replace(/\D/g, "");
        if (firstMobile && thisVal && firstMobile === thisVal) {
          setFieldChecks((prev) => ({
            ...prev,
            [fieldPath]: { available: false, message: "Same as Mobile — already exists on this form" },
          }));
          return;
        }
      }

      if (editCustomerId) return;

      try {
        const result = await apiFetch<{ available?: boolean }>(
          `/api/sales/customers/check-field?field=${encodeURIComponent(checkField)}&value=${encodeURIComponent(val)}`,
        );
        if (result.available === false) {
          let displayLabel = isEmail ? "Email Address" : isMobile ? "Mobile Number" : fieldPath.toUpperCase();
          if (fieldPath === "phone") displayLabel = "Contact Number";
          setFieldChecks((prev) => ({
            ...prev,
            [fieldPath]: { available: false, message: `${displayLabel} already exists!` },
          }));
        } else {
          setFieldChecks((prev) => ({ ...prev, [fieldPath]: { available: true, message: "" } }));
        }
      } catch {
        /* non-blocking */
      }
    },
    [editCustomerId, emailsList, form.phone, mobilesList],
  );

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const draft = {
      ...form,
      email: emailsList[0]?.trim().toLowerCase() || form.email,
      emails: emailsList,
      mobile: mobilesList[0]?.replace(/\D/g, "") || form.mobile,
      mobiles: mobilesList,
      serviceTypes: selectedServices,
    };
    const parsed = customerFormSchema.safeParse(draft);
    if (!parsed.success) {
      const errs: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const path = issue.path[0];
        if (typeof path === "string") errs[path] = issue.message;
      }
      setFieldErrors(errs);
      toast.error("Please fix validation errors.");
      return;
    }

    if (companyCheck.available === false && !editCustomerId) {
      toast.error("Company name already exists in the system.");
      return;
    }
    const failed = Object.entries(fieldChecks).filter(([, c]) => c.available === false);
    if (failed.length > 0) {
      toast.error(`Duplicates found: ${failed.map(([f]) => f).join(", ")}`);
      return;
    }

    setSubmitting(true);
    try {
      const payload = buildCreateCustomerPayload(parsed.data, emailsList, mobilesList, selectedServices, editCustomerId);
      const result = await apiFetch<{ success?: boolean; message?: string; data?: { id?: string } }>(
        "/api/sales/customers",
        { method: "POST", json: payload },
      );
      if (result?.success === false) throw new Error(result.message || "Failed to add customer");

      if (fromTempContactId && result.data?.id) {
        try {
          await apiFetch(`/api/customer/temporary-contact/${fromTempContactId}/convert`, {
            method: "POST",
            json: { customerId: result.data.id },
          });
        } catch {
          /* logged server-side */
        }
      }

      toast.success(
        editCustomerId
          ? "Customer updated."
          : fromTempContactId
            ? "Converted to customer."
            : "Customer added successfully.",
      );

      if (fromTempContactId || editCustomerId) {
        router.push(CUSTOMER_PRIVATE_POOL);
      } else {
        setForm(EMPTY_CUSTOMER_FORM);
        setEmailsList([""]);
        setMobilesList([""]);
        setSelectedServices([]);
        setCompanyCheck({ available: true, message: "" });
        setFieldChecks({});
      }
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : err instanceof Error ? err.message : "Save failed");
    } finally {
      setSubmitting(false);
    }
  };

  const applyAutoFillTestData = () => {
    const { form: autoValues, emails, mobiles, services } = generateAddCustomerTestData();
    setForm(autoValues);
    setEmailsList(emails);
    setMobilesList(mobiles);
    setSelectedServices(services);
    setCompanyCheck({ available: true, message: "" });
    setFieldChecks({});
    setFieldErrors({});
    toast.success("Auto fill applied — test data populated.");
  };

  const checkDuplicates = () => {
    const q = new URLSearchParams();
    if (form.companyName) q.set("company", form.companyName);
    if (emailsList[0]) q.set("email", emailsList[0]);
    router.push(`${CUSTOMER_DUPLICATE_CHECKER}?${q.toString()}`);
  };

  const cancelHref = fromTempContactId
    ? CUSTOMER_TEMP_CONTACT
    : isFromPublicPool
      ? CUSTOMER_PUBLIC_POOL
      : CUSTOMER_DUPLICATE_CHECKER;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-start gap-3">
          <Button type="button" variant="ghost" size="sm" onClick={() => router.push(cancelHref)} aria-label="Back">
            <HiOutlineArrowLeft className="h-5 w-5" />
          </Button>
          <PageHeader eyebrow="Customer" title={pageTitle} description="Company, contact, and lead classification." />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200"
            onClick={applyAutoFillTestData}
          >
            <HiOutlineSparkles className="mr-1 h-4 w-4" />
            Auto Fill Test Data
          </Button>
          <Button type="button" variant="secondary" size="sm" onClick={checkDuplicates}>
            <HiOutlineMagnifyingGlass className="mr-1 h-4 w-4" />
            Check Duplicates
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            className="hidden"
            onChange={(ev) => {
              const f = ev.target.files?.[0];
              if (f) setImportFile(f);
              ev.target.value = "";
            }}
          />
          <Button type="button" variant="secondary" size="sm" onClick={() => setImportOpen(true)}>
            Import CSV
          </Button>
          <Button type="button" variant="secondary" size="sm" onClick={downloadCustomerImportTemplate}>
            Download Template
          </Button>
        </div>
      </div>

      <form onSubmit={onSubmit} className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="space-y-4 p-4">
          <h2 className="font-semibold text-zinc-900 dark:text-zinc-100">Company detail</h2>
          <Field id="companyName" label="Company Name *" error={fieldErrors.companyName}>
            <Input
              id="companyName"
              value={form.companyName}
              onChange={(e) => setF("companyName", e.target.value)}
              onBlur={(e) => void handleCompanyNameBlur(e.target.value)}
            />
          </Field>
          {companyCheck.message ? <p className="text-xs text-red-600">{companyCheck.message}</p> : null}
          <Field id="country" label="Country *" error={fieldErrors.country}>
            <Select id="country" value={form.country} onChange={(e) => setF("country", e.target.value)}>
              <option value="">Select country</option>
              {REGIONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </Select>
          </Field>
          <Field id="city" label="City">
            <Input id="city" value={form.city ?? ""} onChange={(e) => setF("city", e.target.value)} />
          </Field>
          <Field id="address" label="Address">
            <Textarea id="address" value={form.address ?? ""} onChange={(e) => setF("address", e.target.value)} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field id="crmId" label="CRM ID">
              <Input
                id="crmId"
                value={form.crmId ?? ""}
                onChange={(e) => setF("crmId", e.target.value)}
                onBlur={(e) => void handleFieldBlur("crm_id", e.target.value)}
              />
            </Field>
            <Field id="crmDate" label="CRM Date">
              <Input
                id="crmDate"
                type="date"
                value={form.crmDate ?? ""}
                onChange={(e) => setF("crmDate", e.target.value)}
              />
            </Field>
          </div>
          <Field id="phone" label="Contact No">
            <Input
              id="phone"
              value={form.phone ?? ""}
              maxLength={11}
              onChange={(e) => setF("phone", e.target.value.replace(/\D/g, "").slice(0, 11))}
              onBlur={(e) => void handleFieldBlur("phone", e.target.value)}
            />
          </Field>
          {fieldChecks.phone?.message ? <p className="text-xs text-red-600">{fieldChecks.phone.message}</p> : null}
          <Field id="companyType" label="Company Type">
            <Select id="companyType" value={form.companyType ?? ""} onChange={(e) => setF("companyType", e.target.value)}>
              <option value="">Select type</option>
              {COMPANY_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </Select>
          </Field>
          <Field id="abType" label="AB Type">
            <Select id="abType" value={form.abType ?? ""} onChange={(e) => setF("abType", e.target.value)}>
              <option value="">Select AB type</option>
              {AB_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </Select>
          </Field>
          <div>
            <p className="mb-2 text-sm font-medium">Business Line (Posting Products)</p>
            {!products ? (
              <p className="text-sm text-zinc-500">Loading products…</p>
            ) : (
              <BusinessLineTreeSelect
                options={products.map((p) => p.name)}
                value={form.businessLine ? form.businessLine.split("\n").filter(Boolean) : []}
                onChange={(vals) => setF("businessLine", vals.join("\n"))}
              />
            )}
          </div>
        </Card>

        <Card className="space-y-4 p-4">
          <h2 className="font-semibold text-zinc-900 dark:text-zinc-100">Primary detail</h2>
          <Field id="title" label="Title *" error={fieldErrors.title}>
            <Select id="title" value={form.title} onChange={(e) => setF("title", e.target.value)}>
              <option value="">Title</option>
              {TITLES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </Select>
          </Field>
          <Field id="personName" label="Person Name">
            <Input id="personName" value={form.personName ?? ""} onChange={(e) => setF("personName", e.target.value)} />
          </Field>
          <Field id="accountName" label="Account Holder Name *" error={fieldErrors.accountName}>
            <Input id="accountName" value={form.accountName} onChange={(e) => setF("accountName", e.target.value)} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field id="cnic" label="CNIC">
              <Input
                id="cnic"
                maxLength={13}
                value={form.cnic ?? ""}
                onChange={(e) => setF("cnic", e.target.value.replace(/\D/g, "").slice(0, 13))}
                onBlur={(e) => void handleFieldBlur("cnic", e.target.value)}
              />
            </Field>
            <Field id="ntn" label="NTN">
              <Input
                id="ntn"
                maxLength={13}
                value={form.ntn ?? ""}
                onChange={(e) => setF("ntn", e.target.value.replace(/\D/g, "").slice(0, 13))}
                onBlur={(e) => void handleFieldBlur("ntn", e.target.value)}
              />
            </Field>
          </div>
          <Field id="website" label="Website">
            <Input id="website" value={form.website ?? ""} onChange={(e) => setF("website", e.target.value)} />
          </Field>
          <DynamicListField
            label="Email"
            values={emailsList}
            fieldChecks={fieldChecks}
            prefix="email"
            type="email"
            placeholder="Enter company e-mail"
            onChange={(i, v) => {
              const next = [...emailsList];
              next[i] = v;
              setEmailsList(next);
              setF("email", next[0]?.trim().toLowerCase() || "");
              setF("emails", next);
            }}
            onBlur={(i, v) => {
              if (i === 0) setF("email", v.trim().toLowerCase());
              void handleFieldBlur(`email_${i}`, v);
            }}
            onAdd={() => emailsList.length < 5 && setEmailsList([...emailsList, ""])}
            onRemove={(i) => {
              if (emailsList.length <= 1) return;
              const next = emailsList.filter((_, idx) => idx !== i);
              setEmailsList(next);
              setF("email", next[0] || "");
              setF("emails", next);
            }}
          />
          <DynamicListField
            label="Mobile"
            values={mobilesList}
            fieldChecks={fieldChecks}
            prefix="mobile"
            placeholder="Enter company mobile no"
            onChange={(i, v) => {
              const clean = v.replace(/\D/g, "").slice(0, 11);
              const next = [...mobilesList];
              next[i] = clean;
              setMobilesList(next);
              setF("mobile", next[0] || "");
              setF("mobiles", next);
            }}
            onBlur={(i, v) => {
              if (i === 0) setF("mobile", v.replace(/\D/g, ""));
              void handleFieldBlur(`mobile_${i}`, v);
            }}
            onAdd={() => mobilesList.length < 5 && setMobilesList([...mobilesList, ""])}
            onRemove={(i) => {
              if (mobilesList.length <= 1) return;
              const next = mobilesList.filter((_, idx) => idx !== i);
              setMobilesList(next);
              setF("mobile", next[0] || "");
              setF("mobiles", next);
            }}
          />
          <Field id="designation" label="Designation">
            <Input id="designation" value={form.designation ?? ""} onChange={(e) => setF("designation", e.target.value)} />
          </Field>
          <Field id="comment" label="Your Comment">
            <Textarea id="comment" value={form.comment ?? ""} onChange={(e) => setF("comment", e.target.value)} />
          </Field>
        </Card>

        <Card className="space-y-4 p-4">
          <h2 className="font-semibold text-zinc-900 dark:text-zinc-100">Lead detail</h2>
          <Field id="rcLink" label="RC Link">
            <Input id="rcLink" value={form.rcLink ?? ""} onChange={(e) => setF("rcLink", e.target.value)} />
          </Field>
          <Field id="source" label="Source">
            <Select id="source" value={form.source ?? ""} onChange={(e) => setF("source", e.target.value)}>
              <option value="">Lead source</option>
              {SOURCES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </Select>
          </Field>
          <Field id="grade" label="Grade">
            <Select id="grade" value={form.grade ?? ""} onChange={(e) => setF("grade", e.target.value)}>
              <option value="">Select grade</option>
              {GRADES.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </Select>
          </Field>
          <Field id="status" label="Status">
            <Select id="status" value={form.status} onChange={(e) => setF("status", e.target.value)}>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </Select>
          </Field>
          <Field id="region" label="Region">
            <Select id="region" value={form.region ?? ""} onChange={(e) => setF("region", e.target.value)}>
              <option value="">Select region</option>
              {REGIONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </Select>
          </Field>
          <div>
            <p className="mb-2 text-sm font-medium">Service Type</p>
            <div className="max-h-[200px] space-y-2 overflow-y-auto rounded-md border border-zinc-200 p-3 dark:border-zinc-800">
              {SERVICE_TYPES.map((service) => (
                <label key={service} className="flex cursor-pointer items-start gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="mt-0.5"
                    checked={selectedServices.includes(service)}
                    onChange={() =>
                      setSelectedServices((prev) =>
                        prev.includes(service) ? prev.filter((s) => s !== service) : [...prev, service],
                      )
                    }
                  />
                  <span>{service}</span>
                </label>
              ))}
            </div>
          </div>
        </Card>

        <div className="flex justify-end gap-3 lg:col-span-3">
          <Button type="button" variant="secondary" onClick={() => router.push(cancelHref)}>
            Cancel
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting ? "Saving…" : fromTempContactId ? "Convert & Save" : "Save Customer"}
          </Button>
        </div>
      </form>

      {importOpen ? (
        <dialog open className="fixed inset-0 z-50 m-auto max-w-md rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-700 dark:bg-zinc-900">
          <h3 className="text-lg font-semibold">Import Customers from CSV</h3>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">Choose a CSV file, then confirm import.</p>
          <div className="mt-4">
            {importFile ? (
              <p className="text-sm font-medium">{importFile.name}</p>
            ) : (
              <Button type="button" variant="secondary" onClick={() => fileInputRef.current?.click()}>
                Choose file
              </Button>
            )}
          </div>
          <div className="mt-6 flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => { setImportOpen(false); setImportFile(null); }}>
              Cancel
            </Button>
            <Button
              type="button"
              disabled={!importFile || importing}
              onClick={async () => {
                if (!importFile) return;
                setImporting(true);
                try {
                  const result = await importCustomersFromCsvFile(importFile);
                  setImportResult(result);
                  setImportOpen(false);
                  setImportFile(null);
                  toast.success(`Imported ${result.successCount} customers (${result.failCount} failed).`);
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : "Import failed");
                } finally {
                  setImporting(false);
                }
              }}
            >
              {importing ? "Importing…" : "Import"}
            </Button>
          </div>
        </dialog>
      ) : null}

      {importResult ? (
        <dialog open className="fixed inset-0 z-50 m-auto max-w-md rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-700 dark:bg-zinc-900">
          <h3 className="text-lg font-semibold">Import completed</h3>
          <p className="mt-2 text-sm">
            Success: {importResult.successCount}, failed: {importResult.failCount}
          </p>
          {importResult.errors.length > 0 ? (
            <ul className="mt-2 max-h-40 overflow-y-auto text-xs text-red-600">
              {importResult.errors.slice(0, 8).map((err, i) => (
                <li key={i}>{err}</li>
              ))}
            </ul>
          ) : null}
          <Button type="button" className="mt-4" onClick={() => setImportResult(null)}>
            Close
          </Button>
        </dialog>
      ) : null}
    </div>
  );
}
