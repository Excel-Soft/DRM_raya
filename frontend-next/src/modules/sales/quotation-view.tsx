"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { PageLoading } from "@/components/ui/page-states";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useApiResource } from "@/lib/hooks/use-api-resource";
import { apiFetch } from "@/lib/api/browser-client";
import { toast } from "@/lib/toast";
import { CUSTOMER_PRIVATE_POOL } from "@/lib/navigation/customer-routes";
import { ProductSelectField } from "./product-select-field";
import {
  flattenSalesProducts,
  isDomainHostingSslProduct,
  quotationLineUsd,
  type FlatProduct,
  type ServiceTreeNode,
} from "./sales-product-catalog";
import { InvoiceReceipt, WEBEXCELS_FROM, type InvoiceReceiptData } from "./invoice-receipt";
import { downloadElementAsPdf } from "@/lib/pdf/download-element-as-pdf";
import { pdfFileNameForCompany } from "@/lib/pdf/pdf-file-name";
import { plainTextForPdf } from "@/lib/pdf/plain-text";

type QuotationItem = {
  id?: string;
  productId: string;
  detail: string;
  minTime?: number;
  maxTime?: number;
  unitPrice: number;
  quantity: number;
  startYear: number;
  endYear: number;
  domainUrl?: string;
};

type FormState = {
  id?: string;
  leadId?: string;
  accountHolder: string;
  company: string;
  email: string;
  contact: string;
  deliveryTimeMin: string;
  deliveryTimeMax: string;
  gstPercent: number;
  discountType: "PERCENT" | "AMOUNT";
  discountValue: number;
  paymentTermPercent: number;
  note: string;
  saveStatus: string;
  dollarRate: number;
  items: QuotationItem[];
  createdAt: string;
};

const emptyItem = (): QuotationItem => ({
  productId: "",
  detail: "",
  unitPrice: 0,
  quantity: 1,
  startYear: new Date().getFullYear(),
  endYear: new Date().getFullYear(),
});

