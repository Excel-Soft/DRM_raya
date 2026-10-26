"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { mutationRequest, queryClient } from "@/lib/query/query-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/legacy/checkbox";
import { useToast } from "@/lib/hooks/use-legacy-toast";
import { Trash2 } from "lucide-react";
import { ProductSelectField } from "@/modules/sales/product-select-field";
import {
  JournalDocumentShell,
  JournalFormFooter,
  JournalLineHeaderRow,
  JournalLineRow,
  JournalLinesPanel,
  JournalMetaField,
  JournalMetaGrid,
  JournalTotalsGrid,
  journalFieldLabelClass,
  journalInputClass,
  journalReadonlyInputClass,
} from "@/modules/finance/journal-document-ui";
import { AccountPrimaryButton } from "@/modules/account/account-ui";
import { cn } from "@/lib/utils/cn";

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
  return {
    id: Math.random().toString(36).substr(2, 9),
    productId: "",
    detail: "",
    unitPrice: 0.5,
    quantity: 1,
    totalPkr: 0,
    discount: 0,
  };
}

function buildInitialItem(entry: any, dollarRate: number): InvoiceItem {
  const unitPrice = Number(entry?.amountUsd) || 0.5;
  const quantity = 1;
  const totalPkr = Number(entry?.amountPkr) || unitPrice * quantity * dollarRate;
  const detail = entry?.notes || [entry?.packageType, entry?.entryType].filter(Boolean).join(" • ");
  return {
    id: Math.random().toString(36).substr(2, 9),
    productId: "",
    detail,
    unitPrice,
    quantity,
    totalPkr,
    discount: 0,
  };
}

