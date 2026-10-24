"use client";

import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { PageError, PageLoading } from "@/components/ui/page-states";
import { useApiResource } from "@/lib/hooks/use-api-resource";
import { apiFetch } from "@/lib/api/browser-client";
import { toast } from "@/lib/toast";
import { GmPoolAddForm } from "./gm-pool-add-form";
import {
  EMPTY_GM_FORM,
  GM_FALLBACK_PACKAGES,
  type GmFormState,
  type GmPoolRow,
} from "./gm-pool-constants";
import { computeGmNumericValues, EMPTY_GM_LOAN_ROW, type GmLoanRow } from "./gm-pool-numeric";
import { uploadGmPaymentProof } from "./gm-pool-payment-upload";
import {
  formatGmRounded,
  getAccountApprovalLabel,
  getHodApprovalLabel,
  getLatestPayDate,
  gmRowActionState,
} from "./gm-pool-list-utils";
import { cn } from "@/lib/utils/cn";
import {
  HiOutlineArrowDownTray,
  HiOutlineClock,
  HiOutlineDocumentText,
  HiOutlineEye,
  HiOutlinePencilSquare,
  HiOutlinePrinter,
  HiOutlineTrash,
} from "react-icons/hi2";

type GmPoolResponse = {
  data: GmPoolRow[];
  total: number;
  page: number;
  pageSize: number;
  totalPages?: number;
};

