"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { PageError, PageLoading } from "@/components/ui/page-states";
import { Select } from "@/components/ui/select";
import { useApiResource } from "@/lib/hooks/use-api-resource";
import { apiFetch } from "@/lib/api/browser-client";
import { toast } from "@/lib/toast";
import { CUSTOMER_INVOICE_POOL, CUSTOMER_PRIVATE_POOL } from "@/lib/navigation/customer-routes";
import { ProductSelectField } from "./product-select-field";
import {
  flattenSalesProducts,
  invoiceLinePkr,
  type ServiceTreeNode,
} from "./sales-product-catalog";
import { useInvoiceCreateGates } from "./use-invoice-create-gates";
import { InvoiceReceipt, WEBEXCELS_FROM, type InvoiceReceiptData } from "./invoice-receipt";
import { downloadElementAsPdf } from "@/lib/pdf/download-element-as-pdf";
import { pdfFileNameForCompany } from "@/lib/pdf/pdf-file-name";
import { plainTextForPdf } from "@/lib/pdf/plain-text";

type InvoiceItem = {
  id: string;
  productId: string;
  detail: string;
  unitPrice: number;
  quantity: number;
  totalPkr: number;
  discount: number;
};

type Customer = {
  id: string;
  companyName?: string;
  accountName?: string;
  email?: string;
  phone?: string;
  address?: string | null;
  city?: string | null;
  country?: string | null;
};

