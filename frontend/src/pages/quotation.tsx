import { useEffect, useMemo, useState } from "react";
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

type QuotationItemForm = {
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

function ProductCombobox({ item, products, flatProducts, updateItemProduct }: { item: QuotationItemForm; products: any[]; flatProducts: any[]; updateItemProduct: (productId: string, selectedProduct: any) => void }) {
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
                                    onSelect={() => {
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
    pkrTotal: 0,
    createdAt: new Date().toISOString(),
    items: [
      {
        productId: "",
        detail: "",
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

  const { data: servicesData } = useQuery<any>({ queryKey: ["/api/sales/services"] });
  const products = useMemo(() => {
    return Array.isArray(servicesData) ? servicesData : (servicesData?.items || servicesData?.data || []);
  }, [servicesData]);

  const flatProducts = useMemo(() => {
    const list: any[] = [];
    for (const p of products) {
        if (p.subServices && p.subServices.length > 0) {
            for (const sub of p.subServices) {
                list.push({ ...sub, parentName: p.name, price: sub.price ?? p.price, description: sub.description !== null && sub.description !== undefined ? sub.description : (p.description !== null && p.description !== undefined ? p.description : sub.name) });
            }
        }
    }
    return list;
  }, [products]);

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
          createdAt: q.createdAt || new Date().toISOString(),
          items: items.map((it: any) => ({
            id: it.id,
            productId: it.productId,
            detail: it.detail ?? "",
            minTime: it.minTime ?? undefined,
            maxTime: it.maxTime ?? undefined,
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
      const isXlserp = flatProducts.find((p: any) => p.id === it.productId)?.name === 'Xlserp - Free Website';
      const itemUsd = isXlserp ? (Number(it.quantity) / 90) * (25600 / 280) : Number(it.unitPrice || 0) * Number(it.quantity || 0);
      return sum + itemUsd;
    }, 0);
    const gstAmount = subAmount * (Number(form.gstPercent || 0) / 100);
    const totalAmount = subAmount + gstAmount;
    const discount = form.discountType === "PERCENT" ? totalAmount * (Number(form.discountValue || 0) / 100) : Number(form.discountValue || 0);
    const grandTotal = Math.max(totalAmount - discount, 0);
    return { subAmount, gstAmount, totalAmount, grandTotal };
  }, [form]);

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
        amount: computed.totalAmount,
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
      const res = await apiRequest(form.id ? "PUT" : "POST", form.id ? `/api/quotations/${form.id}` : "/api/quotations", body);
      const json = await res.json();
      toast({ title: "Quotation saved successfully" });
      const returned = json?.data ?? json;
      if (returned?.quotation?.id) {
        setForm((prev) => ({ ...prev, id: returned.quotation.id }));
      }
      queryClient.invalidateQueries({ queryKey: ["/api/quotations", form.leadId] });
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
        <div className="mb-6">
          <h1 className="text-xl font-bold text-slate-800">
            Invoice Quotation <span className="text-emerald-500 font-semibold">{dateStr}</span>
          </h1>
        </div>

        {/* Top Info Section */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-600">Account Holder</label>
            <Input className="bg-white dark:bg-zinc-900 border-slate-200" value={form.accountHolder} onChange={(e) => setForm({ ...form, accountHolder: e.target.value })} />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-600">Company</label>
            <Input className="bg-white dark:bg-zinc-900 border-slate-200" value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-600">Email</label>
            <Input className="bg-white dark:bg-zinc-900 border-slate-200" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-600">Contact</label>
            <Input className="bg-white dark:bg-zinc-900 border-slate-200" value={form.contact} onChange={(e) => setForm({ ...form, contact: e.target.value })} />
          </div>
        </div>

        {/* Line Items Table */}
        <div className="overflow-x-auto mb-4 border border-slate-100 rounded-md">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-100 text-slate-700 font-semibold text-xs whitespace-nowrap">
              <tr>
                <th className="px-3 py-3">Product <span className="text-red-500">*</span></th>
                <th className="px-3 py-3">Detail <span className="text-red-500">*</span></th>
                <th className="px-3 py-3">Min Time <span className="text-red-500">*</span></th>
                <th className="px-3 py-3">Max Time <span className="text-red-500">*</span></th>
                <th className="px-3 py-3">Unit Price <span className="text-red-500">*</span></th>
                <th className="px-3 py-3">Quantity <span className="text-red-500">*</span></th>
                <th className="px-3 py-3">Total Pkr</th>
                <th className="px-3 py-3">Start Year</th>
                <th className="px-3 py-3">End Year <span className="text-red-500">*</span></th>
                <th className="px-3 py-3">Domain URL <span className="text-red-500">*</span></th>
                <th className="px-3 py-3">Action</th>
              </tr>
            </thead>
            <tbody>
              {form.items.map((item, idx) => (
                <tr key={idx} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                  <td className="px-2 py-2 min-w-[200px]">
                    <ProductCombobox 
                      item={item} 
                      products={products} 
                      flatProducts={flatProducts} 
                      updateItemProduct={(productId, selectedProduct) => {
                        updateItem(idx, { 
                          productId, 
                          detail: selectedProduct ? (selectedProduct.description !== null && selectedProduct.description !== undefined ? selectedProduct.description : "") : item.detail,
                          quantity: selectedProduct ? Number(selectedProduct.price || 0) : (item.quantity > 0 ? item.quantity : 1),
                          unitPrice: 1
                        });
                      }} 
                    />
                  </td>
                  <td className="px-2 py-2 min-w-[200px]">
                    <Textarea 
                      className="min-h-[40px] h-10 resize-none" 
                      value={item.detail} 
                      onChange={(e) => updateItem(idx, { detail: e.target.value })} 
                    />
                  </td>
                  <td className="px-2 py-2 min-w-[100px]">
                    <Input 
                      type="number" 
                      className="h-10" 
                      value={item.minTime ?? ""} 
                      onChange={(e) => updateItem(idx, { minTime: e.target.value ? Number(e.target.value) : undefined })} 
                    />
                  </td>
                  <td className="px-2 py-2 min-w-[100px]">
                    <Input 
                      type="number" 
                      className="h-10" 
                      value={item.maxTime ?? ""} 
                      onChange={(e) => updateItem(idx, { maxTime: e.target.value ? Number(e.target.value) : undefined })} 
                    />
                  </td>
                  <td className="px-2 py-2 min-w-[120px]">
                    <Input 
                      type="number" 
                      className="h-10" 
                      value={item.unitPrice} 
                      onChange={(e) => updateItem(idx, { unitPrice: Number(e.target.value) })} 
                    />
                  </td>
                  <td className="px-2 py-2 min-w-[100px]">
                    <Input 
                      type="number" 
                      className="h-10" 
                      value={item.quantity} 
                      onChange={(e) => updateItem(idx, { quantity: Number(e.target.value) })} 
                    />
                  </td>
                  <td className="px-2 py-2 min-w-[120px]">
                    <Input 
                      readOnly 
                      className="h-10 bg-slate-50" 
                      value={(() => {
                        const isXlserp = flatProducts.find((p: any) => p.id === item.productId)?.name === 'Xlserp - Free Website';
                        const itemUsd = isXlserp ? (Number(item.quantity) / 90) * (25600 / 280) : Number(item.unitPrice || 0) * Number(item.quantity || 0);
                        return Math.round(itemUsd * 280);
                      })()} 
                    />
                  </td>
                  <td className="px-2 py-2 min-w-[120px]">
                    <Input 
                      type="number" 
                      className="h-10" 
                      placeholder="Select Year"
                      value={item.startYear} 
                      onChange={(e) => updateItem(idx, { startYear: Number(e.target.value) })} 
                    />
                  </td>
                  <td className="px-2 py-2 min-w-[120px]">
                    <Input 
                      type="number" 
                      className="h-10" 
                      placeholder="Select Year"
                      value={item.endYear} 
                      onChange={(e) => updateItem(idx, { endYear: Number(e.target.value) })} 
                    />
                  </td>
                  <td className="px-2 py-2 min-w-[180px]">
                    <Input 
                      placeholder="Enter domain"
                      className="h-10" 
                      value={item.domainUrl ?? ""} 
                      onChange={(e) => updateItem(idx, { domainUrl: e.target.value })} 
                    />
                  </td>
                  <td className="px-2 py-2 text-center">
                    <Button 
                      size="sm" 
                      className="bg-red-500 hover:bg-red-600 text-white w-full h-10" 
                      onClick={() => removeItem(idx)}
                    >
                      Delete
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mb-8">
          <Button onClick={addItem} className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-md px-6">
            Add Row
          </Button>
        </div>

        {/* Bottom Totals & Settings */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          {/* Row 1 */}
          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-600">Sub Amount <span className="text-red-500">*</span></label>
            <Input readOnly className="bg-slate-50" value={computed.subAmount.toFixed(2)} />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-600">Delivery Time <span className="text-red-500">*</span></label>
            <div className="flex items-center gap-2">
              <Input className="flex-1" value={form.deliveryTimeMin} onChange={e => setForm({...form, deliveryTimeMin: e.target.value})} />
              <span className="text-slate-400">---</span>
              <Input className="flex-1" value={form.deliveryTimeMax} onChange={e => setForm({...form, deliveryTimeMax: e.target.value})} />
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-600">GST % <span className="text-red-500">*</span></label>
            <Input type="number" value={form.gstPercent} onChange={e => setForm({...form, gstPercent: Number(e.target.value)})} />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-600">Payment Term % <span className="text-red-500">*</span></label>
            <Select value={form.paymentTermPercent ? String(form.paymentTermPercent) : ""} onValueChange={v => setForm({...form, paymentTermPercent: Number(v)})}>
              <SelectTrigger>
                <SelectValue placeholder="Select" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0">0%</SelectItem>
                <SelectItem value="25">25%</SelectItem>
                <SelectItem value="50">50%</SelectItem>
                <SelectItem value="75">75%</SelectItem>
                <SelectItem value="100">100%</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Row 2 */}
          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-600">Total Amount <span className="text-red-500">*</span></label>
            <Input readOnly className="bg-slate-50" value={computed.totalAmount.toFixed(2)} />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-600">Amount <span className="text-red-500">*</span></label>
            <Input type="number" value={form.amount} onChange={e => setForm({...form, amount: Number(e.target.value)})} />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-600">Pkr Discount <span className="text-red-500">*</span></label>
            <div className="flex items-center gap-4 mt-2">
              <label className="flex items-center gap-2 text-sm text-slate-600">
                <Checkbox 
                  checked={form.discountType === "PERCENT"} 
                  onCheckedChange={() => setForm({...form, discountType: "PERCENT"})} 
                />
                In Percentage
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-600">
                <Checkbox 
                  checked={form.discountType === "AMOUNT"} 
                  onCheckedChange={() => setForm({...form, discountType: "AMOUNT"})} 
                />
                In Amount
              </label>
            </div>
            <Input type="number" className="mt-2" value={form.discountValue} onChange={e => setForm({...form, discountValue: Number(e.target.value)})} />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-600">$Grand Total</label>
            <Input readOnly className="bg-slate-50" value={computed.grandTotal.toFixed(2)} />
          </div>

          {/* Row 3 */}
          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-600">Pkr Total</label>
            <Input readOnly className="bg-slate-50" value={Math.round(computed.grandTotal * 280)} />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-600">Save <span className="text-red-500">*</span></label>
            <Select value={form.saveStatus || ""} onValueChange={v => setForm({...form, saveStatus: v})}>
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
              className="resize-none" 
              rows={2}
              value={form.note} 
              onChange={e => setForm({...form, note: e.target.value})} 
            />
          </div>
        </div>

        {/* Footer Buttons */}
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

      </div>
    </div>
  );
}