const LINE_COLS = [
  { label: "Product", className: "col-span-3" },
  { label: "Detail", className: "col-span-3" },
  { label: "Unit price ($)", className: "col-span-1" },
  { label: "Qty", className: "col-span-1" },
  { label: "Total PKR", className: "col-span-1" },
  { label: "Discount", className: "col-span-1" },
  { label: "Action", className: "col-span-2 text-center" },
];

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
          list.push({
            ...sub,
            parentName: p.name,
            price: sub.price ?? p.price,
            description: sub.description ?? p.description ?? sub.name,
          });
          if (sub.subSubservices && sub.subSubservices.length > 0) {
            for (const subSub of sub.subSubservices) {
              list.push({
                ...subSub,
                parentName: `${p.name} > ${sub.name}`,
                price: subSub.price ?? sub.price ?? p.price,
                description: subSub.description ?? sub.description ?? subSub.name,
              });
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
    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        const updated = { ...item, [field]: value };
        if (field === "unitPrice" || field === "quantity") {
          updated.totalPkr = Number(updated.unitPrice) * Number(updated.quantity) * dollarRate;
        }
        return updated;
      }),
    );
  };

  const handleProductSelect = (itemId: string, product: any) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== itemId) return item;
        const unitPrice = Number(product?.price || 0) || item.unitPrice;
        const quantity = item.quantity > 0 ? item.quantity : 1;
        return {
          ...item,
          productId: product.id,
          detail: product?.description ?? "",
          unitPrice,
          quantity,
          totalPkr: unitPrice * quantity * dollarRate,
        };
      }),
    );
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
        items: JSON.stringify(
          validItems.map((item) => ({
            ...item,
            name: flatProducts.find((p: any) => p.id === item.productId)?.name || "Service",
          })),
        ),
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

  const companyLabel = entry?.drmId
    ? `${entry.companyName || ""} (${entry.drmId})`
    : entry?.companyName || "";

  return (
    <JournalDocumentShell
      kind="invoice"
      subtitle={companyLabel}
      footer={
        <JournalFormFooter>
          <Button type="button" variant="secondary" size="sm" onClick={handleReset}>
            Reset
          </Button>
          <Button type="button" variant="secondary" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <AccountPrimaryButton disabled={saveMutation.isPending} onClick={() => saveMutation.mutate()}>
            {saveMutation.isPending ? "Saving…" : "Save invoice"}
          </AccountPrimaryButton>
        </JournalFormFooter>
      }
    >
      <div className="space-y-6">
        <JournalMetaGrid>
          <JournalMetaField label="Account holder" value={accountHolder} onChange={setAccountHolder} />
          <JournalMetaField label="Company" value={companyLabel} readOnly />
          <JournalMetaField label="Email" value={email} onChange={setEmail} placeholder="—" />
          <JournalMetaField label="Contact" value={entry?.memberId || "—"} readOnly />
          <JournalMetaField
            label="Dollar rate"
            type="number"
            value={dollarRate}
            onChange={(v) => {
              const newRate = Number(v) || 0;
              setDollarRate(newRate);
              setItems((prev) =>
                prev.map((item) => ({
                  ...item,
                  totalPkr: Number(item.unitPrice) * Number(item.quantity) * newRate,
                })),
              );
            }}
          />
        </JournalMetaGrid>

        <JournalLinesPanel
          header={<JournalLineHeaderRow columns={LINE_COLS} />}
          addAction={
            <Button type="button" variant="secondary" size="sm" onClick={addItem} className="border-dashed">
              + Add product
            </Button>
          }
        >
          {items.map((item) => (
            <JournalLineRow key={item.id}>
              <div className="md:col-span-3">
                <ProductSelectField
                  value={item.productId}
                  flatProducts={flatProducts}
                  onSelect={(p) => handleProductSelect(item.id, p)}
                />
              </div>
              <div className="md:col-span-3">
                <Input
                  value={item.detail}
                  onChange={(e) => updateItem(item.id, "detail", e.target.value)}
                  className={journalInputClass}
                />
              </div>
              <div className="md:col-span-1">
                <Input
                  type="number"
                  value={item.unitPrice}
                  onChange={(e) => updateItem(item.id, "unitPrice", parseFloat(e.target.value) || 0)}
                  className={journalInputClass}
                />
              </div>
              <div className="md:col-span-1">
                <Input
                  type="number"
                  value={item.quantity}
                  onChange={(e) => updateItem(item.id, "quantity", parseInt(e.target.value, 10) || 0)}
                  className={journalInputClass}
                />
              </div>
              <div className="md:col-span-1">
                <Input readOnly value={Math.round(item.totalPkr)} className={journalReadonlyInputClass} />
              </div>
              <div className="md:col-span-1">
                <Input
                  type="number"
                  value={item.discount}
                  onChange={(e) => updateItem(item.id, "discount", parseFloat(e.target.value) || 0)}
                  className={journalInputClass}
                />
              </div>
              <div className="flex justify-center md:col-span-2">
                <Button
                  type="button"
                  variant="danger"
                  size="sm"
                  className="h-9 w-9 p-0"
                  onClick={() => removeItem(item.id)}
                  aria-label="Remove line"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </JournalLineRow>
          ))}
        </JournalLinesPanel>

        <JournalTotalsGrid>
          <div className="space-y-1">
            <Label className={journalFieldLabelClass}>Sub amount (PKR)</Label>
            <Input readOnly value={subAmount.toFixed(2)} className={journalReadonlyInputClass} />
          </div>
          <div className="space-y-1">
            <Label className={journalFieldLabelClass}>GST %</Label>
            <Input
              type="number"
              value={gstPercent}
              onChange={(e) => setGstPercent(parseFloat(e.target.value) || 0)}
              className={journalInputClass}
            />
          </div>
          <div className="space-y-1">
            <Label className={journalFieldLabelClass}>Total amount (PKR)</Label>
            <Input readOnly value={totalAmount.toFixed(2)} className={journalReadonlyInputClass} />
          </div>

          <div className="space-y-2 md:col-span-3">
            <div className="flex flex-wrap items-center gap-4">
              <Label className={cn(journalFieldLabelClass, "whitespace-nowrap")}>PKR discount</Label>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="gm-disc-perc"
                  checked={discountType === "percentage"}
                  onCheckedChange={() => setDiscountType("percentage")}
                />
                <label htmlFor="gm-disc-perc" className="cursor-pointer text-[11px] text-zinc-500">
                  In percentage
                </label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="gm-disc-amt"
                  checked={discountType === "amount"}
                  onCheckedChange={() => setDiscountType("amount")}
                />
                <label htmlFor="gm-disc-amt" className="cursor-pointer text-[11px] text-zinc-500">
                  In amount
                </label>
              </div>
            </div>
            <Input
              type="number"
              value={pkrDiscountValue}
              onChange={(e) => setPkrDiscountValue(parseFloat(e.target.value) || 0)}
              className={journalInputClass}
            />
          </div>

          <div className="space-y-1">
            <Label className={cn(journalFieldLabelClass, "text-rose-600 dark:text-rose-400")}>$ Grand total</Label>
            <Input readOnly value={grandTotal.toFixed(2)} className={cn(journalReadonlyInputClass, "font-semibold")} />
          </div>
          <div className="space-y-1">
            <Label className={journalFieldLabelClass}>PKR amount</Label>
            <Input readOnly value={pkrAmount.toFixed(2)} className={journalReadonlyInputClass} />
          </div>
        </JournalTotalsGrid>
      </div>
    </JournalDocumentShell>
  );
}