export function QuotationView({ leadId, quotationId }: { leadId?: string; quotationId?: string }) {
  const router = useRouter();
  const [form, setForm] = useState<FormState>({
    accountHolder: "",
    company: "",
    email: "",
    contact: "",
    deliveryTimeMin: "",
    deliveryTimeMax: "",
    gstPercent: 0,
    discountType: "AMOUNT",
    discountValue: 0,
    paymentTermPercent: 0,
    note: "",
    saveStatus: "Saved",
    dollarRate: 280,
    items: [emptyItem()],
    createdAt: new Date().toISOString(),
  });
  const [saving, setSaving] = useState(false);
  const [bootLoading, setBootLoading] = useState(!!leadId || !!quotationId);
  const [showReceipt, setShowReceipt] = useState(false);
  const [receiptQuotationId, setReceiptQuotationId] = useState<string>("");
  const receiptRef = useRef<HTMLDivElement>(null);
  const pdfAfterSaveRef = useRef(false);

  const { data: servicesRes, loading: servicesLoading } = useApiResource<{ items?: ServiceTreeNode[] } | ServiceTreeNode[]>(
    "/api/sales/services",
  );
  const { data: meData } = useApiResource<{ id?: string; data?: { department?: string } }>("/api/auth/me");
  const myUserId = meData?.id;
  const currentDepartment = meData?.data?.department;

  const locksPath = leadId ? `/api/sales/customers/${leadId}/service-locks` : null;
  const { data: locksRes } = useApiResource<{ locks: Array<{ subServiceId: string; lockedByUserId: string }> }>(locksPath);

  const followedUpProductIds = useMemo(
    () =>
      new Set(
        (locksRes?.locks || []).filter((l) => l.lockedByUserId === myUserId).map((l) => l.subServiceId),
      ),
    [locksRes?.locks, myUserId],
  );

  const flatProducts = useMemo(() => {
    const raw = Array.isArray(servicesRes) ? servicesRes : servicesRes?.items ?? [];
    return flattenSalesProducts(raw, false);
  }, [servicesRes]);

  const hasDomainCols = form.items.some((it) => isDomainHostingSslProduct(it.productId, flatProducts));

  const computed = useMemo(() => {
    const subAmount = form.items.reduce(
      (sum, it) => sum + quotationLineUsd(it.productId, it.unitPrice, it.quantity, flatProducts),
      0,
    );
    const gstAmount = subAmount * (Number(form.gstPercent || 0) / 100);
    const totalAmount = subAmount + gstAmount;
    const amount = totalAmount * (Number(form.paymentTermPercent || 0) / 100);
    const grandTotal = amount;
    const pkrTotalRaw = grandTotal * Number(form.dollarRate || 280);
    const discount =
      form.discountType === "PERCENT"
        ? pkrTotalRaw * (Number(form.discountValue || 0) / 100)
        : Number(form.discountValue || 0);
    const pkrTotal = Math.max(pkrTotalRaw - discount, 0);
    return { subAmount, gstAmount, totalAmount, grandTotal, pkrTotal, calculatedAmount: amount };
  }, [form, flatProducts]);

  const quotationReceiptData: InvoiceReceiptData | null = useMemo(() => {
    const qid = receiptQuotationId || form.id || "draft";
    const rate = Number(form.dollarRate || 280);
    const pkrBeforeDiscount = computed.grandTotal * rate;
    const discountPkr =
      form.discountType === "PERCENT"
        ? pkrBeforeDiscount * (Number(form.discountValue || 0) / 100)
        : Number(form.discountValue || 0);

    return {
      invoiceNumber: qid,
      date: new Date(form.createdAt || Date.now()),
      from: WEBEXCELS_FROM,
      to: {
        name: form.company || form.accountHolder || "N/A",
        phone: form.contact || "N/A",
        email: form.email || "N/A",
        address: "...",
      },
      items: form.items.map((it) => {
        const lineUsd = quotationLineUsd(it.productId, it.unitPrice, it.quantity, flatProducts);
        return {
          name: flatProducts.find((p) => p.id === it.productId)?.name || "Service",
          detail: plainTextForPdf(it.detail),
          price: it.unitPrice,
          quantity: it.quantity,
          total: Math.round(lineUsd * rate),
        };
      }),
      subTotalUsd: computed.subAmount,
      subTotalPkr: Math.round(computed.subAmount * rate),
      taxUsd: computed.gstAmount,
      discountPkr: Math.round(discountPkr),
      totalPkr: Math.round(computed.pkrTotal),
    };
  }, [receiptQuotationId, form, flatProducts, computed]);

  const runQuotationPdf = useCallback(async () => {
    const el = receiptRef.current;
    if (!el) {
      toast.error("Quotation slip is not ready yet — try again in a moment.");
      return false;
    }
    try {
      await downloadElementAsPdf(el, pdfFileNameForCompany(form.company || form.accountHolder));
      return true;
    } catch (e) {
      console.error("Quotation PDF error:", e);
      toast.error("Failed to generate quotation PDF.");
      return false;
    }
  }, [form.company, form.accountHolder]);

  useEffect(() => {
    if (!showReceipt || !pdfAfterSaveRef.current) return;

    let cancelled = false;
    let attempts = 0;

    const finish = () => {
      pdfAfterSaveRef.current = false;
      setShowReceipt(false);
      router.push(CUSTOMER_PRIVATE_POOL);
    };

    const tryDownload = () => {
      if (cancelled) return;
      attempts += 1;
      if (!receiptRef.current) {
        if (attempts < 30) {
          requestAnimationFrame(tryDownload);
          return;
        }
        toast.error("Failed to generate quotation PDF.");
        finish();
        return;
      }
      window.setTimeout(() => {
        void runQuotationPdf().finally(finish);
      }, 400);
    };

    tryDownload();
    return () => {
      cancelled = true;
    };
  }, [showReceipt, quotationReceiptData, runQuotationPdf, router]);

  useEffect(() => {
    if (!leadId || quotationId) return;
    let cancelled = false;
    (async () => {
      try {
        const data = await apiFetch<{ lead?: Record<string, string> }>(`/api/sales/leads/${leadId}/profile`);
        if (cancelled) return;
        const lead = data?.lead ?? {};
        setForm((prev) => ({
          ...prev,
          leadId,
          accountHolder: lead.accountName || prev.accountHolder,
          company: lead.companyName || prev.company,
          email: lead.email || prev.email,
          contact: lead.phone || lead.mobile || prev.contact,
        }));
      } finally {
        if (!cancelled) setBootLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [leadId, quotationId]);

  useEffect(() => {
    if (!quotationId) {
      if (!leadId) setBootLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const data = await apiFetch<{ data?: { quotation: Record<string, unknown>; items: unknown[] } }>(
          `/api/quotations/${quotationId}`,
        );
        if (cancelled) return;
        const q = data?.data?.quotation as Record<string, unknown>;
        const items = (data?.data?.items ?? []) as Record<string, unknown>[];
        let deliveryMin = "";
        let deliveryMax = "";
        if (q.deliveryTime) {
          const parts = String(q.deliveryTime).split("-");
          if (parts.length >= 2) {
            deliveryMin = parts[0].trim();
            deliveryMax = parts[1].trim();
          } else deliveryMin = String(q.deliveryTime).trim();
        }
        setForm({
          id: String(q.id),
          leadId: String(q.customerId || leadId || ""),
          accountHolder: String(q.accountHolder ?? ""),
          company: String(q.company ?? ""),
          email: String(q.email ?? ""),
          contact: String(q.contact ?? ""),
          deliveryTimeMin: deliveryMin,
          deliveryTimeMax: deliveryMax,
          gstPercent: Number(q.gstPercent ?? 0),
          discountType: (q.discountType as "PERCENT" | "AMOUNT") ?? "AMOUNT",
          discountValue: Number(q.discountValue ?? 0),
          paymentTermPercent: Number(q.paymentTermPercent ?? 0),
          note: String(q.note ?? ""),
          saveStatus: String(q.saveStatus ?? "Saved"),
          dollarRate: Number(q.dollarRate ?? 280),
          createdAt: String(q.createdAt || new Date().toISOString()),
          items: items.length
            ? items.map((it) => ({
                id: it.id ? String(it.id) : undefined,
                productId: String(it.productId ?? ""),
                detail: String(it.detail ?? ""),
                minTime: it.minTime != null ? Number(it.minTime) : undefined,
                maxTime: it.maxTime != null ? Number(it.maxTime) : undefined,
                unitPrice: Number(it.unitPrice ?? 0),
                quantity: Number(it.quantity ?? 1),
                startYear: Number(it.startYear ?? new Date().getFullYear()),
                endYear: Number(it.endYear ?? new Date().getFullYear()),
                domainUrl: String(it.domainUrl ?? ""),
              }))
            : [emptyItem()],
        });
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed to load quotation");
      } finally {
        if (!cancelled) setBootLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [quotationId, leadId]);

  const updateItem = (idx: number, patch: Partial<QuotationItem>) => {
    setForm((prev) => {
      const items = [...prev.items];
      items[idx] = { ...items[idx], ...patch };
      return { ...prev, items };
    });
  };

  const pickProduct = (idx: number, product: FlatProduct) => {
    updateItem(idx, {
      productId: product.id,
      detail: product.description ?? product.name ?? "",
      quantity: 1,
      unitPrice: Number(product.price || 0),
      minTime: product.minDay ?? product.minTime,
      maxTime: product.maxDay ?? product.maxTime,
    });
  };

  const validateDepartments = () => {
    for (const item of form.items) {
      if (!item.productId) continue;
      if (followedUpProductIds.has(item.productId)) continue;
      const product = flatProducts.find((p) => p.id === item.productId);
      if (!product) continue;
      const routeDepts = product.routeDepartments || [];
      if (routeDepts.length === 0) {
        toast.error(`Target department not found for "${product.name}".`);
        return false;
      }
      if (currentDepartment && !routeDepts.includes(currentDepartment)) {
        toast.error(`Department not allowed for "${product.name}".`);
        return false;
      }
    }
    return true;
  };

  const save = async () => {
    if (!validateDepartments()) return;
    setSaving(true);
    try {
      let deliveryTimeStr = "";
      if (form.deliveryTimeMin || form.deliveryTimeMax) {
        deliveryTimeStr = `${form.deliveryTimeMin || ""} - ${form.deliveryTimeMax || ""}`.trim();
        if (deliveryTimeStr === "-") deliveryTimeStr = "";
      }
      const body = {
        leadId: form.leadId,
        customerId: form.leadId,
        accountHolder: form.accountHolder,
        company: form.company,
        email: form.email,
        contact: form.contact,
        deliveryTime: deliveryTimeStr,
        gstPercent: form.gstPercent,
        discountType: form.discountType,
        discountValue: form.discountValue,
        paymentTermPercent: form.paymentTermPercent,
        saveStatus: form.saveStatus,
        note: form.note,
        amount: computed.calculatedAmount,
        dollarRate: form.dollarRate,
        subAmount: computed.subAmount,
        totalAmount: computed.totalAmount,
        grandTotal: computed.grandTotal,
        items: form.items.map((it) => ({
          productId: it.productId,
          detail: it.detail,
          minTime: it.minTime,
          maxTime: it.maxTime,
          unitPrice: it.unitPrice,
          quantity: it.quantity,
          startYear: it.startYear,
          endYear: it.endYear,
          domainUrl: it.domainUrl,
        })),
      };
      const res = form.id
        ? await apiFetch<{ data?: { quotation?: { id: string } } }>(`/api/quotations/${form.id}`, { method: "PUT", json: body })
        : await apiFetch<{ data?: { quotation?: { id: string } } }>("/api/quotations", { method: "POST", json: body });
      const newId = res?.data?.quotation?.id || form.id;
      if (newId) setForm((prev) => ({ ...prev, id: newId }));
      setReceiptQuotationId(newId || "saved");
      toast.success("Quotation saved.");
      pdfAfterSaveRef.current = true;
      setShowReceipt(true);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  };

  if (bootLoading || servicesLoading) {
    return <PageLoading label="Loading quotation…" />;
  }

  const d = new Date(form.createdAt);
  const dateStr = d.toLocaleString();

  return (
    <div className="mx-auto max-w-7xl space-y-4">
      <PageHeader eyebrow="Sales" title="Invoice Quotation" description={dateStr} />

      <Card className="overflow-hidden p-4 md:p-6">
        <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-4">
          {(
            [
              ["accountHolder", "Account Holder"],
              ["company", "Company"],
              ["email", "Email"],
              ["contact", "Contact"],
            ] as const
          ).map(([key, label]) => (
            <label key={key} className="block text-sm">
              <span className="font-medium text-zinc-600 dark:text-zinc-400">{label}</span>
              <Input
                className="mt-1 bg-white dark:bg-zinc-950"
                value={form[key]}
                onChange={(e) => setForm((prev) => ({ ...prev, [key]: e.target.value }))}
              />
            </label>
          ))}
        </div>

        <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="bg-zinc-50 text-xs font-semibold dark:bg-zinc-900/80">
              <tr>
                <th className="px-2 py-2">Product *</th>
                <th className="px-2 py-2">Detail *</th>
                {hasDomainCols ? (
                  <>
                    <th className="px-2 py-2">Min Time</th>
                    <th className="px-2 py-2">Max Time</th>
                  </>
                ) : null}
                <th className="px-2 py-2">Unit $</th>
                <th className="px-2 py-2">Qty</th>
                <th className="px-2 py-2">Total $</th>
                {hasDomainCols ? (
                  <>
                    <th className="px-2 py-2">Start Year</th>
                    <th className="px-2 py-2">End Year</th>
                    <th className="px-2 py-2">Domain URL</th>
                  </>
                ) : null}
                <th className="px-2 py-2" />
              </tr>
            </thead>
            <tbody>
              {form.items.map((item, idx) => (
                <tr key={idx} className="border-t border-zinc-100 dark:border-zinc-800">
                  <td className="min-w-[180px] px-2 py-2">
                    <ProductSelectField
                      value={item.productId}
                      flatProducts={flatProducts}
                      followedUpProductIds={followedUpProductIds}
                      checkRoleGate
                      onSelect={(p) => pickProduct(idx, p)}
                    />
                  </td>
                  <td className="min-w-[160px] px-2 py-2">
                    <Textarea rows={2} className="text-sm" value={item.detail} onChange={(e) => updateItem(idx, { detail: e.target.value })} />
                  </td>
                  {hasDomainCols ? (
                    <>
                      <td className="px-2 py-2">
                        {isDomainHostingSslProduct(item.productId, flatProducts) ? (
                          <Input type="number" value={item.minTime ?? ""} onChange={(e) => updateItem(idx, { minTime: Number(e.target.value) })} />
                        ) : null}
                      </td>
                      <td className="px-2 py-2">
                        {isDomainHostingSslProduct(item.productId, flatProducts) ? (
                          <Input type="number" value={item.maxTime ?? ""} onChange={(e) => updateItem(idx, { maxTime: Number(e.target.value) })} />
                        ) : null}
                      </td>
                    </>
                  ) : null}
                  <td className="px-2 py-2">
                    <Input type="number" value={item.unitPrice} onChange={(e) => updateItem(idx, { unitPrice: Number(e.target.value) })} />
                  </td>
                  <td className="px-2 py-2">
                    <Input type="number" value={item.quantity} onChange={(e) => updateItem(idx, { quantity: Number(e.target.value) })} />
                  </td>
                  <td className="px-2 py-2">
                    <Input
                      readOnly
                      value={quotationLineUsd(item.productId, item.unitPrice, item.quantity, flatProducts).toFixed(2)}
                    />
                  </td>
                  {hasDomainCols ? (
                    <>
                      <td className="px-2 py-2">
                        {isDomainHostingSslProduct(item.productId, flatProducts) ? (
                          <Input type="number" value={item.startYear} onChange={(e) => updateItem(idx, { startYear: Number(e.target.value) })} />
                        ) : null}
                      </td>
                      <td className="px-2 py-2">
                        {isDomainHostingSslProduct(item.productId, flatProducts) ? (
                          <Input type="number" value={item.endYear} onChange={(e) => updateItem(idx, { endYear: Number(e.target.value) })} />
                        ) : null}
                      </td>
                      <td className="px-2 py-2">
                        {isDomainHostingSslProduct(item.productId, flatProducts) ? (
                          <Input value={item.domainUrl ?? ""} onChange={(e) => updateItem(idx, { domainUrl: e.target.value })} />
                        ) : null}
                      </td>
                    </>
                  ) : null}
                  <td className="px-2 py-2">
                    <Button type="button" size="sm" variant="danger" onClick={() => setForm((prev) => ({ ...prev, items: prev.items.filter((_, i) => i !== idx) }))}>
                      Delete
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <Button type="button" className="mt-3" onClick={() => setForm((prev) => ({ ...prev, items: [...prev.items, emptyItem()] }))}>
          Add row
        </Button>

        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-4">
          <label className="text-sm">
            Dollar rate *
            <Input type="number" className="mt-1" value={form.dollarRate} onChange={(e) => setForm({ ...form, dollarRate: Number(e.target.value) })} />
          </label>
          <label className="text-sm">
            Sub amount
            <Input readOnly className="mt-1" value={computed.subAmount.toFixed(2)} />
          </label>
          <label className="text-sm md:col-span-2">
            Delivery time
            <div className="mt-1 flex gap-2">
              <Input value={form.deliveryTimeMin} onChange={(e) => setForm({ ...form, deliveryTimeMin: e.target.value })} />
              <span className="self-center text-zinc-400">—</span>
              <Input value={form.deliveryTimeMax} onChange={(e) => setForm({ ...form, deliveryTimeMax: e.target.value })} />
            </div>
          </label>
          <label className="text-sm">
            GST %
            <Input type="number" className="mt-1" value={form.gstPercent} onChange={(e) => setForm({ ...form, gstPercent: Number(e.target.value) })} />
          </label>
          <label className="text-sm">
            Payment term %
            <Select className="mt-1 w-full" value={String(form.paymentTermPercent)} onChange={(e) => setForm({ ...form, paymentTermPercent: Number(e.target.value) })}>
              {[0, 25, 50, 75, 100].map((n) => (
                <option key={n} value={n}>
                  {n}%
                </option>
              ))}
            </Select>
          </label>
          <label className="text-sm">
            Total amount
            <Input readOnly className="mt-1" value={computed.totalAmount.toFixed(2)} />
          </label>
          <label className="text-sm">
            Amount
            <Input readOnly className="mt-1" value={computed.calculatedAmount.toFixed(2)} />
          </label>
          <label className="text-sm">
            Discount type
            <Select
              className="mt-1 w-full"
              value={form.discountType}
              onChange={(e) => setForm({ ...form, discountType: e.target.value as "PERCENT" | "AMOUNT" })}
            >
              <option value="AMOUNT">Amount (PKR)</option>
              <option value="PERCENT">Percent</option>
            </Select>
          </label>
          <label className="text-sm">
            Discount value
            <Input type="number" className="mt-1" value={form.discountValue} onChange={(e) => setForm({ ...form, discountValue: Number(e.target.value) })} />
          </label>
          <label className="text-sm">
            $ Grand total
            <Input readOnly className="mt-1" value={computed.grandTotal.toFixed(2)} />
          </label>
          <label className="text-sm">
            PKR total
            <Input readOnly className="mt-1" value={String(Math.round(computed.pkrTotal))} />
          </label>
          <label className="text-sm">
            Save status
            <Select className="mt-1 w-full" value={form.saveStatus} onChange={(e) => setForm({ ...form, saveStatus: e.target.value })}>
              {["Draft", "Saved", "Sent"].map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </Select>
          </label>
          <label className="text-sm md:col-span-3">
            Note
            <Textarea className="mt-1" rows={2} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
          </label>
        </div>

        <div className="mt-6 flex gap-2">
          <Button type="button" disabled={saving} onClick={() => void save()}>
            {saving ? "Saving…" : "Save change"}
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              pdfAfterSaveRef.current = false;
              void runQuotationPdf();
            }}
          >
            Download PDF
          </Button>
          <Button type="button" variant="secondary" onClick={() => window.location.reload()}>
            Reset
          </Button>
        </div>
      </Card>

      {quotationReceiptData ? (
        <div className="pointer-events-none fixed left-0 top-0 -z-10 opacity-0" aria-hidden>
          <div ref={receiptRef} style={{ width: 800, padding: 20 }}>
            <InvoiceReceipt
              invoiceData={quotationReceiptData}
              hideButtons
              documentTitle="Quotation"
              referenceLabel="Quotation No:"
            />
          </div>
        </div>
      ) : null}

    </div>
  );
}
