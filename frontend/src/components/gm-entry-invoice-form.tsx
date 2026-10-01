import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { mutationRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { ChevronsUpDown } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface InvoiceItem {
  id: string;
  productId: string;
  detail: string;
  unitPrice: number;
  quantity: number;
  totalPkr: number;
  discount: number;
}

interface GmEntryInvoiceFormProps {
  entry: any;
  onClose: () => void;
  onSaved?: () => void;
}

function newItem(): InvoiceItem {
  return { id: Math.random().toString(36).substr(2, 9), productId: "", detail: "", unitPrice: 0.5, quantity: 1, totalPkr: 0, discount: 0 };
}

// Seed the first line with the real figures this GM entry was recorded with
// (amount, package, dollar rate) so the invoice isn't starting from a blank
// slate — the account manager edits/confirms real data instead of retyping it.
function buildInitialItem(entry: any, dollarRate: number): InvoiceItem {
  const unitPrice = Number(entry?.amountUsd) || 0.5;
  const quantity = 1;
  const totalPkr = Number(entry?.amountPkr) || unitPrice * quantity * dollarRate;
  const detail = entry?.notes || [entry?.packageType, entry?.entryType].filter(Boolean).join(" • ");
  return { id: Math.random().toString(36).substr(2, 9), productId: "", detail, unitPrice, quantity, totalPkr, discount: 0 };
}

function ProductCombobox({ item, flatProducts, onSelect }: { item: InvoiceItem; flatProducts: any[]; onSelect: (productId: string, product: any) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between bg-white border-slate-200 h-10 focus:ring-emerald-500 font-normal dark:bg-zinc-900 dark:border-zinc-800 overflow-hidden text-ellipsis whitespace-nowrap"
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
                    onSelect(product.id, product);
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

export function GmEntryInvoiceForm({ entry, onClose, onSaved }: GmEntryInvoiceFormProps) {
  const { toast } = useToast();

  const [accountHolder, setAccountHolder] = useState(entry?.salesPersonName || entry?.addedByName || "");
  const [email, setEmail] = useState(entry?.email || "");
  const [dollarRate, setDollarRate] = useState(Number(entry?.dollarRate) || 280);
  const [items, setItems] = useState<InvoiceItem[]>(() => [buildInitialItem(entry, Number(entry?.dollarRate) || 280)]);
  const [gstPercent, setGstPercent] = useState(0);
  const [pkrDiscountValue, setPkrDiscountValue] = useState(0);
  const [discountType, setDiscountType] = useState<"percentage" | "amount">("percentage");

  const { data: products = [] } = useQuery({
    queryKey: ["/api/sales/services"],
    select: (data: any) => data.items || data.data || data || [],
  });

  const flatProducts = useMemo(() => {
    const list: any[] = [];
    for (const p of products as any[]) {
      if (p.subServices && p.subServices.length > 0) {
        for (const sub of p.subServices) {
          list.push({ ...sub, parentName: p.name, price: sub.price ?? p.price, description: sub.description ?? p.description ?? sub.name });
          if (sub.subSubservices && sub.subSubservices.length > 0) {
            for (const subSub of sub.subSubservices) {
              list.push({ ...subSub, parentName: `${p.name} > ${sub.name}`, price: subSub.price ?? sub.price ?? p.price, description: subSub.description ?? sub.description ?? subSub.name });
            }
          }
        }
      } else {
        list.push({ ...p, parentName: p.name });
      }
    }
    return list;
  }, [products]);

  const [subAmount, setSubAmount] = useState(0);
  const [totalAmount, setTotalAmount] = useState(0);
  const [grandTotal, setGrandTotal] = useState(0);
  const [pkrAmount, setPkrAmount] = useState(0);

  useEffect(() => {
    const subPkr = items.reduce((acc, item) => acc + (item.totalPkr - item.discount), 0);
    setSubAmount(subPkr);

    const gstAmount = (subPkr * gstPercent) / 100;
    const totalPkr = subPkr + gstAmount;
    setTotalAmount(totalPkr);

    let finalDiscount = 0;
    if (discountType === "percentage") {
      finalDiscount = (totalPkr * pkrDiscountValue) / 100;
    } else {
      finalDiscount = pkrDiscountValue;
    }

    const gTotalPkr = totalPkr - finalDiscount;
    setPkrAmount(gTotalPkr);
    setGrandTotal(dollarRate > 0 ? gTotalPkr / dollarRate : 0);
  }, [items, gstPercent, pkrDiscountValue, discountType, dollarRate]);

  const updateItem = (id: string, field: keyof InvoiceItem, value: any) => {
    setItems((prev) => prev.map((item) => {
      if (item.id !== id) return item;
      const updated = { ...item, [field]: value };
      if (field === "unitPrice" || field === "quantity") {
        updated.totalPkr = Number(updated.unitPrice) * Number(updated.quantity) * dollarRate;
      }
      return updated;
    }));
  };

  const handleProductSelect = (itemId: string, productId: string, product: any) => {
    setItems((prev) => prev.map((item) => {
      if (item.id !== itemId) return item;
      const unitPrice = Number(product?.price || 0) || item.unitPrice;
      const quantity = item.quantity > 0 ? item.quantity : 1;
      return {
        ...item,
        productId,
        detail: product?.description ?? "",
        unitPrice,
        quantity,
        totalPkr: unitPrice * quantity * dollarRate,
      };
    }));
  };

  const addItem = () => setItems((prev) => [...prev, newItem()]);
  const removeItem = (id: string) => setItems((prev) => (prev.length > 1 ? prev.filter((item) => item.id !== id) : prev));

  const handleReset = () => {
    setItems([buildInitialItem(entry, dollarRate)]);
    setGstPercent(0);
    setPkrDiscountValue(0);
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const validItems = items.filter((it) => it.productId);
      if (validItems.length === 0) {
        throw new Error("Add at least one product line");
      }
      const payload = {
        customerId: null,
        customerName: entry?.companyName || "Unnamed Company",
        customerEmail: email || null,
        customerAddress: entry?.memberId || null,
        items: JSON.stringify(validItems.map((item) => ({
          ...item,
          name: flatProducts.find((p: any) => p.id === item.productId)?.name || "Service",
        }))),
        subtotal: (subAmount / dollarRate).toFixed(2),
        tax: (((subAmount / dollarRate) * gstPercent) / 100).toFixed(2),
        total: grandTotal.toFixed(2),
        dollarRate: dollarRate.toString(),
        status: "Pending",
      };
      return mutationRequest("POST", "/api/account/invoices", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/account/invoices"] });
      queryClient.invalidateQueries({ queryKey: ["/api/account/gm-entries"] });
      toast({ title: "Invoice Created", description: "The invoice has been saved successfully." });
      onSaved?.();
      onClose();
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error?.message || "Failed to save invoice", variant: "destructive" });
    },
  });

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-lg flex flex-col">
      <div className="px-6 py-5 flex justify-between items-center border-b border-slate-100 dark:border-zinc-800">
        <h2 className="text-xl font-semibold text-slate-700 dark:text-zinc-400">
          Invoice <span className="text-emerald-500 font-medium text-lg">{format(new Date(), "dd-MM-yyyy hh:mm a")}</span>
        </h2>
      </div>

      <div className="p-6 space-y-6">
        {/* Header Fields */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div className="space-y-1">
            <Label className="text-[10px] font-bold text-slate-400 uppercase">Account Holder</Label>
            <Input value={accountHolder} onChange={(e) => setAccountHolder(e.target.value)} className="h-10 border-slate-200 dark:border-zinc-800" />
          </div>
          <div className="space-y-1">
            <Label className="text-[10px] font-bold text-slate-400 uppercase">Company</Label>
            <Input value={entry?.companyName || ""} readOnly className="h-10 bg-slate-50 border-slate-200 dark:bg-zinc-800 dark:border-zinc-800" />
          </div>
          <div className="space-y-1">
            <Label className="text-[10px] font-bold text-slate-400 uppercase">Email</Label>
            <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="-" className="h-10 border-slate-200 dark:border-zinc-800" />
          </div>
          <div className="space-y-1">
            <Label className="text-[10px] font-bold text-slate-400 uppercase">Contact</Label>
            <Input value={entry?.memberId || "-"} readOnly className="h-10 bg-slate-50 border-slate-200 dark:bg-zinc-800 dark:border-zinc-800" />
          </div>
          <div className="space-y-1">
            <Label className="text-[10px] font-bold text-slate-400 uppercase">Dollar Rate</Label>
            <Input
              type="number"
              value={dollarRate}
              onChange={(e) => {
                const newRate = Number(e.target.value) || 0;
                setDollarRate(newRate);
                setItems((prev) => prev.map((item) => ({ ...item, totalPkr: Number(item.unitPrice) * Number(item.quantity) * newRate })));
              }}
              className="h-10 border-slate-200 dark:border-zinc-800"
            />
          </div>
        </div>

        {/* Items Table */}
        <div className="border rounded-lg overflow-hidden">
          <div className="grid grid-cols-12 gap-2 bg-slate-50/50 dark:bg-zinc-900 px-4 py-3 border-b">
            <div className="col-span-3 text-[10px] font-bold uppercase text-slate-500 dark:text-zinc-400">Product</div>
            <div className="col-span-3 text-[10px] font-bold uppercase text-slate-500 dark:text-zinc-400">Detail</div>
            <div className="col-span-1 text-[10px] font-bold uppercase text-slate-500 dark:text-zinc-400">Unit Price ($)</div>
            <div className="col-span-1 text-[10px] font-bold uppercase text-slate-500 dark:text-zinc-400">Quantity</div>
            <div className="col-span-1 text-[10px] font-bold uppercase text-slate-500 dark:text-zinc-400">Total Pkr</div>
            <div className="col-span-1 text-[10px] font-bold uppercase text-slate-500 dark:text-zinc-400">Discount</div>
            <div className="col-span-2 text-[10px] font-bold uppercase text-slate-500 dark:text-zinc-400 text-center">Action</div>
          </div>

          <div className="divide-y">
            {items.map((item) => (
              <div key={item.id} className="grid grid-cols-12 gap-2 items-center px-4 py-3">
                <div className="col-span-3">
                  <ProductCombobox item={item} flatProducts={flatProducts} onSelect={(productId, product) => handleProductSelect(item.id, productId, product)} />
                </div>
                <div className="col-span-3">
                  <Input value={item.detail} onChange={(e) => updateItem(item.id, "detail", e.target.value)} className="h-10 border-slate-200 dark:border-zinc-800" />
                </div>
                <div className="col-span-1">
                  <Input type="number" value={item.unitPrice} onChange={(e) => updateItem(item.id, "unitPrice", parseFloat(e.target.value) || 0)} className="h-10 border-slate-200 dark:border-zinc-800" />
                </div>
                <div className="col-span-1">
                  <Input type="number" value={item.quantity} onChange={(e) => updateItem(item.id, "quantity", parseInt(e.target.value) || 0)} className="h-10 border-slate-200 dark:border-zinc-800" />
                </div>
                <div className="col-span-1">
                  <Input value={Math.round(item.totalPkr)} readOnly className="h-10 bg-slate-50 border-slate-200 dark:bg-zinc-800 dark:border-zinc-800" />
                </div>
                <div className="col-span-1">
                  <Input type="number" value={item.discount} onChange={(e) => updateItem(item.id, "discount", parseFloat(e.target.value) || 0)} className="h-10 border-slate-200 dark:border-zinc-800" />
                </div>
                <div className="col-span-2 flex justify-center">
                  <Button variant="destructive" size="sm" className="bg-rose-500 hover:bg-rose-600 h-9 w-9 p-0" onClick={() => removeItem(item.id)}>
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4"><path d="M3 6h18" /><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /></svg>
                  </Button>
                </div>
              </div>
            ))}
          </div>

          <div className="px-4 py-3 border-t">
            <Button variant="outline" size="sm" onClick={addItem} className="border-dashed border-2 text-slate-500 hover:border-emerald-500 hover:text-emerald-500">
              + Add Product
            </Button>
          </div>
        </div>

        {/* Totals */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="space-y-1">
            <Label className="text-[10px] font-bold text-slate-400 uppercase">Sub Amount (PKR)</Label>
            <Input value={subAmount.toFixed(2)} readOnly className="h-10 bg-slate-50 border-slate-200 dark:bg-zinc-800 dark:border-zinc-800" />
          </div>
          <div className="space-y-1">
            <Label className="text-[10px] font-bold text-slate-400 uppercase">GST %</Label>
            <Input type="number" value={gstPercent} onChange={(e) => setGstPercent(parseFloat(e.target.value) || 0)} className="h-10 border-slate-200 dark:border-zinc-800" />
          </div>
          <div className="space-y-1">
            <Label className="text-[10px] font-bold text-slate-400 uppercase">Total Amount (PKR)</Label>
            <Input value={totalAmount.toFixed(2)} readOnly className="h-10 bg-slate-50 border-slate-200 dark:bg-zinc-800 dark:border-zinc-800" />
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-4">
              <Label className="text-[10px] font-bold text-slate-400 uppercase whitespace-nowrap">Pkr Discount</Label>
              <div className="flex items-center gap-2">
                <Checkbox id="gm-disc-perc" checked={discountType === "percentage"} onCheckedChange={() => setDiscountType("percentage")} />
                <label htmlFor="gm-disc-perc" className="text-[11px] text-slate-500 dark:text-zinc-400 cursor-pointer">In Percentage</label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox id="gm-disc-amt" checked={discountType === "amount"} onCheckedChange={() => setDiscountType("amount")} />
                <label htmlFor="gm-disc-amt" className="text-[11px] text-slate-500 dark:text-zinc-400 cursor-pointer">In Amount</label>
              </div>
            </div>
            <Input type="number" value={pkrDiscountValue} onChange={(e) => setPkrDiscountValue(parseFloat(e.target.value) || 0)} className="h-10 border-slate-200 dark:border-zinc-800" />
          </div>

          <div className="space-y-1">
            <Label className="text-[10px] font-bold text-rose-500 uppercase">$Grand Total</Label>
            <Input value={grandTotal.toFixed(2)} readOnly className="h-10 bg-slate-50 border-slate-200 font-bold dark:bg-zinc-800 dark:border-zinc-800" />
          </div>

          <div className="space-y-1">
            <Label className="text-[10px] font-bold text-slate-400 uppercase">Pkr Amount</Label>
            <Input value={pkrAmount.toFixed(2)} readOnly className="h-10 bg-slate-50 border-slate-200 dark:bg-zinc-800 dark:border-zinc-800" />
          </div>
        </div>
      </div>

      <div className="p-6 pt-4 bg-white border-t border-slate-50 flex justify-end gap-3 dark:bg-zinc-900 dark:border-zinc-800">
        <Button variant="ghost" onClick={handleReset} className="bg-slate-100 text-slate-800 hover:bg-slate-200 px-6 h-10 font-semibold rounded-md dark:text-zinc-100 dark:bg-zinc-800">
          Reset
        </Button>
        <Button
          onClick={() => saveMutation.mutate()}
          disabled={saveMutation.isPending}
          className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 h-10 font-semibold rounded-md"
        >
          {saveMutation.isPending ? "Saving..." : "Save Change"}
        </Button>
      </div>
    </div>
  );
}
