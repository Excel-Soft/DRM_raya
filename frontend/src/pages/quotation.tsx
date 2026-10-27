import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useQuery } from "@tanstack/react-query";
import { Loader2, Plus, Trash, ChevronsUpDown, Check } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { cn } from "@/lib/utils";
import Swal from "sweetalert2";
import {
  QUOTATION_TYPE_OPTIONS,
  computeLineItemUsd,
  isDomainHostingProductName,
  isPackageProductName,
  isQuotableWithoutFollowUp,
} from "@/lib/quotation-product-rules";

type QuotationItemForm = {
  id?: string;
  productId: string;
  detail: string;
  minTime?: number;
  maxTime?: number;
  abDiscount?: number;
  unitPrice: number;
  quantity: number;
  startYear: number;
  endYear: number;
  domainUrl?: string;
  itemTotal?: number;
};

type QuotationFormState = {
  id?: string;
  leadId?: string;
  accountHolder: string;
  company: string;
  email: string;
  contact: string;
  deliveryTimeMin?: string;
  deliveryTimeMax?: string;
  gstPercent: number;
  discountType: "PERCENT" | "AMOUNT";
  discountValue: number;
  paymentTermPercent: number;
  note?: string;
  saveStatus?: string;
  amount?: number;
  dollarRate: number;
  quotationType?: string;
  items: QuotationItemForm[];
  subAmount?: number;
  gstAmount?: number;
  totalAmount?: number;
  grandTotal?: number;
  pkrTotal?: number;
  createdAt?: string;
};

function parseQuery(search: string): Record<string, string> {
  const params = new URLSearchParams(search.startsWith("?") ? search : `?${search}`);
  const out: Record<string, string> = {};
  params.forEach((v, k) => {
    out[k] = v;
  });
  return out;
}

