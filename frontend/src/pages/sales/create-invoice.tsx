import { useState, useEffect, useMemo, useRef } from "react";
import { useRoute, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { InvoiceReceipt } from "@/components/invoice/InvoiceReceipt";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { ChevronsUpDown, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import html2canvas from "html2canvas";
import { useReactToPrint } from "react-to-print";

interface InvoiceItem {
    id: string;
    productId: string;
    detail: string;
    unitPrice: number;
    quantity: number;
    totalPkr: number;
    discount: number;
}

interface Customer {
    id: string;
    companyName: string;
    accountName: string;
    email: string;
    phone: string;
}

function ProductCombobox({ item, products, flatProducts, updateItemProduct }: { item: InvoiceItem; products: any[]; flatProducts: any[]; updateItemProduct: (itemId: string, productId: string, selectedProduct: any) => void }) {
    const [open, setOpen] = useState(false);

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    className="w-full justify-between bg-white border-slate-200 h-11 focus:ring-emerald-500 font-normal dark:bg-zinc-900 dark:border-zinc-800 overflow-hidden text-ellipsis whitespace-nowrap"
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
                                        updateItemProduct(item.id, product.id, product);
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

export default function CreateInvoice() {
    const [, params] = useRoute("/sales/create-invoice/:customerId");
    const [, setLocation] = useLocation();
    const { toast } = useToast();
    const customerId = params?.customerId;
    const receiptRef = useRef<HTMLDivElement>(null);

    const userRoleName = (typeof window !== "undefined" ? sessionStorage.getItem("userRole") : "")?.toLowerCase().replace(/\s+/g, "_") || "";
    const canCreateInvoice = userRoleName === "sales_executive";

    const [items, setItems] = useState<InvoiceItem[]>([
        { id: Math.random().toString(36).substr(2, 9), productId: "", detail: "", unitPrice: 0.5, quantity: 1, totalPkr: 0.5, discount: 0 }
    ]);

    const [subAmount, setSubAmount] = useState(0);
    const [gstPercent, setGstPercent] = useState(0);
    const [totalAmount, setTotalAmount] = useState(0);
    const [pkrDiscountValue, setPkrDiscountValue] = useState(0);
    const [discountType, setDiscountType] = useState<"percentage" | "amount">("percentage");
    const [grandTotal, setGrandTotal] = useState(0);
    const [pkrAmount, setPkrAmount] = useState(0);
    const [showReceipt, setShowReceipt] = useState(false);
    const [lastSavedInvoice, setLastSavedInvoice] = useState<any>(null);

    const { data: customer, isLoading: isLoadingCustomer, isError: isCustomerError } = useQuery<Customer>({
        queryKey: [`/api/sales/customers/${customerId}`],
        enabled: !!customerId,
        select: (res: any) => res.data || res,
    });

    const { data: invoiceInfo } = useQuery<{ invoiceNumber: string }>({
        queryKey: ["/api/account/invoices/next-number"],
    });

    const { data: products = [] } = useQuery({
        queryKey: ["/api/sales/services"],
        select: (data: any) => data.items || data.data || data || [],
    });

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
        const sub = items.reduce((acc, item) => acc + (item.totalPkr - item.discount), 0);
        setSubAmount(sub);

        const gst = (sub * gstPercent) / 100;
        const total = sub + gst;
        setTotalAmount(total);

        let finalDiscount = 0;
        if (discountType === "percentage") {
            finalDiscount = (total * pkrDiscountValue) / 100;
        } else {
            finalDiscount = pkrDiscountValue;
        }

        const gTotal = total - finalDiscount;
        setGrandTotal(gTotal);
        setPkrAmount(gTotal * 280);
    }, [items, gstPercent, pkrDiscountValue, discountType]);

    const addItem = () => {
        setItems([...items, { id: Math.random().toString(36).substr(2, 9), productId: "", detail: "", unitPrice: 0, quantity: 1, totalPkr: 0, discount: 0 }]);
    };

    const removeItem = (id: string) => {
        setItems(items.filter(item => item.id !== id));
    };

    const updateItem = (id: string, field: keyof InvoiceItem, value: any) => {
        setItems(items.map(item => {
            if (item.id === id) {
                const updated = { ...item, [field]: value };
                if (field === "unitPrice" || field === "quantity") {
                    const isXlserp = flatProducts.find((p: any) => p.id === item.productId)?.name === 'Xlserp - Free Website';
                    updated.totalPkr = isXlserp ? (Number(updated.quantity) / 90) * (25600 / 280) : Number(updated.unitPrice) * Number(updated.quantity);
                }
                return updated;
            }
            return item;
        }));
    };
    const [finalInvoiceNumber, setFinalInvoiceNumber] = useState<string>("");

    const createInvoiceMutation = useMutation({
        mutationFn: async (payload: any) => {
            const res = await apiRequest("POST", "/api/account/invoices", payload);
            return res.json();
        },
        onSuccess: (data: any, variables: any) => {
            toast({ title: "Invoice Created", description: "The invoice has been saved successfully." });
            setLastSavedInvoice(data.data || data);
            setFinalInvoiceNumber(data?.data?.invoiceNumber || data?.data?.invoice_number || data?.invoiceNumber || data?.invoice_number || variables.invoiceNumber);
            setShowReceipt(true);
        },
        onError: (err: Error) => {
            toast({ title: "Error", description: err.message, variant: "destructive" });
        }
    });

    const updateInvoiceMutation = useMutation({
        mutationFn: async ({ id, payload }: { id: string, payload: any }) => {
            const { invoiceNumber, ...updatePayload } = payload;
            const res = await apiRequest("PATCH", `/api/account/invoices/${id}`, updatePayload);
            return res.json();
        },
        onSuccess: (data: any, variables: any) => {
            toast({ title: "Invoice Updated", description: "The invoice has been updated successfully." });
            setLastSavedInvoice(data.data || data);
            setFinalInvoiceNumber(data?.data?.invoiceNumber || data?.data?.invoice_number || data?.invoiceNumber || data?.invoice_number || variables.payload.invoiceNumber);
            setShowReceipt(true);
        },
        onError: (err: Error) => {
            toast({ title: "Error", description: err.message, variant: "destructive" });
        }
    });

    const handleSave = () => {
        if (!customer) {
            toast({ title: "No customer", description: "Please wait for customer data to load.", variant: "destructive" });
            return;
        }
        const payload = {
            customerId: customer.id,
            customerName: customer.accountName || customer.companyName,
            customerEmail: customer.email,
            items: JSON.stringify(items),
            subtotal: subAmount.toString(),
            tax: ((subAmount * gstPercent) / 100).toString(),
            total: grandTotal.toString(),
            status: "Pending",
            invoiceNumber: invoiceInfo?.invoiceNumber || `INV-${Math.floor(Math.random() * 100000)}`,
        };
        
        if (lastSavedInvoice?.id) {
            updateInvoiceMutation.mutate({ id: lastSavedInvoice.id, payload });
        } else {
            createInvoiceMutation.mutate(payload);
        }
    };

    const handlePrint = useReactToPrint({
        contentRef: receiptRef,
        documentTitle: `Invoice_${customer?.accountName || "Guest"}`,
    });

    const handleDownload = async () => {
        if (!receiptRef.current) return;
        
        try {
            const element = receiptRef.current;
            
            // Allow browser to apply layout before capturing
            await new Promise(resolve => setTimeout(resolve, 100));
            
            const canvas = await html2canvas(element, {
                scale: 2,
                useCORS: true,
                logging: false,
                windowWidth: 800
            });

            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF({
                orientation: 'portrait',
                unit: 'mm',
                format: 'a4'
            });

            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

            pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
            pdf.save(`Invoice_${customer?.accountName || "Guest"}.pdf`);
        } catch (error) {
            console.error("Error generating PDF:", error);
            toast({ title: "Error", description: "Failed to generate PDF.", variant: "destructive" });
        }
    };

    if (!canCreateInvoice) {
        return (
            <div className="flex flex-col items-center justify-center h-screen bg-slate-50 dark:bg-zinc-900 space-y-4">
                <div className="p-4 bg-red-100 text-red-700 rounded-full dark:bg-red-900/30 dark:text-red-400">
                    <Trash2 className="w-8 h-8" />
                </div>
                <h2 className="text-2xl font-bold text-slate-800 dark:text-zinc-100">Access Denied</h2>
                <p className="text-slate-500 dark:text-zinc-400">Only Sales Executives are authorized to create invoices.</p>
                <Button variant="outline" onClick={() => window.history.back()}>Go Back</Button>
            </div>
        );
    }

    if (isLoadingCustomer) {
        return (
            <div className="flex items-center justify-center h-full">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
        );
    }

    if (!customerId) {
        return (
            <div className="flex flex-col items-center justify-center h-screen bg-slate-50 dark:bg-zinc-900 space-y-4">
                <h2 className="text-2xl font-bold text-slate-800 dark:text-zinc-100">Invalid invoice link</h2>
                <p className="text-slate-500 dark:text-zinc-400">No customer was specified for this invoice.</p>
                <Button variant="outline" onClick={() => setLocation("/sales/customers")}>Go to Customers</Button>
            </div>
        );
    }

    if (isCustomerError || !customer) {
        return (
            <div className="flex flex-col items-center justify-center h-screen bg-slate-50 dark:bg-zinc-900 space-y-4">
                <h2 className="text-2xl font-bold text-slate-800 dark:text-zinc-100">Customer not found</h2>
                <p className="text-slate-500 dark:text-zinc-400">We couldn't load the customer for this invoice. They may have been removed.</p>
                <Button variant="outline" onClick={() => setLocation("/sales/customers")}>Go to Customers</Button>
            </div>
        );
    }

    const now = new Date();
    const formattedDate = format(now, "dd-MM-yyyy hh:mm a");

    return (
        <div className="p-6 space-y-6 bg-[#f8f9fc] min-h-full dark:bg-zinc-900">
            <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-[#00a65a] dark:text-zinc-400">Invoice</h1>
                <span className="text-xl font-bold text-[#00a65a] dark:text-zinc-400">{formattedDate}</span>
            </div>

            <Card className="border-none shadow-sm rounded-lg overflow-hidden">
                <CardContent className="p-6 space-y-8">
                    {/* Header Fields */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                        <div className="space-y-2">
                            <Label className="text-sm font-medium text-slate-600 dark:text-zinc-300">Account Holder</Label>
                            <Input
                                value={customer?.accountName || ""}
                                readOnly
                                className="bg-white border-slate-200 h-11 focus:ring-emerald-500 dark:bg-zinc-900 dark:border-zinc-800"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-sm font-medium text-slate-600 dark:text-zinc-300">Company</Label>
                            <Input
                                value={customer?.companyName || ""}
                                readOnly
                                className="bg-white border-slate-200 h-11 focus:ring-emerald-500 dark:bg-zinc-900 dark:border-zinc-800"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-sm font-medium text-slate-600 dark:text-zinc-300">Email</Label>
                            <Input
                                value={customer?.email || "null"}
                                readOnly
                                className="bg-white border-slate-200 h-11 focus:ring-emerald-500 dark:bg-zinc-900 dark:border-zinc-800"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-sm font-medium text-slate-600 dark:text-zinc-300">Contact</Label>
                            <Input
                                value={customer?.phone || ""}
                                readOnly
                                className="bg-white border-slate-200 h-11 focus:ring-emerald-500 dark:bg-zinc-900 dark:border-zinc-800"
                            />
                        </div>
                    </div>

                    {/* Items Table */}
                    <div className="space-y-4">
                        <div className="grid grid-cols-12 gap-4 border-b border-slate-100 pb-2 mb-2 font-semibold text-slate-700 text-sm dark:border-zinc-800 dark:text-zinc-400">
                            <div className="col-span-3">Product</div>
                            <div className="col-span-3 text-center">Detail</div>
                            <div className="col-span-1 text-center">Unit Price</div>
                            <div className="col-span-1 text-center">Quantity</div>
                            <div className="col-span-1 text-center">Total Pkr</div>
                            <div className="col-span-1 text-center">Discount</div>
                            <div className="col-span-2 text-center">Action</div>
                        </div>

                        {items.map((item, idx) => (
                            <div key={item.id} className="grid grid-cols-12 gap-4 items-center animate-in fade-in slide-in-from-top-1 duration-200">
                                <div className="col-span-3">
                                    <ProductCombobox 
                                        item={item} 
                                        products={products} 
                                        flatProducts={flatProducts} 
                                        updateItemProduct={(itemId: string, productId: string, selectedProduct: any) => {
                                            setItems(items.map(it => {
                                                if (it.id === itemId) {
                                                    const quantity = selectedProduct ? Number(selectedProduct.price || 0) : (it.quantity > 0 ? it.quantity : 1);
                                                    const unitPrice = 1;
                                                    return {
                                                        ...it,
                                                        productId,
                                                        detail: selectedProduct ? (selectedProduct.description !== null && selectedProduct.description !== undefined ? selectedProduct.description : "") : "",
                                                        unitPrice,
                                                        quantity,
                                                        totalPkr: isNaN(unitPrice * quantity) ? 0 : (selectedProduct?.name === 'Xlserp - Free Website' ? (quantity / 90) * (25600 / 280) : unitPrice * quantity)
                                                    };
                                                }
                                                return it;
                                            }));
                                        }} 
                                    />
                                </div>
                                <div className="col-span-3 text-center">
                                    <Input
                                        value={item.detail}
                                        onChange={(e) => updateItem(item.id, "detail", e.target.value)}
                                        className="bg-white border-slate-200 h-11 focus:ring-emerald-500 dark:bg-zinc-900 dark:border-zinc-800"
                                    />
                                </div>
                                <div className="col-span-1 text-center">
                                    <Input
                                        type="number"
                                        value={item.unitPrice}
                                        onChange={(e) => updateItem(item.id, "unitPrice", parseFloat(e.target.value) || 0)}
                                        className="bg-white border-slate-200 h-11 focus:ring-emerald-500 text-center dark:bg-zinc-900 dark:border-zinc-800"
                                    />
                                </div>
                                <div className="col-span-1 text-center">
                                    <Input
                                        type="number"
                                        value={item.quantity}
                                        onChange={(e) => updateItem(item.id, "quantity", parseInt(e.target.value) || 0)}
                                        className="bg-white border-slate-200 h-11 focus:ring-emerald-500 text-center dark:bg-zinc-900 dark:border-zinc-800"
                                    />
                                </div>
                                <div className="col-span-1 text-center">
                                    <Input
                                        value={Math.round(item.totalPkr * 280)}
                                        readOnly
                                        className="bg-slate-50 border-slate-200 h-11 text-center font-medium dark:bg-zinc-900 dark:border-zinc-800"
                                    />
                                </div>
                                <div className="col-span-1 text-center">
                                    <Input
                                        type="number"
                                        value={item.discount}
                                        onChange={(e) => updateItem(item.id, "discount", parseFloat(e.target.value) || 0)}
                                        className="bg-white border-slate-200 h-11 focus:ring-emerald-500 text-center dark:bg-zinc-900 dark:border-zinc-800"
                                    />
                                </div>
                                <div className="col-span-2 flex justify-center gap-2">
                                    <Button
                                        variant="destructive"
                                        size="sm"
                                        className="bg-emerald-600 hover:bg-emerald-700 h-11 px-6 font-bold"
                                        onClick={() => removeItem(item.id)}
                                    >
                                        Delete
                                    </Button>
                                </div>
                            </div>
                        ))}

                        <Button
                            variant="outline"
                            size="sm"
                            onClick={addItem}
                            className="mt-2 border-dashed border-2 border-slate-300 text-slate-500 hover:border-emerald-500 hover:text-emerald-500 hover:bg-emerald-50 transition-all dark:text-zinc-400 dark:border-zinc-800"
                        >
                            + Add Product
                        </Button>
                    </div>

                    {/* Totals Section */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8 pt-8 border-t border-slate-100 dark:border-zinc-800">
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <Label className="text-sm font-bold text-slate-700 dark:text-zinc-400">Sub Amount</Label>
                                <Input
                                    value={subAmount.toFixed(2)}
                                    readOnly
                                    className="bg-white border-slate-200 h-11 dark:bg-zinc-900 dark:border-zinc-800"
                                />
                            </div>
                            <div className="flex items-center gap-6 pt-2">
                                <span className="text-sm font-bold text-slate-700 whitespace-nowrap dark:text-zinc-400">Pkr Discount</span>
                                <div className="flex items-center gap-4">
                                    <div className="flex items-center space-x-2">
                                        <Checkbox
                                            id="in-percent"
                                            checked={discountType === "percentage"}
                                            onCheckedChange={() => setDiscountType("percentage")}
                                        />
                                        <label htmlFor="in-percent" className="text-xs font-medium text-slate-500 cursor-pointer dark:text-zinc-400">In Percentage</label>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                        <Checkbox
                                            id="in-amount"
                                            checked={discountType === "amount"}
                                            onCheckedChange={() => setDiscountType("amount")}
                                        />
                                        <label htmlFor="in-amount" className="text-xs font-medium text-slate-500 cursor-pointer dark:text-zinc-400">In Amount</label>
                                    </div>
                                </div>
                            </div>
                            <Input
                                type="number"
                                value={pkrDiscountValue}
                                onChange={(e) => setPkrDiscountValue(parseFloat(e.target.value) || 0)}
                                className="bg-[#f0f4f8] border-none h-11 dark:bg-zinc-900"
                                placeholder="..."
                            />
                        </div>

                        <div className="space-y-4">
                            <div className="space-y-2">
                                <Label className="text-sm font-bold text-slate-700 dark:text-zinc-400">GST %</Label>
                                <Input
                                    type="number"
                                    value={gstPercent}
                                    onChange={(e) => setGstPercent(parseFloat(e.target.value) || 0)}
                                    className="bg-white border-slate-200 h-11 focus:ring-emerald-500 dark:bg-zinc-900 dark:border-zinc-800"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-sm font-bold text-slate-700 dark:text-zinc-400">$Grand Total</Label>
                                <Input
                                    value={grandTotal.toFixed(2)}
                                    readOnly
                                    className="bg-white border-slate-200 h-11 font-bold text-lg dark:bg-zinc-900 dark:border-zinc-800"
                                />
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div className="space-y-2">
                                <Label className="text-sm font-bold text-slate-700 dark:text-zinc-400">Total Amount</Label>
                                <Input
                                    value={totalAmount.toFixed(2)}
                                    readOnly
                                    className="bg-white border-slate-200 h-11 dark:bg-zinc-900 dark:border-zinc-800"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label className="text-sm font-bold text-slate-700 dark:text-zinc-400">Pkr Amount</Label>
                                <Input
                                    value={pkrAmount.toFixed(2)}
                                    readOnly
                                    className="bg-white border-slate-200 h-11 dark:bg-zinc-900 dark:border-zinc-800"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center gap-2 pt-6 print:hidden">
                        <Button
                            className="bg-[#00a65a] hover:bg-[#008d4c] text-white px-8 h-12 font-bold text-lg rounded-md transition-all active:scale-95"
                            onClick={handleSave}
                            disabled={createInvoiceMutation.isPending || updateInvoiceMutation.isPending}
                        >
                            {(createInvoiceMutation.isPending || updateInvoiceMutation.isPending) ? "Saving..." : "Save Change"}
                        </Button>
                        <Button
                            variant="outline"
                            className="bg-white hover:bg-slate-50 text-slate-700 border-slate-200 px-8 h-12 font-bold text-lg rounded-md transition-all active:scale-95 dark:bg-zinc-900 dark:hover:bg-zinc-800 dark:border-zinc-800 dark:text-zinc-400"
                            onClick={handlePrint}
                        >
                            Print Slip
                        </Button>
                        <Button
                            variant="outline"
                            className="bg-white hover:bg-slate-50 text-slate-700 border-slate-200 px-8 h-12 font-bold text-lg rounded-md transition-all active:scale-95 dark:bg-zinc-900 dark:hover:bg-zinc-800 dark:border-zinc-800 dark:text-zinc-400"
                            onClick={handleDownload}
                        >
                            Download PDF
                        </Button>
                        <Button
                            variant="secondary"
                            className="bg-[#00a65a] hover:bg-[#008d4c] text-white px-8 h-12 font-bold text-lg rounded-md transition-all active:scale-95"
                            onClick={() => setItems([{ id: Math.random().toString(36).substr(2, 9), productId: "", detail: "", unitPrice: 0.5, quantity: 1, totalPkr: 0.5, discount: 0 }])}
                        >
                            Reset
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {/* Old print slip removed */}

            {/* Hidden component for html2canvas to capture */}
            <div 
                style={{ 
                    position: "absolute", 
                    left: "-9999px", 
                    top: "-9999px"
                }}
            >
                <div ref={receiptRef} style={{ width: "800px", padding: "20px" }}>
                <InvoiceReceipt
                    invoiceData={{
                        invoiceNumber: finalInvoiceNumber || lastSavedInvoice?.invoiceNumber || lastSavedInvoice?.invoice_number || (lastSavedInvoice?.id ? `INV-${String(lastSavedInvoice.id).slice(0, 6).toUpperCase()}` : null) || invoiceInfo?.invoiceNumber || "DRAFT",
                        date: new Date(),
                        from: {
                            name: "Web Excels",
                            whatsapp: "+92-334-8086611",
                            phone: "+92-52-4271592",
                            email: "Support@Webexcels.com",
                            address: "Al-Amin Center, Paris Rd, Opposite The Sialkot Chamber Of Commerce, Sialkot 51310 Pakistan"
                        },
                        to: {
                            name: customer?.accountName || customer?.companyName || "N/A",
                            phone: customer?.phone || "N/A",
                            email: customer?.email || "N/A",
                            address: "..."
                        },
                        items: items.map(item => ({
                            name: products.find((p: any) => p.id === item.productId)?.name || "Service",
                            detail: item.detail,
                            price: item.unitPrice,
                            quantity: item.quantity,
                            total: item.totalPkr
                        })),
                        subTotalUsd: subAmount,
                        subTotalPkr: Math.round(subAmount * 280),
                        taxUsd: (subAmount * gstPercent) / 100,
                        discountPkr: Math.round((totalAmount - grandTotal) * 280),
                        totalPkr: Math.round(grandTotal * 280)
                    }}
                    hideButtons={true}
                />
                </div>
            </div>

            {/* Receipt Modal */}
            <Dialog open={showReceipt} onOpenChange={setShowReceipt}>
                <DialogContent className="max-w-4xl p-0 h-auto max-h-[90vh] overflow-y-auto bg-white border-none shadow-2xl dark:bg-zinc-900">
                    <DialogTitle className="sr-only">Invoice Receipt</DialogTitle>
                    {lastSavedInvoice && (
                        <div className="p-0">
                            <InvoiceReceipt
                                invoiceData={{
                                    invoiceNumber: finalInvoiceNumber || lastSavedInvoice?.invoiceNumber || lastSavedInvoice?.invoice_number || (lastSavedInvoice?.id ? `INV-${String(lastSavedInvoice.id).slice(0, 6).toUpperCase()}` : null) || invoiceInfo?.invoiceNumber || "DRAFT",
                                    date: new Date(),
                                    from: {
                                        name: "Web Excels",
                                        whatsapp: "+92-334-8086611",
                                        phone: "+92-52-4271592",
                                        email: "Support@Webexcels.com",
                                        address: "Al-Amin Center, Paris Rd, Opposite The Sialkot Chamber Of Commerce, Sialkot 51310 Pakistan"
                                    },
                                    to: {
                                        name: customer?.accountName || customer?.companyName || "N/A",
                                        phone: customer?.phone || "N/A",
                                        email: customer?.email || "N/A",
                                        address: "..."
                                    },
                                    items: items.map(item => ({
                                        name: products.find((p: any) => p.id === item.productId)?.name || "Service",
                                        detail: item.detail,
                                        price: item.unitPrice,
                                        quantity: item.quantity,
                                        total: item.totalPkr
                                    })),
                                    subTotalUsd: subAmount,
                                    subTotalPkr: Math.round(subAmount * 280),
                                    taxUsd: (subAmount * gstPercent) / 100,
                                    discountPkr: Math.round((totalAmount - grandTotal) * 280),
                                    totalPkr: Math.round(grandTotal * 280)
                                }}
                                onClose={() => {
                                    setShowReceipt(false);
                                    setLocation("/customers/private-pool");
                                }}
                            />
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div >
    );
}