function companyNameForCheck(label: string) {
  return label.split(/[•·(]/)[0].trim();
}

export function GmPoolView() {
  const [page, setPage] = useState(1);
  const [pageSize] = useState("25");
  const [search, setSearch] = useState("");
  const [listTick, setListTick] = useState(0);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<GmFormState>(EMPTY_GM_FORM);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [viewRow, setViewRow] = useState<GmPoolRow | null>(null);
  const [editRow, setEditRow] = useState<GmPoolRow | null>(null);
  const [loanRows, setLoanRows] = useState<GmLoanRow[]>([{ ...EMPTY_GM_LOAN_ROW }]);
  const [withdrawId, setWithdrawId] = useState<string | null>(null);
  const [withdrawReason, setWithdrawReason] = useState("");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [dupCheck, setDupCheck] = useState<{ memberIdExists?: boolean; orderIdExists?: boolean; companyExists?: boolean }>({});
  const [paymentProof, setPaymentProof] = useState<File | null>(null);

  const packagesPath = "/api/gm-packages";
  const { data: packagesRes } = useApiResource<{ packages?: typeof GM_FALLBACK_PACKAGES }>(packagesPath);
  const packages = packagesRes?.packages?.length ? packagesRes.packages : GM_FALLBACK_PACKAGES;

  const listPath = useMemo(() => {
    const params = new URLSearchParams({ page: String(page), pageSize });
    if (search.trim()) params.set("search", search.trim());
    if (listTick > 0) params.set("refresh", String(listTick));
    return `/api/gm-pool?${params.toString()}`;
  }, [page, pageSize, search, listTick]);

  const { data, loading, error, refetch } = useApiResource<GmPoolResponse>(listPath);
  const rows = data?.data ?? [];
  const total = data?.total ?? 0;
  const totalPages = data?.totalPages ?? Math.max(1, Math.ceil(total / Number(pageSize)));

  const setField = <K extends keyof GmFormState>(key: K, value: GmFormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setFieldErrors((prev) => {
      const next = { ...prev };
      delete next[key as string];
      return next;
    });
  };

  const companyCheckName = companyNameForCheck(form.companyName);

  useEffect(() => {
    if (companyCheckName.length < 2 && !form.memberId && !form.orderId) return;
    const timer = window.setTimeout(async () => {
      try {
        const params = new URLSearchParams();
        if (companyCheckName.length >= 2) params.set("companyName", companyCheckName);
        if (form.memberId.trim()) params.set("memberId", form.memberId.trim());
        if (form.orderId.trim()) params.set("orderId", form.orderId.trim());
        if (editRow?.id) params.set("excludeId", editRow.id);
        const json = await apiFetch<typeof dupCheck>(`/api/gm-pool/check-duplicate?${params.toString()}`);
        setDupCheck(json);
      } catch {
        setDupCheck({});
      }
    }, 400);
    return () => window.clearTimeout(timer);
  }, [companyCheckName, form.memberId, form.orderId, editRow?.id]);

  const resetForm = () => {
    setForm(EMPTY_GM_FORM);
    setEditRow(null);
    setLoanRows([{ ...EMPTY_GM_LOAN_ROW }]);
    setFieldErrors({});
    setPaymentProof(null);
  };

  const openEdit = (row: GmPoolRow) => {
    const matched = row.package
      ? packages.find((p) => p.name.toLowerCase() === String(row.package).toLowerCase())
      : undefined;
    const installments = Array.isArray(row.installments) ? row.installments : [];
    setEditRow(row);
    setShowForm(true);
    setForm({
      ...EMPTY_GM_FORM,
      companyName: row.company || row.customerName || "",
      memberId: row.memberId || "",
      orderId: row.orderId || "",
      packageId: matched?.id || "",
      pkrAmount: row.pkr != null ? String(row.pkr) : "",
      dollarRate: row.dollarRate != null ? String(row.dollarRate) : "",
      alibabaDiscount: row.abDiscount != null ? String(row.abDiscount) : "0",
      paymentStatus: row.paymentStatus || row.status || "",
      type: row.type || "New",
      dropout: row.dropout || "",
      extension: row.extension || "",
      detail: "",
      loanMode: row.isLoan ? "loan" : row.isPartialPayment ? "installment" : "none",
    });
    setPaymentProof(null);
    setLoanRows(
      installments.length
        ? installments.map((inst: Record<string, unknown>) => ({
            dollar: inst.dollar != null ? String(inst.dollar) : "",
            pkrAmount: inst.pkrAmount != null ? String(inst.pkrAmount) : inst.pkr != null ? String(inst.pkr) : "",
            chequeNo: String(inst.chequeNo || ""),
            payDate: String(inst.payDate || ""),
          }))
        : [{ ...EMPTY_GM_LOAN_ROW }],
    );
  };

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!form.companyId && !form.companyName.trim()) errs.companyName = "Company is required";
    if (dupCheck.companyExists && !editRow) errs.companyName = "This company already has an active GM entry";
    if (!form.memberId.trim()) errs.memberId = "Member Id is required";
    else if (dupCheck.memberIdExists) errs.memberId = "Member ID already exists";
    if (!form.orderId.trim()) errs.orderId = "Order Id is required";
    else if (dupCheck.orderIdExists) errs.orderId = "Order ID already exists";
    if (!form.packageId) errs.packageId = "Package is required";
    if (!(Number(form.pkrAmount) > 0)) errs.pkrAmount = "PKR amount required";
    if (!(Number(form.dollarRate) > 0)) errs.dollarRate = "Dollar rate required";
    if (!form.paymentStatus) errs.paymentStatus = "Payment status required";
    const needsProof =
      (form.paymentStatus === "Customer Paid" || form.paymentStatus === "Online Paid") && !editRow;
    if (needsProof && !paymentProof) errs.paymentProof = "Payment screenshot is required";
    if (form.loanMode !== "none") {
      const bad = loanRows.find((r) => (Number(r.dollar) || 0) > 0 && (!r.chequeNo.trim() || !r.payDate.trim()));
      if (bad) errs.general = "Cheque No and Pay Date are required for each installment row with an amount.";
    }
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const submitGm = async () => {
    if (!validate()) return;
    const selectedPackage = packages.find((p) => p.id === form.packageId);
    if (!selectedPackage) return;
    const numericValues = computeGmNumericValues(form.pkrAmount, form.dollarRate, form.alibabaDiscount, selectedPackage);
    setSubmitting(true);
    try {
      let paymentProofUrl: string | null = editRow?.paymentProofUrl ?? null;
      if (paymentProof) {
        paymentProofUrl = await uploadGmPaymentProof(paymentProof);
      }
      const installments = loanRows.map((row) => ({ ...row, pkr: row.pkrAmount }));
      const sharedPayload = {
        dropout: form.dropout.trim() || null,
        extension: form.extension.trim() || null,
        detail: form.detail.trim() || undefined,
      };
      if (editRow) {
        await apiFetch(`/api/gm-pool/${editRow.id}`, {
          method: "PATCH",
          json: {
            package: selectedPackage.name,
            type: form.type.trim(),
            memberId: form.memberId.trim(),
            orderId: form.orderId.trim(),
            orderDollar: numericValues.orderDollar,
            finalOrderDollar: numericValues.finalOrderDollar,
            customerDollar: numericValues.customerDollar,
            dollarRate: numericValues.dollarRateNum,
            pkr: numericValues.pkrAmountNum,
            alibabaDiscount: numericValues.alibabaDiscountNum,
            extraDollarDiscount: numericValues.extraDollarDiscount,
            extraDiscountPkr: numericValues.extraDiscountPkr,
            paymentStatus: form.paymentStatus,
            installments,
            ...sharedPayload,
          },
        });
        toast.success("GM entry updated.");
      } else {
        await apiFetch("/api/gm", {
          method: "POST",
          json: {
            companyId: /^[0-9a-fA-F-]{36}$/.test(form.companyId) ? form.companyId : undefined,
            companyName: form.companyName,
            memberId: form.memberId.trim(),
            orderId: form.orderId.trim(),
            packageId: selectedPackage.id,
            packageName: selectedPackage.name,
            pkrAmount: numericValues.pkrAmountNum,
            dollarRate: numericValues.dollarRateNum,
            alibabaDiscount: numericValues.alibabaDiscountNum,
            paymentStatus: form.paymentStatus.trim(),
            type: form.type.trim(),
            loanMode: form.loanMode,
            paymentProofUrl,
            installments,
            ...sharedPayload,
          },
        });
        toast.success("GM entry created.");
      }
      resetForm();
      setShowForm(false);
      setListTick((n) => n + 1);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save GM entry.");
    } finally {
      setSubmitting(false);
    }
  };

  const submitWithdraw = async () => {
    if (!withdrawId || !withdrawReason.trim()) return;
    try {
      await apiFetch(`/api/gm-pool/${withdrawId}/request-withdraw`, {
        method: "POST",
        json: { reason: withdrawReason.trim() },
      });
      toast.success("Withdrawal request sent.");
      setWithdrawId(null);
      setWithdrawReason("");
      setListTick((n) => n + 1);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Withdraw failed.");
    }
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    try {
      await apiFetch(`/api/gm-pool/${deleteId}`, { method: "DELETE" });
      toast.success("GM entry deleted.");
      setDeleteId(null);
      setListTick((n) => n + 1);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed.");
    }
  };

  const requestUpdate = async (id: string) => {
    try {
      await apiFetch(`/api/gm-pool/${id}/request-update`, { method: "POST", json: {} });
      toast.success("Update request sent to Super HOD.");
      setListTick((n) => n + 1);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Request update failed.");
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <PageHeader eyebrow="Customer" title="Gm Bv Pool" description="Gold Member pool — list entries and add new GM orders." />
        <div className="flex flex-wrap items-center gap-3">
          <Input
            className="max-w-xs"
            placeholder="Search GM pool…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
          <Button
            type="button"
            onClick={() => {
              if (showForm) resetForm();
              setShowForm((v) => !v);
            }}
          >
            {showForm ? "Hide form" : "Add GM"}
          </Button>
        </div>
      </Card>

      {showForm ? (
        <Card>
          <GmPoolAddForm
            form={form}
            setField={setField}
            packages={packages}
            fieldErrors={fieldErrors}
            loanRows={loanRows}
            setLoanRows={setLoanRows}
            editRowId={editRow?.id ?? null}
            duplicateHints={{
              memberId: dupCheck.memberIdExists,
              orderId: dupCheck.orderIdExists,
              companyBlock: dupCheck.companyExists && !editRow,
              companyMessage: dupCheck.companyExists && !editRow ? "Active GM already exists for this company" : undefined,
            }}
            paymentProof={paymentProof}
            onPaymentProofChange={setPaymentProof}
            paymentProofError={fieldErrors.paymentProof}
            submitting={submitting}
            onSubmit={() => void submitGm()}
            onCancel={() => {
              resetForm();
              setShowForm(false);
            }}
          />
        </Card>
      ) : null}

      <Card>
        {error ? (
          <PageError message={error} onRetry={refetch} />
        ) : loading ? (
          <PageLoading label="Loading GM pool…" />
        ) : (
          <>
            <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
              <table className="w-full min-w-[2400px] text-left text-xs">
                <thead className="bg-zinc-50 dark:bg-zinc-900/80">
                  <tr>
                    {[
                      "DRM ID",
                      "Member ID",
                      "Order ID",
                      "Company",
                      "Sales Person",
                      "Package",
                      "Type",
                      "Pkg $",
                      "Order $",
                      "Customer $",
                      "Rate",
                      "PKR",
                      "AB Disc",
                      "Extra Disc",
                      "Extra PKR",
                      "Dropout",
                      "Status",
                      "Created",
                      "HOD",
                      "Accountant",
                      "Pay Date",
                      "Actions",
                    ].map((h) => (
                      <th key={h} className="whitespace-nowrap px-2 py-3 font-semibold">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 ? (
                    <tr>
                      <td colSpan={22} className="px-4 py-10 text-center text-zinc-500">
                        No GM entries found.
                      </td>
                    </tr>
                  ) : (
                    rows.map((row) => {
                      const hod = getHodApprovalLabel(row);
                      const acct = getAccountApprovalLabel(row);
                      const actions = gmRowActionState(row);
                      return (
                        <tr key={row.id} className="border-t border-zinc-100 dark:border-zinc-800">
                          <td className="whitespace-nowrap px-2 py-2 font-mono font-semibold text-emerald-700 dark:text-emerald-400">
                            {row.drmId || row.id.slice(0, 8)}
                          </td>
                          <td className="px-2 py-2 font-mono">{row.memberId || "—"}</td>
                          <td className="px-2 py-2 font-mono">{row.orderId || "—"}</td>
                          <td className="max-w-[180px] truncate px-2 py-2 font-medium" title={row.company || row.customerName}>
                            {row.company || row.customerName || "—"}
                          </td>
                          <td className="px-2 py-2">{row.salesPersonName || "—"}</td>
                          <td className="px-2 py-2">
                            <Badge variant="neutral">{row.package || "—"}</Badge>
                          </td>
                          <td className="px-2 py-2">{row.type || "—"}</td>
                          <td className="px-2 py-2">{row.packagePrice ?? "—"}</td>
                          <td className="px-2 py-2">{row.orderDollar ?? "—"}</td>
                          <td className="px-2 py-2">{row.customerDollar ?? "—"}</td>
                          <td className="px-2 py-2">{row.dollarRate ?? "—"}</td>
                          <td className="px-2 py-2">{formatGmRounded(row.pkr)}</td>
                          <td className="px-2 py-2">{row.abDiscount ?? "—"}</td>
                          <td className="px-2 py-2">{formatGmRounded(row.extraDiscount)}</td>
                          <td className="px-2 py-2">{formatGmRounded(row.extraPkrDiscount)}</td>
                          <td className="px-2 py-2">{row.dropout || "—"}</td>
                          <td className="px-2 py-2">
                            <Badge variant="neutral">{row.status || row.paymentStatus || "—"}</Badge>
                          </td>
                          <td className="whitespace-nowrap px-2 py-2">
                            {row.createdAt ? new Date(row.createdAt).toLocaleDateString() : "—"}
                          </td>
                          <td className="px-2 py-2">
                            <Badge
                              variant="neutral"
                              className={cn(
                                hod.tone === "ok" && "border-emerald-200 text-emerald-700",
                                hod.tone === "bad" && "border-red-200 text-red-700",
                                hod.tone === "warn" && "border-amber-200 text-amber-700",
                              )}
                            >
                              {hod.text}
                            </Badge>
                          </td>
                          <td className="px-2 py-2">
                            <Badge
                              variant="neutral"
                              className={cn(
                                acct.tone === "ok" && "border-emerald-200 text-emerald-700",
                                acct.tone === "bad" && "border-red-200 text-red-700",
                                acct.tone === "warn" && "border-amber-200 text-amber-700",
                              )}
                            >
                              {acct.text}
                            </Badge>
                          </td>
                          <td className="whitespace-nowrap px-2 py-2">{getLatestPayDate(row)}</td>
                          <td className="px-2 py-2">
                            <div className="flex flex-wrap items-center gap-0.5">
                              <Button type="button" size="sm" variant="ghost" title="View" onClick={() => setViewRow(row)}>
                                <HiOutlineEye className="h-4 w-4" />
                              </Button>
                              <Button type="button" size="sm" variant="ghost" title="Follow-up" disabled>
                                <HiOutlineClock className="h-4 w-4 opacity-40" />
                              </Button>
                              <a
                                href={`/gm-pool/${row.id}/print`}
                                title="Print"
                                className="inline-flex h-8 w-8 items-center justify-center rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800"
                              >
                                <HiOutlinePrinter className="h-4 w-4" />
                              </a>
                              <a
                                href={`/gm-pool/${row.id}/history`}
                                title="History"
                                className="inline-flex h-8 w-8 items-center justify-center rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800"
                              >
                                <HiOutlineDocumentText className="h-4 w-4" />
                              </a>
                              {actions.canEdit ? (
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="ghost"
                                  title={actions.isHodRejected ? "Resubmit to HOD" : "Edit entry"}
                                  onClick={() => openEdit(row)}
                                >
                                  <HiOutlinePencilSquare className="h-4 w-4" />
                                </Button>
                              ) : null}
                              {actions.canWithdraw ? (
                                <Button type="button" size="sm" variant="ghost" title="Withdraw" onClick={() => setWithdrawId(row.id)}>
                                  <HiOutlineArrowDownTray className="h-4 w-4" />
                                </Button>
                              ) : null}
                              {actions.canDelete ? (
                                <Button type="button" size="sm" variant="ghost" title="Delete" onClick={() => setDeleteId(row.id)}>
                                  <HiOutlineTrash className="h-4 w-4 text-red-600" />
                                </Button>
                              ) : null}
                              {actions.updatePending ? (
                                <span className="rounded border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold text-amber-700">
                                  Pending Super HOD
                                </span>
                              ) : null}
                              {actions.canRequestUpdate ? (
                                <Button type="button" size="sm" variant="ghost" title="Request update" onClick={() => void requestUpdate(row.id)}>
                                  <HiOutlinePencilSquare className="h-4 w-4 text-sky-600" />
                                </Button>
                              ) : null}
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
                {total} entries · page {page}/{totalPages}
              </span>
              <div className="flex gap-2">
                <Button type="button" variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                  Previous
                </Button>
                <Button type="button" variant="secondary" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
                  Next
                </Button>
              </div>
            </div>
          </>
        )}
      </Card>

      {viewRow ? (
        <dialog open className="fixed inset-0 z-50 m-auto max-h-[85vh] w-[min(720px,95vw)] overflow-y-auto rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-700 dark:bg-zinc-900">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-lg font-semibold">GM entry</h3>
            <Button type="button" variant="ghost" size="sm" onClick={() => setViewRow(null)}>
              Close
            </Button>
          </div>
          <div className="grid grid-cols-1 gap-3 text-sm md:grid-cols-2">
            {[
              ["Company", viewRow.company || viewRow.customerName],
              ["Member / Order", `${viewRow.memberId || "—"} / ${viewRow.orderId || "—"}`],
              ["Package", viewRow.package],
              ["Payment status", viewRow.status || viewRow.paymentStatus],
              ["PKR", formatGmRounded(viewRow.pkr)],
              ["Order $", viewRow.orderDollar],
              ["Customer $", viewRow.customerDollar],
              ["HOD", getHodApprovalLabel(viewRow).text],
              ["Accountant", getAccountApprovalLabel(viewRow).text],
            ].map(([label, val]) => (
              <div key={String(label)} className="rounded-lg border border-zinc-200 px-3 py-2 dark:border-zinc-800">
                <p className="text-xs font-semibold uppercase text-zinc-500">{label}</p>
                <p className="font-medium">{val ?? "—"}</p>
              </div>
            ))}
          </div>
          {viewRow.paymentProofUrl ? (
            <a
              href={viewRow.paymentProofUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-4 inline-block text-sm font-semibold text-emerald-600 hover:underline"
            >
              View payment screenshot
            </a>
          ) : null}
        </dialog>
      ) : null}

      {withdrawId ? (
        <dialog open className="fixed inset-0 z-50 m-auto max-w-md rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-700 dark:bg-zinc-900">
          <h3 className="font-semibold">Request withdrawal</h3>
          <Input className="mt-3" placeholder="Reason" value={withdrawReason} onChange={(e) => setWithdrawReason(e.target.value)} />
          <div className="mt-4 flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setWithdrawId(null)}>
              Cancel
            </Button>
            <Button type="button" onClick={() => void submitWithdraw()}>
              Send request
            </Button>
          </div>
        </dialog>
      ) : null}

      {deleteId ? (
        <dialog open className="fixed inset-0 z-50 m-auto max-w-md rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-700 dark:bg-zinc-900">
          <h3 className="font-semibold">Delete GM entry?</h3>
          <div className="mt-4 flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setDeleteId(null)}>
              Cancel
            </Button>
            <Button type="button" variant="danger" onClick={() => void confirmDelete()}>
              Delete
            </Button>
          </div>
        </dialog>
      ) : null}
    </div>
  );
}