function ProductCombobox({
  item,
  flatProducts,
  updateItemProduct,
  onBeforeSelectProduct,
}: {
  item: QuotationItemForm;
  flatProducts: any[];
  updateItemProduct: (productId: string, selectedProduct: any) => void;
  onBeforeSelectProduct: (productId: string, productName: string) => Promise<boolean>;
}) {
    const [open, setOpen] = useState(false);

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    className="w-full justify-between bg-white dark:bg-zinc-900 border-slate-200 h-10 font-normal focus:ring-emerald-500 overflow-hidden text-ellipsis whitespace-nowrap px-3 text-sm"
                >
                    <span className="truncate">{item.productId ? flatProducts.find((p: any) => p.id === item.productId)?.name || "Select" : "Select"}</span>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[300px] p-0" align="start">
                <Command>
                    <CommandInput placeholder="Search product..." />
                    <CommandList>
                        <CommandEmpty>No product found.</CommandEmpty>
                        <CommandGroup>
                            {flatProducts.map((product: any) => (
                                <CommandItem
                                    key={product.id}
                                    value={product.name}
                                    onSelect={async () => {
                                        const allowed = await onBeforeSelectProduct(product.id, product.name || "Service");
                                        if (!allowed) {
                                            setOpen(false);
                                            return;
                                        }
                                        updateItemProduct(product.id, product);
                                        setOpen(false);
                                    }}
                                    className={cn("text-slate-700", item.productId === product.id ? "bg-emerald-600 text-white" : "")}
                                >
                                    {product.name}
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    );
}

export default function QuotationPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState<QuotationFormState>({
    accountHolder: "",
    company: "",
    email: "",
    contact: "",
    gstPercent: 0,
    discountType: "AMOUNT",
    discountValue: 0,
    paymentTermPercent: 0,
    deliveryTimeMin: "",
    deliveryTimeMax: "",
    saveStatus: "Saved",
    note: "",
    amount: 0,
    dollarRate: 280,
    quotationType: "",
    pkrTotal: 0,
    createdAt: new Date().toISOString(),
    items: [
      {
        productId: "",
        detail: "",
        abDiscount: 0,
        unitPrice: 0,
        quantity: 1,
        startYear: new Date().getFullYear(),
        endYear: new Date().getFullYear(),
      },
    ],
  });

  const search = typeof window !== "undefined" ? window.location.search : "";
  const query = useMemo(() => parseQuery(search), [search]);
  const leadId = query.leadId;
  const quotationId = query.id;
  const viewOnly = query.view === "1" || query.mode === "view";

  const customerIdForQuotation = leadId || form.leadId || "";

  const { data: openQuotationProducts, isLoading: openProductsLoading } = useQuery<{
    success: boolean;
    data: Record<string, { quotationId: string; hodStatus: string | null; company: string }>;
  }>({
    queryKey: ["/api/sales/quotations/open-product-ids", customerIdForQuotation, form.id],
    queryFn: async () => {
      const params = new URLSearchParams({ customerId: customerIdForQuotation });
      if (form.id) params.set("excludeQuotationId", form.id);
      const res = await apiRequest("GET", `/api/sales/quotations/open-product-ids?${params.toString()}`);
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json?.message || "Failed to load quotation checks");
      }
      return res.json();
    },
    enabled: !!customerIdForQuotation,
    staleTime: 60_000,
  });

  const { data: eligibleProductsRes, isLoading: eligibleLoading } = useQuery<{
    success: boolean;
    data: Array<{ subserviceId: string; subserviceName: string }>;
  }>({
    queryKey: ["/api/sales/quotations/eligible-products", customerIdForQuotation],
    queryFn: async () => {
      const params = new URLSearchParams({ customerId: customerIdForQuotation });
      const res = await apiRequest("GET", `/api/sales/quotations/eligible-products?${params.toString()}`);
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json?.message || "Failed to load eligible services");
      }
      return res.json();
    },
    enabled: !!customerIdForQuotation && !viewOnly,
    staleTime: 60_000,
  });

  const eligibleProductIds = useMemo(() => {
    const set = new Set<string>();
    for (const row of eligibleProductsRes?.data ?? []) {
      if (row.subserviceId) set.add(row.subserviceId);
    }
    return set;
  }, [eligibleProductsRes]);

  const checkFollowUpEligibility = useCallback(
    async (productId: string, productName: string): Promise<boolean> => {
      if (!customerIdForQuotation || !productId) return true;
      if (viewOnly) return true;
      if (isQuotableWithoutFollowUp(productName)) return true;
      if (eligibleLoading) {
        Swal.fire({
          icon: "info",
          title: "Please wait",
          text: "Loading follow-up eligibility for this customer…",
        });
        return false;
      }
      if (!eligibleProductIds.has(productId)) {
        Swal.fire({
          icon: "error",
          title: "Action denied",
          text: `You cannot quote "${productName}" until you add a follow-up for this service on this customer (within 60 days).`,
        });
        return false;
      }
      return true;
    },
    [customerIdForQuotation, viewOnly, eligibleLoading, eligibleProductIds],
  );

  const checkExistingUserQuotation = useCallback(
    async (productId: string, productName: string): Promise<boolean> => {
      if (!customerIdForQuotation || !productId) return true;
      const existing = openQuotationProducts?.data?.[productId];
      if (existing) {
        const status = existing.hodStatus ? ` (HOD: ${existing.hodStatus})` : "";
        Swal.fire({
          icon: "warning",
          title: "Quotation already exists",
          text: `You already have an open quotation for "${productName}" on this customer${status}. Use that quotation or finish it before creating another.`,
        });
        return false;
      }
      if (openProductsLoading) return true;
      return true;
    },
    [customerIdForQuotation, openQuotationProducts, openProductsLoading],
  );

  const beforeSelectProduct = useCallback(
    async (productId: string, productName: string) => {
      const okFollowUp = await checkFollowUpEligibility(productId, productName);
      if (!okFollowUp) return false;
      return checkExistingUserQuotation(productId, productName);
    },
    [checkFollowUpEligibility, checkExistingUserQuotation],
  );

  const { data: servicesData } = useQuery<any>({
    queryKey: ["/api/sales/services"],
    staleTime: 5 * 60_000,
  });
  const products = useMemo(() => {
    return Array.isArray(servicesData) ? servicesData : (servicesData?.items || servicesData?.data || []);
  }, [servicesData]);

  const flatProducts = useMemo(() => {
    const list: any[] = [];
    for (const p of products) {
        if (p.subServices && p.subServices.length > 0) {
            for (const sub of p.subServices) {
                list.push({ 
                    ...sub, 
                    parentName: p.name, 
                    price: sub.price ?? p.price, 
                    description: sub.description !== null && sub.description !== undefined ? sub.description : (p.description !== null && p.description !== undefined ? p.description : sub.name),
                    routeDepartments: sub.routeDepartments && sub.routeDepartments.length > 0 ? sub.routeDepartments : (p.routeDepartments || []),
                    projectDepartment: sub.projectDepartment || p.projectDepartment
                });
            }
        } else {
            list.push({
                ...p,
                parentName: p.name,
                routeDepartments: p.routeDepartments || [],
                projectDepartment: p.projectDepartment || null
            });
        }
    }
    return list;
  }, [products]);

  const productsForPicker = useMemo(() => {
    if (viewOnly) return flatProducts;
    if (!customerIdForQuotation || eligibleLoading) return flatProducts;
    const keepExisting = new Set(form.items.map((i) => i.productId).filter(Boolean));
    return flatProducts.filter(
      (p) =>
        keepExisting.has(p.id) ||
        isQuotableWithoutFollowUp(p.name || "") ||
        eligibleProductIds.has(p.id),
    );
  }, [flatProducts, viewOnly, customerIdForQuotation, eligibleLoading, form.items, eligibleProductIds]);

  const getProductById = useCallback(
    (productId: string) => flatProducts.find((p: any) => p.id === productId),
    [flatProducts],
  );

  const isDomainHostingRow = (productId: string) => {
    const product = getProductById(productId);
    if (!product) return false;
    return isDomainHostingProductName(product.name || "", product.parentName || "");
  };

  const isPackageRow = (productId: string) => {
    const product = getProductById(productId);
    if (!product) return false;
    return isPackageProductName(product.name || "");
  };

  const hasAnyDomainHosting = form.items.some((item) => isDomainHostingRow(item.productId));
  const hasAnyPackage = form.items.some((item) => isPackageRow(item.productId));

  const buildDetailFromRow = (row: QuotationItemForm) => {
    const product = getProductById(row.productId);
    if (!isDomainHostingRow(row.productId)) return row.detail;
    const serviceName = product?.name?.trim() || "";
    let detailText = serviceName;
    if (row.domainUrl) {
      detailText += (detailText ? " - " : "") + row.domainUrl;
    }
    if (row.startYear || row.endYear) {
      detailText += ` (${row.startYear || ""} to ${row.endYear || ""})`;
    }
    return detailText;
  };

  useEffect(() => {
    async function loadLeadProfile(id: string) {
      if (quotationId) return; // Wait to load quotation instead
      try {
        setLoading(true);
        const res = await fetch(`/api/sales/leads/${id}/profile`);
        if (!res.ok) return;
        const data = await res.json();
        const lead = data?.lead;
        setForm((prev) => ({
          ...prev,
          leadId: id,
          accountHolder: lead?.accountName || lead?.accHolder || prev.accountHolder,
          company: lead?.companyName || lead?.company || prev.company,
          email: lead?.email || prev.email,
          contact: lead?.phone || lead?.mobile || prev.contact,
        }));
      } finally {
        setLoading(false);
      }
    }
    if (leadId) loadLeadProfile(leadId);
  }, [leadId, quotationId]);

  useEffect(() => {
    async function loadQuotation(id: string) {
      try {
        setLoading(true);
        const res = await fetch(`/api/quotations/${id}`);
        if (!res.ok) throw new Error("Failed to load quotation");
        const data = await res.json();
        const q = data?.data?.quotation;
        const items = data?.data?.items ?? [];
        
        let deliveryMin = "";
        let deliveryMax = "";
        if (q.deliveryTime) {
          const parts = String(q.deliveryTime).split("-");
          if (parts.length >= 2) {
            deliveryMin = parts[0].trim();
            deliveryMax = parts[1].trim();
          } else {
            deliveryMin = String(q.deliveryTime).trim();
          }
        }

        setForm({
          id: q.id,
          leadId: q.customerId || leadId,
          accountHolder: q.accountHolder ?? "",
          company: q.company ?? "",
          email: q.email ?? "",
          contact: q.contact ?? "",
          deliveryTimeMin: deliveryMin,
          deliveryTimeMax: deliveryMax,
          gstPercent: q.gstPercent ?? 0,
          discountType: q.discountType ?? "AMOUNT",
          discountValue: q.discountValue ?? 0,
          paymentTermPercent: q.paymentTermPercent ?? 0,
          note: q.note ?? "",
          saveStatus: q.saveStatus ?? "Saved",
          amount: q.amount ?? 0,
          dollarRate: q.dollarRate ?? 280,
          quotationType: q.quotationType ?? "",
          createdAt: q.createdAt || new Date().toISOString(),
          items: items.map((it: any) => ({
            id: it.id,
            productId: it.productId,
            detail: it.detail ?? "",
            minTime: it.minTime ?? undefined,
            maxTime: it.maxTime ?? undefined,
            abDiscount: it.abDiscount ?? 0,
            unitPrice: it.unitPrice ?? 0,
            quantity: it.quantity ?? 1,
            startYear: it.startYear ?? new Date().getFullYear(),
            endYear: it.endYear ?? new Date().getFullYear(),
            domainUrl: it.domainUrl ?? "",
            itemTotal: it.itemTotal,
          })),
          subAmount: q.subAmount,
          gstAmount: q.gstAmount,
          totalAmount: q.totalAmount,
          grandTotal: q.grandTotal,
        });
      } catch (err: any) {
        toast({ title: "Failed to load quotation", description: err?.message || "Unknown error" });
      } finally {
        setLoading(false);
      }
    }
    if (quotationId) loadQuotation(quotationId);
  }, [quotationId, leadId, toast]);

  const computed = useMemo(() => {
    const subAmount = form.items.reduce((sum, it) => {
      const name = getProductById(it.productId)?.name || "";
      return sum + computeLineItemUsd(name, it.unitPrice, it.quantity, it.abDiscount ?? 0);
    }, 0);
    const gstAmount = subAmount * (Number(form.gstPercent || 0) / 100);
    const totalAmount = subAmount + gstAmount;

    const paymentTermPercent = Number(form.paymentTermPercent || 0);
    const amount = totalAmount * (paymentTermPercent / 100);

    let grandTotal = amount;
    const discountVal = Number(form.discountValue || 0);
    if (form.discountType === "PERCENT") {
      grandTotal = amount - (amount * discountVal) / 100;
    }

    let pkrTotal = grandTotal * Number(form.dollarRate || 280);
    if (form.discountType === "AMOUNT") {
      pkrTotal = Math.max(pkrTotal - discountVal, 0);
    }

    return { subAmount, gstAmount, totalAmount, grandTotal, pkrTotal, calculatedAmount: amount };
  }, [form, getProductById]);

  useEffect(() => {
    // If payment term changes, update form.amount if we want it strictly linked
    setForm(prev => ({ ...prev, amount: computed.calculatedAmount }));
  }, [computed.calculatedAmount]);

  const updateItem = (idx: number, patch: Partial<QuotationItemForm>) => {
    setForm((prev) => {
      const next = [...prev.items];
      next[idx] = { ...next[idx], ...patch };
      return { ...prev, items: next };
    });
  };

  const addItem = () => {
    setForm((prev) => ({
      ...prev,
      items: [
        ...prev.items,
        {
          productId: "",
          detail: "",
          abDiscount: 0,
          unitPrice: 0,
          quantity: 1,
          startYear: new Date().getFullYear(),
          endYear: new Date().getFullYear(),
        },
      ],
    }));
  };

  const removeItem = (idx: number) => {
    setForm((prev) => ({ ...prev, items: prev.items.filter((_, i) => i !== idx) }));
  };

  const handleSave = async () => {
    try {
      const validItems = form.items.filter((it) => it.productId);
      if (validItems.length === 0) {
        toast({ title: "Add a product", description: "Please add at least one product line.", variant: "destructive" });
        return;
      }
      if (hasAnyPackage && !form.quotationType) {
        toast({ title: "Type required", description: "Select quotation Type when a package is on the quote.", variant: "destructive" });
        return;
      }
      for (const item of validItems) {
        if (!item.detail?.trim()) {
          toast({ title: "Detail required", description: "Each line needs a detail description.", variant: "destructive" });
          return;
        }
        if (isDomainHostingRow(item.productId) && !item.domainUrl?.trim()) {
          const name = getProductById(item.productId)?.name || "Domain/Hosting";
          toast({ title: "Domain URL required", description: `Enter domain URL for ${name}.`, variant: "destructive" });
          return;
        }
        if (isPackageRow(item.productId) && Number(item.abDiscount ?? 0) > Number(item.unitPrice ?? 0)) {
          toast({ title: "Invalid AB Discount", description: "AB discount cannot exceed unit price.", variant: "destructive" });
          return;
        }
      }

      const seenProducts = new Set<string>();
      for (const item of form.items) {
        if (!item.productId) continue;
        if (seenProducts.has(item.productId)) {
          const product = flatProducts.find((p) => p.id === item.productId);
          toast({
            title: "Duplicate service",
            description: product ? `"${product.name}" is listed more than once.` : "Remove duplicate lines.",
            variant: "destructive",
          });
          return;
        }
        seenProducts.add(item.productId);
        const product = flatProducts.find((p) => p.id === item.productId);
        const ok = await checkExistingUserQuotation(item.productId, product?.name || "Service");
        if (!ok) return;
      }

      setSaving(true);
      let deliveryTimeStr = "";
      if (form.deliveryTimeMin || form.deliveryTimeMax) {
        deliveryTimeStr = `${form.deliveryTimeMin || ""} - ${form.deliveryTimeMax || ""}`.trim();
        if (deliveryTimeStr === "-") deliveryTimeStr = "";
      }

      const body: any = {
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
        quotationType: hasAnyPackage ? form.quotationType || null : null,
        subAmount: computed.subAmount,
        totalAmount: computed.totalAmount,
        grandTotal: computed.grandTotal,
        items: form.items
          .filter((it) => it.productId)
          .map((it) => ({
            productId: it.productId,
            detail: it.detail,
            minTime: it.minTime,
            maxTime: it.maxTime,
            abDiscount: isPackageRow(it.productId) ? Number(it.abDiscount ?? 0) : 0,
            unitPrice: it.unitPrice,
            quantity: it.quantity,
            startYear: it.startYear,
            endYear: it.endYear,
            domainUrl: it.domainUrl,
          })),
      };
      const res = await apiRequest(form.id ? "PUT" : "POST", form.id ? `/api/quotations/${form.id}` : "/api/quotations", body);
      const json = await res.json();
      toast({ title: "Quotation saved successfully" });
      const returned = json?.data ?? json;
      if (returned?.quotation?.id) {
        setForm((prev) => ({ ...prev, id: returned.quotation.id }));
      }
      // Match by prefix rather than an exact key: the History tab's Quotation
      // History query caches under a single combined "/api/quotations?leadId=..."
      // key (built inline in service-private-pool.tsx), not the ["/api/quotations", id]
      // shape used here — an exact-key invalidation silently missed it, so a
      // freshly saved quotation never showed up until a hard refresh.
      queryClient.invalidateQueries({
        predicate: (query) => {
          const key = query.queryKey[0];
          return (
            typeof key === "string" &&
            (key.startsWith("/api/quotations") || key === "/api/sales/quotations/open-product-ids")
          );
        },
      });
      setLocation("/sales/lead-pools");
    } catch (err: any) {
      const message = err?.data?.message || err?.message || "Failed to save quotation";
      toast({ title: "Save failed", description: message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    if (window.confirm("Are you sure you want to reset the form?")) {
        window.location.reload();
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-emerald-600">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  const pad = (n: number) => n.toString().padStart(2, '0');
  const d = new Date(form.createdAt || new Date());
  let h = d.getHours();
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  const dateStr = `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()} ${pad(h)}:${pad(d.getMinutes())} ${ampm}`;

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8">
      <div className="max-w-7xl mx-auto bg-white dark:bg-zinc-900 rounded-lg shadow-sm border border-slate-200 p-6">
        
        {/* Header */}
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-xl font-bold text-slate-800 dark:text-zinc-100">
            {viewOnly ? "View Quotation" : "Invoice Quotation"}{" "}
            <span className="text-emerald-500 font-semibold">{dateStr}</span>
          </h1>
          {viewOnly ? (
            <Button type="button" variant="outline" onClick={() => window.history.back()}>
              Back
            </Button>
          ) : null}
        </div>

        {/* Top Info Section */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-600">Account Holder</label>
            <Input readOnly={viewOnly} className={viewOnly ? "bg-slate-50" : "bg-white dark:bg-zinc-900 border-slate-200"} value={form.accountHolder} onChange={(e) => setForm({ ...form, accountHolder: e.target.value })} />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-600">Company</label>
            <Input readOnly={viewOnly} className={viewOnly ? "bg-slate-50" : "bg-white dark:bg-zinc-900 border-slate-200"} value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-600">Email</label>
            <Input readOnly={viewOnly} className={viewOnly ? "bg-slate-50" : "bg-white dark:bg-zinc-900 border-slate-200"} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-600">Contact</label>
            <Input readOnly={viewOnly} className={viewOnly ? "bg-slate-50" : "bg-white dark:bg-zinc-900 border-slate-200"} value={form.contact} onChange={(e) => setForm({ ...form, contact: e.target.value })} />
          </div>
        </div>

        {/* Line Items Table */}
        <div className="overflow-x-auto mb-4 border border-slate-100 rounded-md">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-100 text-slate-700 font-semibold text-xs whitespace-nowrap">
              <tr>
                <th className="px-3 py-3">Product <span className="text-red-500">*</span></th>
                <th className="px-3 py-3">Detail <span className="text-red-500">*</span></th>
                <th className="px-3 py-3">Unit Price $ <span className="text-red-500">*</span></th>
                {hasAnyPackage ? (
                  <th className="px-3 py-3">AB Discount <span className="text-red-500">*</span></th>
                ) : null}
                <th className="px-3 py-3">Quantity <span className="text-red-500">*</span></th>
                {hasAnyDomainHosting ? <th className="px-3 py-3">Min Time</th> : null}
                {hasAnyDomainHosting ? <th className="px-3 py-3">Max Time</th> : null}
                <th className="px-3 py-3">Total $</th>
                {hasAnyDomainHosting ? <th className="px-3 py-3">Start Year</th> : null}
                {hasAnyDomainHosting ? <th className="px-3 py-3">End Year</th> : null}
                {hasAnyDomainHosting ? (
                  <th className="px-3 py-3">Domain URL <span className="text-red-500">*</span></th>
                ) : null}
                {!viewOnly ? <th className="px-3 py-3">Action</th> : null}
              </tr>
            </thead>
            <tbody>
              {form.items.map((item, idx) => (
                <tr key={idx} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                  <td className="px-2 py-2 min-w-[200px]">
                    {viewOnly ? (
                      <Input
                        readOnly
                        className="h-10 bg-slate-50"
                        value={flatProducts.find((p: any) => p.id === item.productId)?.name || item.detail || "—"}
                      />
                    ) : (
                      <ProductCombobox 
                        item={item} 
                        flatProducts={productsForPicker} 
                        onBeforeSelectProduct={beforeSelectProduct}
                        updateItemProduct={(productId, selectedProduct) => {
                          const isDom = selectedProduct
                            ? isDomainHostingProductName(selectedProduct.name || "", selectedProduct.parentName || "")
                            : false;
                          const detail =
                            selectedProduct &&
                            selectedProduct.description !== null &&
                            selectedProduct.description !== undefined
                              ? selectedProduct.description
                              : "";
                          updateItem(idx, {
                            productId,
                            detail,
                            quantity: 1,
                            abDiscount: 0,
                            unitPrice: selectedProduct ? Number(selectedProduct.price || 0) : 0,
                            minTime: isDom
                              ? selectedProduct?.minDay ?? selectedProduct?.minTime
                              : undefined,
                            maxTime: isDom
                              ? selectedProduct?.maxDay ?? selectedProduct?.maxTime
                              : undefined,
                            domainUrl: isDom ? item.domainUrl : "",
                            startYear: new Date().getFullYear(),
                            endYear: new Date().getFullYear(),
                          });
                        }}
                      />
                    )}
                  </td>
                  <td className="px-2 py-2 min-w-[200px]">
                    <Textarea 
                      readOnly={viewOnly}
                      className={`min-h-[40px] h-10 resize-none ${viewOnly ? "bg-slate-50" : ""}`}
                      value={item.detail} 
                      onChange={(e) => updateItem(idx, { detail: e.target.value })} 
                    />
                  </td>
                  <td className="px-2 py-2 min-w-[120px]">
                    <Input 
                      type="number" 
                      readOnly={viewOnly}
                      className={`h-10 ${viewOnly ? "bg-slate-50" : ""}`}
                      value={item.unitPrice} 
                      onChange={(e) => updateItem(idx, { unitPrice: Number(e.target.value) })} 
                    />
                  </td>
                  {hasAnyPackage ? (
                    <td className="px-2 py-2 min-w-[100px]">
                      {isPackageRow(item.productId) ? (
                        <Input
                          type="number"
                          min={0}
                          step="0.01"
                          readOnly={viewOnly}
                          className={`h-10 ${viewOnly ? "bg-slate-50" : ""}`}
                          value={item.abDiscount ?? 0}
                          onChange={(e) =>
                            updateItem(idx, { abDiscount: Number(e.target.value) || 0 })
                          }
                        />
                      ) : null}
                    </td>
                  ) : null}
                  <td className="px-2 py-2 min-w-[100px]">
                    <Input 
                      type="number" 
                      readOnly={viewOnly}
                      className={`h-10 ${viewOnly ? "bg-slate-50" : ""}`}
                      value={item.quantity} 
                      onChange={(e) => updateItem(idx, { quantity: Number(e.target.value) })} 
                    />
                  </td>
                  {hasAnyDomainHosting ? (
                    <td className="px-2 py-2 min-w-[100px]">
                      {isDomainHostingRow(item.productId) ? (
                        <Input 
                          type="number" 
                          readOnly={viewOnly}
                          className={`h-10 ${viewOnly ? "bg-slate-50" : ""}`}
                          value={item.minTime ?? ""} 
                          onChange={(e) => updateItem(idx, { minTime: e.target.value ? Number(e.target.value) : undefined })} 
                        />
                      ) : null}
                    </td>
                  ) : null}
                  {hasAnyDomainHosting ? (
                    <td className="px-2 py-2 min-w-[100px]">
                      {isDomainHostingRow(item.productId) ? (
                        <Input 
                          type="number" 
                          readOnly={viewOnly}
                          className={`h-10 ${viewOnly ? "bg-slate-50" : ""}`}
                          value={item.maxTime ?? ""} 
                          onChange={(e) => updateItem(idx, { maxTime: e.target.value ? Number(e.target.value) : undefined })} 
                        />
                      ) : null}
                    </td>
                  ) : null}
                  <td className="px-2 py-2 min-w-[120px]">
                    <Input 
                      readOnly 
                      className="h-10 bg-slate-50" 
                      value={computeLineItemUsd(
                        getProductById(item.productId)?.name || "",
                        item.unitPrice,
                        item.quantity,
                        item.abDiscount ?? 0,
                      ).toFixed(2)} 
                    />
                  </td>
                  {hasAnyDomainHosting ? (
                    <td className="px-2 py-2 min-w-[120px]">
                      {isDomainHostingRow(item.productId) ? (
                        <Input 
                          type="number" 
                          readOnly={viewOnly}
                          className={`h-10 ${viewOnly ? "bg-slate-50" : ""}`}
                          placeholder="Select Year"
                          value={item.startYear} 
                          onChange={(e) => {
                            const startYear = Number(e.target.value);
                            const merged = { ...item, startYear };
                            updateItem(idx, {
                              startYear,
                              detail: buildDetailFromRow(merged),
                            });
                          }} 
                        />
                      ) : null}
                    </td>
                  ) : null}
                  {hasAnyDomainHosting ? (
                    <td className="px-2 py-2 min-w-[120px]">
                      {isDomainHostingRow(item.productId) ? (
                        <Input 
                          type="number" 
                          readOnly={viewOnly}
                          className={`h-10 ${viewOnly ? "bg-slate-50" : ""}`}
                          placeholder="Select Year"
                          value={item.endYear} 
                          onChange={(e) => {
                            const endYear = Number(e.target.value);
                            const merged = { ...item, endYear };
                            updateItem(idx, {
                              endYear,
                              detail: buildDetailFromRow(merged),
                            });
                          }} 
                        />
                      ) : null}
                    </td>
                  ) : null}
                  {hasAnyDomainHosting ? (
                    <td className="px-2 py-2 min-w-[180px]">
                      {isDomainHostingRow(item.productId) ? (
                        <Input 
                          placeholder="Enter domain"
                          readOnly={viewOnly}
                          className={`h-10 ${viewOnly ? "bg-slate-50" : ""}`}
                          value={item.domainUrl ?? ""} 
                          onChange={(e) => {
                            const domainUrl = e.target.value;
                            const merged = { ...item, domainUrl };
                            updateItem(idx, {
                              domainUrl,
                              detail: buildDetailFromRow(merged),
                            });
                          }} 
                        />
                      ) : null}
                    </td>
                  ) : null}
                  {!viewOnly ? (
                    <td className="px-2 py-2 text-center">
                      <Button 
                        size="sm" 
                        className="bg-red-500 hover:bg-red-600 text-white w-full h-10" 
                        onClick={() => removeItem(idx)}
                      >
                        Delete
                      </Button>
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {!viewOnly ? (
          <div className="mb-8">
            <Button onClick={addItem} className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-md px-6">
              Add Row
            </Button>
          </div>
        ) : null}

        {/* Bottom Totals & Settings */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-600">Dollar Rate <span className="text-red-500">*</span></label>
            <Input readOnly={viewOnly} className={viewOnly ? "bg-slate-50" : ""} type="number" value={form.dollarRate} onChange={e => setForm({...form, dollarRate: Number(e.target.value)})} />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-600">Sub Amount <span className="text-red-500">*</span></label>
            <Input readOnly className="bg-slate-50" value={computed.subAmount.toFixed(2)} />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-600">Delivery Time <span className="text-red-500">*</span></label>
            <div className="flex items-center gap-2">
              <Input readOnly={viewOnly} className={`flex-1 ${viewOnly ? "bg-slate-50" : ""}`} value={form.deliveryTimeMin} onChange={e => setForm({...form, deliveryTimeMin: e.target.value})} />
              <span className="text-slate-400">---</span>
              <Input readOnly={viewOnly} className={`flex-1 ${viewOnly ? "bg-slate-50" : ""}`} value={form.deliveryTimeMax} onChange={e => setForm({...form, deliveryTimeMax: e.target.value})} />
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-600">GST % <span className="text-red-500">*</span></label>
            <Input readOnly={viewOnly} className={viewOnly ? "bg-slate-50" : ""} type="number" value={form.gstPercent} onChange={e => setForm({...form, gstPercent: Number(e.target.value)})} />
          </div>

          {/* Row 2 */}
          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-600">Payment Term % <span className="text-red-500">*</span></label>
            <Select disabled={viewOnly} value={form.paymentTermPercent ? String(form.paymentTermPercent) : ""} onValueChange={v => setForm({...form, paymentTermPercent: Number(v)})}>
              <SelectTrigger>
                <SelectValue placeholder="Select" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="33">33%</SelectItem>
                <SelectItem value="50">50%</SelectItem>
                <SelectItem value="100">100%</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-600">Total Amount <span className="text-red-500">*</span></label>
            <Input readOnly className="bg-slate-50" value={computed.totalAmount.toFixed(2)} />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-600">Amount <span className="text-red-500">*</span></label>
            <Input readOnly className="bg-slate-50" value={computed.calculatedAmount.toFixed(2)} />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-600">PKR Discount/Extra Discount <span className="text-red-500">*</span></label>
            <div className="flex items-center gap-4 mt-2">
              <label className="flex items-center gap-2 text-sm text-slate-600">
                <Checkbox 
                  disabled={viewOnly}
                  checked={form.discountType === "PERCENT"} 
                  onCheckedChange={(checked) => {
                    if (checked) setForm({ ...form, discountType: "PERCENT" });
                  }} 
                />
                In Percentage
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-600">
                <Checkbox 
                  disabled={viewOnly}
                  checked={form.discountType === "AMOUNT"} 
                  onCheckedChange={(checked) => {
                    if (checked) setForm({ ...form, discountType: "AMOUNT" });
                  }} 
                />
                In Amount
              </label>
            </div>
            <Input readOnly={viewOnly} type="number" className={`mt-2 ${viewOnly ? "bg-slate-50" : ""}`} value={form.discountValue} onChange={e => setForm({...form, discountValue: Number(e.target.value)})} />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-600">$Grand Total</label>
            <Input readOnly className="bg-slate-50" value={computed.grandTotal.toFixed(2)} />
          </div>

          {/* Row 4 */}
          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-600">Pkr Total</label>
            <Input readOnly className="bg-slate-50" value={Math.round(computed.pkrTotal)} />
          </div>
          {hasAnyPackage ? (
            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-600">Type <span className="text-red-500">*</span></label>
              <Select
                disabled={viewOnly}
                value={form.quotationType || ""}
                onValueChange={(v) => setForm({ ...form, quotationType: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select Type" />
                </SelectTrigger>
                <SelectContent>
                  {QUOTATION_TYPE_OPTIONS.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}
          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-600">Save <span className="text-red-500">*</span></label>
            <Select disabled={viewOnly} value={form.saveStatus || ""} onValueChange={v => setForm({...form, saveStatus: v})}>
              <SelectTrigger>
                <SelectValue placeholder="Select" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Draft">Draft</SelectItem>
                <SelectItem value="Saved">Saved</SelectItem>
                <SelectItem value="Sent">Sent</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1 md:col-span-2">
            <label className="text-sm font-medium text-slate-600">Note</label>
            <Textarea 
              readOnly={viewOnly}
              className={`resize-none ${viewOnly ? "bg-slate-50" : ""}`}
              rows={2}
              value={form.note} 
              onChange={e => setForm({...form, note: e.target.value})} 
            />
          </div>
        </div>

        {!viewOnly ? (
          <div className="flex gap-2">
            <Button 
              className="bg-emerald-600 hover:bg-emerald-700 text-white px-8" 
              onClick={handleSave} 
              disabled={saving}
            >
              {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              Save Change
            </Button>
            <Button 
              className="bg-emerald-600 hover:bg-emerald-700 text-white px-8" 
              onClick={handleReset}
            >
              Reset
            </Button>
          </div>
        ) : null}

      </div>
    </div>
  );
}