export function CreateInvoiceView({ customerId, quotationId }: { customerId: string; quotationId?: string }) {
  const { canCreateInvoice } = useInvoiceCreateGates();
  const [dollarRate, setDollarRate] = useState(280);
  const [items, setItems] = useState<InvoiceItem[]>([
    { id: crypto.randomUUID(), productId: "", detail: "", unitPrice: 0.5, quantity: 1, totalPkr: 0.5 * 280, discount: 0 },
  ]);
  const [gstPercent, setGstPercent] = useState(0);
  const [discountType, setDiscountType] = useState<"percentage" | "amount">("percentage");
  const [pkrDiscountValue, setPkrDiscountValue] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [savedInvoiceId, setSavedInvoiceId] = useState<string | null>(null);
  const [savedInvoiceNumber, setSavedInvoiceNumber] = useState<string>("");
  const [showReceipt, setShowReceipt] = useState(false);
  const [prefilled, setPrefilled] = useState(false);
  const receiptRef = useRef<HTMLDivElement>(null);
  const pdfAfterSaveRef = useRef(false);

  const isLockedFromQuotation = !!quotationId;

  const customerPath = customerId ? `/api/sales/customers/${customerId}` : null;
  const { data: customerRes, loading: customerLoading, error: customerError } = useApiResource<{ data?: Customer } | Customer>(
    customerPath,
  );
  const customer: Customer | null = useMemo(() => {
    if (!customerRes) return null;
    if ("data" in customerRes && customerRes.data) return customerRes.data;
    return customerRes as Customer;
  }, [customerRes]);

  const { data: invoiceInfo } = useApiResource<{ invoiceNumber?: string }>("/api/account/invoices/next-number");
  const { data: meData } = useApiResource<{ data?: { department?: string } }>("/api/auth/me");
  const currentDepartment = meData?.data?.department;

  const { data: servicesRes, loading: servicesLoading } = useApiResource<{ items?: ServiceTreeNode[] } | ServiceTreeNode[]>(
    "/api/sales/services",
  );
  const flatProducts = useMemo(() => {
    const raw = Array.isArray(servicesRes) ? servicesRes : servicesRes?.items ?? [];
    return flattenSalesProducts(raw, true);
  }, [servicesRes]);

  const quotePath = quotationId ? `/api/quotations/${quotationId}` : null;
  const { data: quoteData } = useApiResource<{ data?: { items: Array<Record<string, unknown>> } }>(quotePath);

  useEffect(() => {
    if (!quotationId || prefilled || !quoteData?.data?.items) return;
    const qItems = quoteData.data.items;
    if (!qItems.length) return;
    setItems(
      qItems.map((it) => {
        const unitPrice = Number(it.unitPrice) || 0;
        const quantity = Number(it.quantity) || 1;
        const productId = String(it.productId || "");
        return {
          id: crypto.randomUUID(),
          productId,
          detail: String(it.detail || ""),
          unitPrice,
          quantity,
          totalPkr: invoiceLinePkr(productId, unitPrice, quantity, dollarRate, flatProducts),
          discount: 0,
        };
      }),
    );
    setPrefilled(true);
  }, [quotationId, quoteData, prefilled, dollarRate, flatProducts]);

  const subAmount = useMemo(() => items.reduce((acc, item) => acc + (item.totalPkr - item.discount), 0), [items]);
  const totalAmount = useMemo(() => subAmount + (subAmount * gstPercent) / 100, [subAmount, gstPercent]);
  const finalDiscount = useMemo(
    () => (discountType === "percentage" ? (totalAmount * pkrDiscountValue) / 100 : pkrDiscountValue),
    [discountType, totalAmount, pkrDiscountValue],
  );
  const pkrAmount = useMemo(() => totalAmount - finalDiscount, [totalAmount, finalDiscount]);
  const grandTotal = useMemo(() => pkrAmount / dollarRate, [pkrAmount, dollarRate]);

  const customerAddress = useMemo(
    () => [customer?.address, customer?.city, customer?.country].filter(Boolean).join(", ") || "N/A",
    [customer],
  );

  const receiptData: InvoiceReceiptData | null = useMemo(() => {
    if (!customer) return null;
    const invNum =
      savedInvoiceNumber ||
      invoiceInfo?.invoiceNumber ||
      (savedInvoiceId ? `INV-${savedInvoiceId.slice(0, 6).toUpperCase()}` : "DRAFT");
    return {
      invoiceNumber: invNum,
      date: new Date(),
      from: WEBEXCELS_FROM,
      to: {
        name: customer.companyName || customer.accountName || "N/A",
        phone: customer.phone || "N/A",
        email: customer.email || "N/A",
        address: customerAddress,
      },
      items: items.map((item) => ({
        name: flatProducts.find((p) => p.id === item.productId)?.name || "Service",
        detail: plainTextForPdf(item.detail),
        price: item.unitPrice,
        quantity: item.quantity,
        total: Math.round(item.totalPkr - item.discount),
      })),
      subTotalUsd: subAmount / dollarRate,
      subTotalPkr: Math.round(subAmount),
      taxUsd: ((subAmount / dollarRate) * gstPercent) / 100,
      discountPkr: Math.round(totalAmount - pkrAmount),
      totalPkr: Math.round(pkrAmount),
    };
  }, [
    customer,
    savedInvoiceNumber,
    invoiceInfo?.invoiceNumber,
    savedInvoiceId,
    customerAddress,
    items,
    flatProducts,
    subAmount,
    dollarRate,
    gstPercent,
    totalAmount,
    pkrAmount,
  ]);

  const runPdfDownload = useCallback(async () => {
    const el = receiptRef.current;
    if (!el || !customer) {
      toast.error("Invoice slip is not ready yet — try again in a moment.");
      return;
    }
    try {
      await downloadElementAsPdf(
        el,
        pdfFileNameForCompany(customer.companyName || customer.accountName || "Company"),
      );
    } catch (e) {
      console.error("Invoice PDF error:", e);
      toast.error("Failed to generate PDF.");
    }
  }, [customer]);

  useEffect(() => {
    if (!showReceipt || !pdfAfterSaveRef.current) return;

    let cancelled = false;
    let attempts = 0;

    const tryDownload = () => {
      if (cancelled) return;
      attempts += 1;
      if (!receiptRef.current) {
        if (attempts < 30) {
          requestAnimationFrame(tryDownload);
          return;
        }
        pdfAfterSaveRef.current = false;
        return;
      }
      window.setTimeout(() => {
        void runPdfDownload().finally(() => {
          pdfAfterSaveRef.current = false;
        });
      }, 400);
    };

    tryDownload();
    return () => {
      cancelled = true;
    };
  }, [showReceipt, runPdfDownload, receiptData]);

  const updateItem = (id: string, patch: Partial<InvoiceItem>) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        const next = { ...item, ...patch };
        if (patch.unitPrice !== undefined || patch.quantity !== undefined || patch.productId !== undefined) {
          next.totalPkr = invoiceLinePkr(next.productId, next.unitPrice, next.quantity, dollarRate, flatProducts);
        }
        return next;
      }),
    );
  };

  const validateDepartments = () => {
    for (const item of items) {
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
    if (!customer) return;
    if (!validateDepartments()) return;
    setSubmitting(true);
    try {
      const payload = {
        customerId: customer.id,
        customerName: customer.companyName || customer.accountName || "N/A",
        customerEmail: customer.email,
        customerAddress,
        items: JSON.stringify(
          items.map((item) => ({
            ...item,
            name: flatProducts.find((p) => p.id === item.productId)?.name || "Service",
          })),
        ),
        subtotal: (subAmount / dollarRate).toString(),
        tax: (((subAmount / dollarRate) * gstPercent) / 100).toString(),
        total: grandTotal.toString(),
        dollarRate: dollarRate.toString(),
        status: "Pending",
        invoiceNumber: invoiceInfo?.invoiceNumber || `INV-${Math.floor(Math.random() * 100000)}`,
        ...(quotationId ? { quotationId } : {}),
      };

      if (savedInvoiceId) {
        const { invoiceNumber: _n, ...updatePayload } = payload;
        const res = await apiFetch<{ data?: { id?: string; invoiceNumber?: string; invoice_number?: string } }>(
          `/api/account/invoices/${savedInvoiceId}`,
          { method: "PATCH", json: updatePayload },
        );
        const num = res?.data?.invoiceNumber || res?.data?.invoice_number || payload.invoiceNumber;
        setSavedInvoiceNumber(num);
        toast.success("Invoice updated.");
        pdfAfterSaveRef.current = true;
        setShowReceipt(true);
      } else {
        const res = await apiFetch<{ data?: { id?: string; invoiceNumber?: string; invoice_number?: string } }>(
          "/api/account/invoices",
          { method: "POST", json: payload },
        );
        const id = res?.data?.id;
        const num = res?.data?.invoiceNumber || res?.data?.invoice_number || payload.invoiceNumber;
        if (id) setSavedInvoiceId(id);
        setSavedInvoiceNumber(num);
        toast.success("Invoice created.");
        pdfAfterSaveRef.current = true;
        setShowReceipt(true);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to save invoice.");
    } finally {
      setSubmitting(false);
    }
  };

  if (!canCreateInvoice) {
    return (
      <PageError
        message="Only Sales Executives (or Service Executives with manual-invoice permission) can create invoices."
        onRetry={() => window.history.back()}
      />
    );
  }

  if (!customerId) {
    return <PageError message="Invalid invoice link — no customer specified." />;
  }

  if (customerLoading || servicesLoading) {
    return <PageLoading label="Loading invoice form…" />;
  }

  if (customerError || !customer) {
    return <PageError message={customerError || "Customer not found."} />;
  }

  return (
    <div className="mx-auto max-w-6xl space-y-4 pb-8">
      <PageHeader eyebrow="Sales" title="Invoice" description={new Date().toLocaleString()} />

      <Card className="space-y-6 p-4 md:p-6">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
          <label className="text-sm">
            Account holder
            <Input readOnly className="mt-1 bg-zinc-50 dark:bg-zinc-900/80" value={customer.accountName || ""} />
          </label>
          <label className="text-sm">
            Company
            <Input readOnly className="mt-1 bg-zinc-50 dark:bg-zinc-900/80" value={customer.companyName || ""} />
          </label>
          <label className="text-sm">
            Email
            <Input readOnly className="mt-1 bg-zinc-50 dark:bg-zinc-900/80" value={customer.email || ""} />
          </label>
          <label className="text-sm">
            Contact
            <Input readOnly className="mt-1 bg-zinc-50 dark:bg-zinc-900/80" value={customer.phone || ""} />
          </label>
          <label className="text-sm">
            Dollar rate
            <Input
              type="number"
              className="mt-1"
              readOnly={isLockedFromQuotation}
              value={dollarRate}
              onChange={(e) => {
                const rate = Number(e.target.value);
                setDollarRate(rate);
                setItems((prev) =>
                  prev.map((it) => ({
                    ...it,
                    totalPkr: invoiceLinePkr(it.productId, it.unitPrice, it.quantity, rate, flatProducts),
                  })),
                );
              }}
            />
          </label>
        </div>

        <div className="space-y-3">
          <div className="hidden grid-cols-12 gap-2 text-xs font-bold uppercase text-zinc-500 md:grid">
            <div className="col-span-3">Product</div>
            <div className="col-span-3">Detail</div>
            <div className="col-span-1 text-center">Unit $</div>
            <div className="col-span-1 text-center">Qty</div>
            <div className="col-span-1 text-center">Total PKR</div>
            <div className="col-span-1 text-center">Discount</div>
            <div className="col-span-2 text-center">Action</div>
          </div>
          {items.map((item) => (
            <div key={item.id} className="grid grid-cols-1 gap-2 rounded-lg border border-zinc-200 p-3 md:grid-cols-12 md:border-0 md:p-0 dark:border-zinc-800">
              <div className="md:col-span-3">
                {isLockedFromQuotation ? (
                  <Input readOnly value={flatProducts.find((p) => p.id === item.productId)?.name || "Service"} />
                ) : (
                  <ProductSelectField
                    value={item.productId}
                    flatProducts={flatProducts}
                    checkRoleGate
                    onSelect={(p) =>
                      updateItem(item.id, {
                        productId: p.id,
                        detail: p.description ?? p.name ?? "",
                        unitPrice: 1,
                        quantity: Number(p.price || 0) > 0 ? Number(p.price) : 1,
                      })
                    }
                  />
                )}
              </div>
              <div className="md:col-span-3">
                <Input readOnly={isLockedFromQuotation} value={item.detail} onChange={(e) => updateItem(item.id, { detail: e.target.value })} />
              </div>
              <div className="md:col-span-1">
                <Input
                  type="number"
                  readOnly={isLockedFromQuotation}
                  className="text-center"
                  value={item.unitPrice}
                  onChange={(e) => updateItem(item.id, { unitPrice: Number(e.target.value) || 0 })}
                />
              </div>
              <div className="md:col-span-1">
                <Input
                  type="number"
                  readOnly={isLockedFromQuotation}
                  className="text-center"
                  value={item.quantity}
                  onChange={(e) => updateItem(item.id, { quantity: Number(e.target.value) || 0 })}
                />
              </div>
              <div className="md:col-span-1">
                <Input readOnly className="text-center" value={Math.round(item.totalPkr)} />
              </div>
              <div className="md:col-span-1">
                <Input
                  type="number"
                  readOnly={isLockedFromQuotation}
                  className="text-center"
                  value={item.discount}
                  onChange={(e) => updateItem(item.id, { discount: Number(e.target.value) || 0 })}
                />
              </div>
              <div className="md:col-span-2">
                {!isLockedFromQuotation ? (
                  <Button type="button" variant="danger" size="sm" onClick={() => setItems((prev) => prev.filter((i) => i.id !== item.id))}>
                    Delete
                  </Button>
                ) : null}
              </div>
            </div>
          ))}
          {!isLockedFromQuotation ? (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() =>
                setItems((prev) => [
                  ...prev,
                  { id: crypto.randomUUID(), productId: "", detail: "", unitPrice: 0, quantity: 1, totalPkr: 0, discount: 0 },
                ])
              }
            >
              + Add product
            </Button>
          ) : null}
        </div>

        <div className="grid grid-cols-1 gap-4 border-t border-zinc-200 pt-6 md:grid-cols-3 dark:border-zinc-800">
          <label className="text-sm">
            Sub amount (PKR)
            <Input readOnly className="mt-1" value={subAmount.toFixed(2)} />
          </label>
          <label className="text-sm">
            GST %
            <Input type="number" className="mt-1" value={gstPercent} onChange={(e) => setGstPercent(Number(e.target.value) || 0)} />
          </label>
          <label className="text-sm">
            Total amount (PKR)
            <Input readOnly className="mt-1" value={totalAmount.toFixed(2)} />
          </label>
          <label className="text-sm">
            Discount type
            <Select className="mt-1 w-full" value={discountType} onChange={(e) => setDiscountType(e.target.value as "percentage" | "amount")}>
              <option value="percentage">Percentage</option>
              <option value="amount">Amount</option>
            </Select>
          </label>
          <label className="text-sm">
            Discount value
            <Input type="number" className="mt-1" value={pkrDiscountValue} onChange={(e) => setPkrDiscountValue(Number(e.target.value) || 0)} />
          </label>
          <label className="text-sm">
            PKR amount
            <Input readOnly className="mt-1" value={pkrAmount.toFixed(2)} />
          </label>
          <label className="text-sm">
            $ Grand total
            <Input readOnly className="mt-1 font-semibold" value={grandTotal.toFixed(2)} />
          </label>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button type="button" disabled={submitting} onClick={() => void save()}>
            {submitting ? "Saving…" : "Save change"}
          </Button>
          <Button type="button" variant="secondary" onClick={() => void runPdfDownload()}>
            Download PDF
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              pdfAfterSaveRef.current = false;
              setShowReceipt(true);
            }}
          >
            Print slip
          </Button>
          <Link href={CUSTOMER_INVOICE_POOL} className="text-sm font-semibold text-emerald-600 hover:underline">
            Invoice pool
          </Link>
          <Link href={CUSTOMER_PRIVATE_POOL} className="text-sm font-semibold text-zinc-500 hover:underline">
            Private pool
          </Link>
        </div>
      </Card>

      {receiptData ? (
        <div className="pointer-events-none fixed left-0 top-0 -z-10 opacity-0" aria-hidden>
          <div ref={receiptRef} style={{ width: 800, padding: 20 }}>
            <InvoiceReceipt invoiceData={receiptData} hideButtons />
          </div>
        </div>
      ) : null}

      {showReceipt && receiptData ? (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4 print:hidden">
          <div className="relative max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-lg bg-white shadow-2xl">
            <InvoiceReceipt
              invoiceData={receiptData}
              onClose={() => {
                setShowReceipt(false);
              }}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
