import { useState, useEffect, useMemo } from "react";
import { getAuthHeader } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Trash2, Plus, RotateCcw, Save } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";


interface InvoiceItem {
    id: string;
    productId: string;
    detail: string;
    unitPrice: number;
    quantity: number;
    discount: number;
}

interface InvoiceCreateFormProps {
    lead: any;
    onSave?: (data: any) => void;
    onClose?: () => void;
}

const DEFAULT_PRODUCTS = [
    { id: "def-0", name: "Select" },
    { id: "def-1", name: "Domain Registration" },
    { id: "def-2", name: "1 Year" },
    { id: "def-3", name: "country Base Domain" },
    { id: "def-4", name: "On Request (Custom Price)" },
    { id: "def-5", name: "Pk Domain (2 Years)" },
    { id: "def-6", name: "Hosting Plan" },
];

import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";

export default function InvoiceCreateForm({ lead, onSave, onClose }: InvoiceCreateFormProps) {
    const [items, setItems] = useState<InvoiceItem[]>([
        { id: Math.random().toString(36).substr(2, 9), productId: "", detail: "", unitPrice: 0.5, quantity: 1, discount: 0 }
    ]);
    const [gstPercent, setGstPercent] = useState(0);
    const [discountType, setDiscountType] = useState<"percentage" | "amount">("percentage");
    const [discountValue, setDiscountValue] = useState(0);

    const [headerData, setHeaderData] = useState({
        accountName: "",
        companyName: "",
        email: "",
        phone: ""
    });

    const [openCombobox, setOpenCombobox] = useState<{ [key: string]: boolean }>({});

    useEffect(() => {
        if (lead) {
            setHeaderData({
                accountName: lead?.accountName || lead?.accHolder || "",
                companyName: lead?.companyName || lead?.company || "",
                email: lead?.email || "",
                phone: lead?.phone || lead?.mobile || ""
            });
        }
    }, [lead]);

    const { data: productsData = [] } = useQuery<any[]>({
        queryKey: ["/api/products"],
        queryFn: async () => {
            const res = await fetch("/api/sales/products", { headers: getAuthHeader(), credentials: "include" }); // Adjust endpoint if needed
            if (!res.ok) {
                // Fallback or handle error
                const res2 = await fetch("/api/products", { headers: getAuthHeader(), credentials: "include" });
                if (!res2.ok) return [];
                return await res2.json();
            }
            const json = await res.json();
            return json.data || json;
        }
    });

    const products = useMemo(() => {
        const apiProducts = Array.isArray(productsData) ? productsData : [];
        // Combine API products with default ones, filter out duplicates by name
        const combined = [...DEFAULT_PRODUCTS];
        apiProducts.forEach(ap => {
            if (!combined.some(c => c.name.toLowerCase() === ap.name.toLowerCase())) {
                combined.push(ap);
            }
        });
        return combined;
    }, [productsData]);

    const totals = useMemo(() => {
        const subTotal = items.reduce((sum, item) => sum + (Number(item.unitPrice || 0) * Number(item.quantity || 0)), 0);
        const gstAmount = subTotal * (Number(gstPercent || 0) / 100);
        const totalAmount = subTotal + gstAmount;

        let discountAmount = 0;
        if (discountType === "percentage") {
            discountAmount = totalAmount * (Number(discountValue || 0) / 100);
        } else {
            discountAmount = Number(discountValue || 0);
        }

        const grandTotal = Math.max(totalAmount - discountAmount, 0);

        return {
            subTotal,
            gstAmount,
            totalAmount,
            discountAmount,
            grandTotal
        };
    }, [items, gstPercent, discountType, discountValue]);

    const addRow = () => {
        setItems([...items, { id: Math.random().toString(36).substr(2, 9), productId: "", detail: "", unitPrice: 0, quantity: 1, discount: 0 }]);
    };

    const removeRow = (id: string) => {
        if (items.length > 1) {
            setItems(items.filter(it => it.id !== id));
        }
    };

    const updateItem = (id: string, field: keyof InvoiceItem, value: any) => {
        setItems(items.map(it => it.id === id ? { ...it, [field]: value } : it));
    };

    const handleReset = () => {
        setItems([{ id: Math.random().toString(36).substr(2, 9), productId: "", detail: "", unitPrice: 0.5, quantity: 1, discount: 0 }]);
        setGstPercent(0);
        setDiscountValue(0);
    };

    const [saving, setSaving] = useState(false);
    const { toast } = useToast();

    const handleSave = async () => {
        try {
            setSaving(true);

            // Basic validation
            const validItems = items.filter(it => it.productId);
            if (validItems.length === 0) {
                toast({ title: "Validation Error", description: "At least one item with a product is required", variant: "destructive" });
                return;
            }

            const payload = {
                leadId: lead?.id,
                customerId: (lead as any)?.customerId || null,
                accountHolder: headerData.accountName,
                company: headerData.companyName,
                email: headerData.email,
                contact: headerData.phone,
                gstPercent: gstPercent,
                discountType: (discountType === "percentage" ? "PERCENT" : "AMOUNT") as "PERCENT" | "AMOUNT",
                discountValue: discountValue,
                items: validItems.map(it => {
                    const prod = products.find(p => p.name === it.productId || p.id === it.productId);
                    return {
                        productId: prod?.id || it.productId,
                        detail: it.detail,
                        unitPrice: it.unitPrice,
                        quantity: it.quantity,
                        startYear: new Date().getFullYear(),
                        endYear: new Date().getFullYear()
                    };
                })
            };

            const res = await fetch("/api/quotations", {
                method: "POST",
                headers: { "Content-Type": "application/json", ...getAuthHeader() },
                body: JSON.stringify(payload),
                credentials: "include"
            });

            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.message || "Failed to save invoice");
            }

            toast({ title: "Success", description: "Invoice saved successfully" });
            onSave?.(totals);
        } catch (err: any) {
            toast({ title: "Error", description: err.message, variant: "destructive" });
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100 space-y-6 max-w-7xl mx-auto dark:bg-zinc-900 dark:border-zinc-800">
            <div className="flex items-center justify-between border-b pb-4">
                <h2 className="text-[#10b981] font-bold flex items-center gap-2 dark:text-zinc-100">
                    Invoice <span className="text-gray-400 font-normal">{format(new Date(), "dd-MM-yyyy hh:mm a")}</span>
                </h2>
            </div>

            {/* Header Grid */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="space-y-1">
                    <Label className="text-[10px] font-bold text-gray-400 uppercase">Account Holder</Label>
                    <Input
                        value={headerData.accountName}
                        onChange={(e) => setHeaderData({ ...headerData, accountName: e.target.value })}
                        className="h-9 border-gray-200 dark:border-zinc-800"
                    />
                </div>
                <div className="space-y-1">
                    <Label className="text-[10px] font-bold text-gray-400 uppercase">Company</Label>
                    <Input
                        value={headerData.companyName}
                        onChange={(e) => setHeaderData({ ...headerData, companyName: e.target.value })}
                        className="h-9 border-gray-200 dark:border-zinc-800"
                    />
                </div>
                <div className="space-y-1">
                    <Label className="text-[10px] font-bold text-gray-400 uppercase">Email</Label>
                    <Input
                        value={headerData.email}
                        onChange={(e) => setHeaderData({ ...headerData, email: e.target.value })}
                        className="h-9 border-gray-200 dark:border-zinc-800"
                    />
                </div>
                <div className="space-y-1">
                    <Label className="text-[10px] font-bold text-gray-400 uppercase">Contact</Label>
                    <Input
                        value={headerData.phone}
                        onChange={(e) => setHeaderData({ ...headerData, phone: e.target.value })}
                        className="h-9 border-gray-200 dark:border-zinc-800"
                    />
                </div>
            </div>

            {/* Items Table */}
            <div className="border rounded-lg overflow-hidden">
                <Table>
                    <TableHeader className="bg-gray-50/50">
                        <TableRow>
                            <TableHead className="text-[10px] font-bold uppercase w-[240px]">Product</TableHead>
                            <TableHead className="text-[10px] font-bold uppercase">Detail</TableHead>
                            <TableHead className="text-[10px] font-bold uppercase w-[100px]">Unit Price</TableHead>
                            <TableHead className="text-[10px] font-bold uppercase w-[80px]">Quantity</TableHead>
                            <TableHead className="text-[10px] font-bold uppercase w-[100px]">Total Pkr</TableHead>
                            <TableHead className="text-[10px] font-bold uppercase w-[100px]">Discount</TableHead>
                            <TableHead className="text-[10px] font-bold uppercase w-[80px] text-center">Action</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {items.map((item) => (
                            <TableRow key={item.id} className="group">
                                <TableCell className="align-top">
                                    <Popover
                                        open={openCombobox[item.id]}
                                        onOpenChange={(open) => setOpenCombobox(prev => ({ ...prev, [item.id]: open }))}
                                    >
                                        <PopoverTrigger asChild>
                                            <Button
                                                variant="outline"
                                                role="combobox"
                                                className="w-full justify-between h-9 font-normal border-gray-200 text-gray-600 dark:text-zinc-300 dark:border-zinc-800"
                                            >
                                                <span className="truncate">
                                                    {item.productId ? item.productId : "Select"}
                                                </span>
                                                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-[300px] p-0 shadow-lg border-emerald-100" align="start">
                                            <Command>
                                                <CommandInput placeholder="Search product..." className="h-9" />
                                                <CommandList className="max-h-[300px]">
                                                    <CommandEmpty>No product found.</CommandEmpty>
                                                    <CommandGroup>
                                                        {products.map((p) => (
                                                            <CommandItem
                                                                key={p.id || p.name}
                                                                value={p.name}
                                                                onSelect={(currentValue) => {
                                                                    setItems(prev => prev.map(it => it.id === item.id ? {
                                                                        ...it,
                                                                        productId: p.name,
                                                                        detail: p.description || p.name || "",
                                                                        unitPrice: Number(p.price || p.unitPrice || 0),
                                                                        quantity: it.quantity > 0 ? it.quantity : 1
                                                                    } : it));
                                                                    setOpenCombobox(prev => ({ ...prev, [item.id]: false }));
                                                                }}
                                                                className={cn(
                                                                    "cursor-pointer transition-colors px-4 py-2",
                                                                    item.productId === p.name
                                                                        ? "bg-[#10b981] text-white aria-selected:bg-[#10b981] aria-selected:text-white"
                                                                        : "hover:bg-emerald-50 aria-selected:bg-emerald-50"
                                                                )}
                                                            >
                                                                {p.name}
                                                            </CommandItem>
                                                        ))}
                                                    </CommandGroup>
                                                </CommandList>
                                            </Command>
                                        </PopoverContent>
                                    </Popover>
                                </TableCell>

                                <TableCell className="align-top">
                                    <Textarea
                                        value={item.detail}
                                        onChange={(e) => updateItem(item.id, "detail", e.target.value)}
                                        className="min-h-[36px] h-9 resize-y py-1.5"
                                    />
                                </TableCell>
                                <TableCell className="align-top">
                                    <Input
                                        type="number"
                                        value={item.unitPrice}
                                        onChange={(e) => updateItem(item.id, "unitPrice", Number(e.target.value))}
                                        className="h-9"
                                    />
                                </TableCell>
                                <TableCell className="align-top">
                                    <Input
                                        type="number"
                                        value={item.quantity}
                                        onChange={(e) => updateItem(item.id, "quantity", Number(e.target.value))}
                                        className="h-9"
                                    />
                                </TableCell>
                                <TableCell className="align-top">
                                    <Input
                                        value={(item.unitPrice * item.quantity).toFixed(2)}
                                        readOnly
                                        className="h-9 bg-gray-50 font-mono text-sm dark:bg-zinc-900"
                                    />
                                </TableCell>
                                <TableCell className="align-top">
                                    <Input
                                        type="number"
                                        value={item.discount}
                                        onChange={(e) => updateItem(item.id, "discount", Number(e.target.value))}
                                        className="h-9"
                                    />
                                </TableCell>
                                <TableCell className="align-top text-center">
                                    <Button
                                        variant="destructive"
                                        size="sm"
                                        onClick={() => removeRow(item.id)}
                                        className="bg-[#10b981] hover:bg-[#059669] h-8 px-3"
                                    >
                                        Delete
                                    </Button>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>

            <div className="flex justify-between items-start gap-8">
                <div className="flex gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={addRow}
                        className="h-9 border-gray-200 text-gray-500 hover:text-gray-700 dark:text-zinc-400 dark:border-zinc-800"
                    >
                        <Plus className="w-4 h-4 mr-1" /> Add Row
                    </Button>
                </div>

                {/* Totals Section */}
                <div className="flex-1 max-w-4xl grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="space-y-1">
                        <Label className="text-[10px] font-bold text-gray-400 uppercase">Sub Amount</Label>
                        <Input value={totals.subTotal.toFixed(2)} readOnly className="h-10 bg-white border-gray-200 dark:bg-zinc-900 dark:border-zinc-800" />
                    </div>
                    <div className="space-y-1">
                        <Label className="text-[10px] font-bold text-gray-400 uppercase">GST %</Label>
                        <Input
                            type="number"
                            value={gstPercent}
                            onChange={(e) => setGstPercent(Number(e.target.value))}
                            className="h-10 border-gray-200 dark:border-zinc-800"
                        />
                    </div>
                    <div className="space-y-1">
                        <Label className="text-[10px] font-bold text-gray-400 uppercase">Total Amount</Label>
                        <Input value={totals.totalAmount.toFixed(2)} readOnly className="h-10 bg-white border-gray-200 dark:bg-zinc-900 dark:border-zinc-800" />
                    </div>

                    <div className="space-y-3">
                        <div className="flex items-center gap-4">
                            <Label className="text-[10px] font-bold text-gray-400 uppercase">Pkr Discount</Label>
                            <div className="flex items-center gap-2">
                                <Checkbox
                                    id="disc-perc"
                                    checked={discountType === "percentage"}
                                    onCheckedChange={() => setDiscountType("percentage")}
                                />
                                <Label htmlFor="disc-perc" className="text-[10px] text-gray-400">In Percentage</Label>
                            </div>
                            <div className="flex items-center gap-2">
                                <Checkbox
                                    id="disc-amt"
                                    checked={discountType === "amount"}
                                    onCheckedChange={() => setDiscountType("amount")}
                                />
                                <Label htmlFor="disc-amt" className="text-[10px] text-gray-400">In Amount</Label>
                            </div>
                        </div>
                        <Input
                            value={totals.discountAmount.toFixed(2)}
                            readOnly
                            className="h-10 bg-[#f1f5f9] border-none font-mono dark:bg-zinc-800"
                        />
                    </div>

                    <div className="space-y-1">
                        <Label className="text-[10px] font-bold text-gray-400 uppercase">$Grand Total</Label>
                        <Input value={totals.grandTotal.toFixed(2)} readOnly className="h-10 border-gray-200 dark:border-zinc-800" />
                    </div>

                    <div className="space-y-1">
                        <Label className="text-[10px] font-bold text-gray-400 uppercase">Pkr Amount</Label>
                        <Input
                            type="number"
                            value={discountValue}
                            onChange={(e) => setDiscountValue(Number(e.target.value))}
                            className="h-10 border-gray-200 dark:border-zinc-800"
                        />
                    </div>
                </div>
            </div>

            <div className="flex items-center gap-2 pt-4 border-t">
                <Button
                    className="bg-[#10b981] hover:bg-[#059669] text-white font-bold h-10 px-6 rounded"
                    disabled={saving}
                    onClick={handleSave}
                >
                    {saving ? "Saving..." : "Save Change"}
                </Button>

                <Button
                    variant="outline"
                    className="bg-[#10b981] hover:bg-[#059669] border-[#10b981] text-white font-bold h-10 px-6 rounded dark:border-zinc-800"
                    onClick={handleReset}
                >
                    Reset
                </Button>
            </div>
        </div>
    );
}
