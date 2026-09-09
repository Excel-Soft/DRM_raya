import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Search, Plus, Trash2, Edit } from "lucide-react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";

export default function RelatedCustomerPage() {
    const [activeTab, setActiveTab] = useState("related");
    const [searchTerm, setSearchTerm] = useState("");
    const [isAddOpen, setIsAddOpen] = useState(false);
    const [isEditMode, setIsEditMode] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);

    // Related Customers state
    const [relatedForm, setRelatedForm] = useState({
        customerName: "",
        relatedCustomer: "",
        personName: "",
        followStatus: "",
        invoiceNumber: "",
        receiptNumber: "",
        packageType: "",
        gmAmount: "",
        payDate: "",
        bvDate: "",
        isDisabled: false,
    });

    // ADD GM state
    const [gmForm, setGmForm] = useState({
        companyName: "",
        companyId: "",
        memberId: "",
        orderId: "",
        packageId: "basic",
        packageName: "Basic",
        pkrAmount: "",
        dollarRate: "",
        alibabaDiscount: "0",
        paymentStatus: "Paid",
        type: "New",
        dropout: "",
        extension: "",
        detail: "",
        payDate: "",
        bvDate: "",
    });

    const [companySearch, setCompanySearch] = useState("");
    const [showCompanySuggestions, setShowCompanySuggestions] = useState(false);

    const { toast } = useToast();
    const queryClient = useQueryClient();

    // Fetch GM packages
    const { data: packagesData } = useQuery({
        queryKey: ["/api/gm-packages"],
        queryFn: async () => {
            const res = await apiRequest("GET", "/api/gm-packages");
            return res.json();
        },
    });

    const packages = packagesData?.packages || [];

    // Search companies
    const { data: companySuggestions = [] } = useQuery({
        queryKey: ["/api/customers/search", companySearch],
        queryFn: async () => {
            if (!companySearch || companySearch.length < 2) return [];
            const res = await apiRequest("GET", `/api/customers/search?q=${encodeURIComponent(companySearch)}&limit=10`);
            const data = await res.json();
            return data.customers || [];
        },
        enabled: companySearch.length >= 2,
    });

    // Fetch related customers
    const { data: relatedCustomers = [], isLoading: loadingRelated } = useQuery({
        queryKey: ["/api/crm/related-customers"],
        queryFn: async () => {
            const res = await apiRequest("GET", "/api/crm/related-customers");
            return res.json();
        },
    });

    // Add related customer mutation
    const addRelatedMutation = useMutation({
        mutationFn: async (data: any) => {
            const res = await apiRequest("POST", "/api/crm/related-customers", data);
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/crm/related-customers"] });
            setRelatedForm({
                customerName: "",
                relatedCustomer: "",
                personName: "",
                followStatus: "",
                invoiceNumber: "",
                receiptNumber: "",
                packageType: "",
                gmAmount: "",
                payDate: "",
                bvDate: "",
                isDisabled: false,
            });
            setIsAddOpen(false);
            setIsEditMode(false);
            setEditingId(null);
            toast({ title: "Success", description: isEditMode ? "Related customer updated successfully" : "Related customer added successfully" });
        },
        onError: () => {
            toast({ title: "Error", description: isEditMode ? "Failed to update related customer" : "Failed to add related customer", variant: "destructive" });
        },
    });

    // Update related customer mutation
    const updateRelatedMutation = useMutation({
        mutationFn: async ({ id, data }: { id: string; data: any }) => {
            const res = await apiRequest("PUT", `/api/crm/related-customers/${id}`, data);
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/crm/related-customers"] });
            setRelatedForm({
                customerName: "",
                relatedCustomer: "",
                personName: "",
                followStatus: "",
                invoiceNumber: "",
                receiptNumber: "",
                packageType: "",
                gmAmount: "",
                payDate: "",
                bvDate: "",
                isDisabled: false,
            });
            setIsAddOpen(false);
            setIsEditMode(false);
            setEditingId(null);
            toast({ title: "Success", description: "Related customer updated successfully" });
        },
        onError: () => {
            toast({ title: "Error", description: "Failed to update related customer", variant: "destructive" });
        },
    });

    // Delete related customer mutation
    const deleteRelatedMutation = useMutation({
        mutationFn: async (id: string) => {
            await apiRequest("DELETE", `/api/crm/related-customers/${id}`);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/crm/related-customers"] });
            toast({ title: "Success", description: "Related customer deleted successfully" });
        },
        onError: () => {
            toast({ title: "Error", description: "Failed to delete related customer", variant: "destructive" });
        },
    });

    // Add GM mutation
    const addGmMutation = useMutation({
        mutationFn: async (data: any) => {
            const res = await apiRequest("POST", "/api/gm", data);
            return res.json();
        },
        onSuccess: () => {
            setGmForm({
                companyName: "",
                companyId: "",
                memberId: "",
                orderId: "",
                packageId: "basic",
                packageName: "Basic",
                pkrAmount: "",
                dollarRate: "",
                alibabaDiscount: "0",
                paymentStatus: "Paid",
                type: "New",
                dropout: "",
                extension: "",
                detail: "",
                payDate: "",
                bvDate: "",
            });
            setCompanySearch("");
            toast({ title: "Success", description: "GM entry added successfully" });
        },
        onError: (error: any) => {
            const message = error?.details?.[0]?.message || "Failed to add GM entry";
            toast({ title: "Error", description: message, variant: "destructive" });
        },
    });

    const handleAddRelated = () => {
        if (!relatedForm.customerName.trim() || !relatedForm.relatedCustomer.trim()) {
            toast({ title: "Error", description: "Please fill in all required fields", variant: "destructive" });
            return;
        }

        if (isEditMode && editingId) {
            updateRelatedMutation.mutate({ id: editingId, data: relatedForm });
        } else {
            addRelatedMutation.mutate(relatedForm);
        }
    };

    const handleEditRelated = (item: any) => {
        setRelatedForm({
            customerName: item.customerName || "",
            relatedCustomer: item.relatedCustomer || "",
            personName: item.personName || "",
            followStatus: item.followStatus || "",
            invoiceNumber: item.invoiceNumber || "",
            receiptNumber: item.receiptNumber || "",
            packageType: item.packageType || "",
            gmAmount: item.gmAmount || "",
            payDate: item.payDate || "",
            bvDate: item.bvDate || "",
            isDisabled: item.isDisabled || false,
        });
        setEditingId(item.id);
        setIsEditMode(true);
        setIsAddOpen(true);
    };

    const handleAddGm = () => {
        if (!gmForm.companyName || !gmForm.memberId || !gmForm.orderId || !gmForm.pkrAmount || !gmForm.dollarRate) {
            toast({ title: "Error", description: "Please fill in all required fields", variant: "destructive" });
            return;
        }

        const selectedPackage = packages.find((p: any) => p.id === gmForm.packageId);

        addGmMutation.mutate({
            companyId: gmForm.companyId || null,
            companyName: gmForm.companyName,
            memberId: gmForm.memberId,
            orderId: gmForm.orderId,
            packageId: gmForm.packageId,
            packageName: selectedPackage?.name || gmForm.packageName,
            pkrAmount: parseFloat(gmForm.pkrAmount),
            dollarRate: parseFloat(gmForm.dollarRate),
            alibabaDiscount: parseFloat(gmForm.alibabaDiscount) || 0,
            paymentStatus: gmForm.paymentStatus,
            type: gmForm.type,
            dropout: gmForm.dropout || null,
            extension: gmForm.extension || null,
            detail: gmForm.detail || null,
            loanMode: "none",
        });
    };

    const filteredCustomers = relatedCustomers.filter((customer: any) =>
        customer.customerName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        customer.relatedCustomer?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        customer.personName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        customer.invoiceNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        customer.receiptNumber?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="p-8 space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 dark:text-zinc-100">Related Customers / Add GM</h1>
                    <p className="text-muted-foreground">Manage customer relationships and GM entries</p>
                </div>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="grid w-full grid-cols-2 max-w-md">
                    <TabsTrigger value="related">RELATED CUSTOMERS</TabsTrigger>
                    <TabsTrigger value="gm">ADD GM</TabsTrigger>
                </TabsList>

                <TabsContent value="related" className="mt-6">
                    <Card className="border-t-4 border-t-[#008d4c] shadow-sm">
                        <CardHeader className="pb-4">
                            <div className="flex items-center justify-between">
                                <CardTitle className="text-lg font-bold text-slate-700 dark:text-zinc-400">Customer Relationships</CardTitle>
                                <div className="flex gap-3">
                                    <div className="relative w-64">
                                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                                        <Input
                                            placeholder="Search customers..."
                                            value={searchTerm}
                                            onChange={(e) => setSearchTerm(e.target.value)}
                                            className="pl-9"
                                        />
                                    </div>
                                    <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
                                        <DialogTrigger asChild>
                                            <Button className="bg-[#008d4c] hover:bg-[#00733e] text-white">
                                                <Plus className="w-4 h-4 mr-2" />
                                                Add
                                            </Button>
                                        </DialogTrigger>
                                        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                                            <DialogHeader>
                                                <DialogTitle>{isEditMode ? "Edit Related Customer" : "Add Related Customer"}</DialogTitle>
                                            </DialogHeader>
                                            <div className="grid grid-cols-2 gap-4 py-4">
                                                <div className="space-y-2">
                                                    <Label>Company <span className="text-red-500">*</span></Label>
                                                    <Input
                                                        placeholder="Enter company name..."
                                                        value={relatedForm.customerName}
                                                        onChange={(e) => setRelatedForm({ ...relatedForm, customerName: e.target.value })}
                                                    />
                                                </div>
                                                <div className="space-y-2">
                                                    <Label>Company Status</Label>
                                                    <Select
                                                        value={relatedForm.isDisabled ? "disabled" : "active"}
                                                        onValueChange={(val) => setRelatedForm({ ...relatedForm, isDisabled: val === "disabled" })}
                                                    >
                                                        <SelectTrigger>
                                                            <SelectValue />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            <SelectItem value="active">Active</SelectItem>
                                                            <SelectItem value="disabled">Disabled</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                                <div className="space-y-2">
                                                    <Label>Person</Label>
                                                    <Input
                                                        placeholder="Enter person name..."
                                                        value={relatedForm.personName}
                                                        onChange={(e) => setRelatedForm({ ...relatedForm, personName: e.target.value })}
                                                    />
                                                </div>
                                                <div className="space-y-2">
                                                    <Label>Related Customer <span className="text-red-500">*</span></Label>
                                                    <Input
                                                        placeholder="Enter related customer..."
                                                        value={relatedForm.relatedCustomer}
                                                        onChange={(e) => setRelatedForm({ ...relatedForm, relatedCustomer: e.target.value })}
                                                    />
                                                </div>
                                                <div className="space-y-2">
                                                    <Label>Follow</Label>
                                                    <Input
                                                        placeholder="Follow status..."
                                                        value={relatedForm.followStatus}
                                                        onChange={(e) => setRelatedForm({ ...relatedForm, followStatus: e.target.value })}
                                                    />
                                                </div>
                                                <div className="space-y-2">
                                                    <Label>Invoice</Label>
                                                    <Input
                                                        placeholder="Invoice number..."
                                                        value={relatedForm.invoiceNumber}
                                                        onChange={(e) => setRelatedForm({ ...relatedForm, invoiceNumber: e.target.value })}
                                                    />
                                                </div>
                                                <div className="space-y-2">
                                                    <Label>Receipt</Label>
                                                    <Input
                                                        placeholder="Receipt number..."
                                                        value={relatedForm.receiptNumber}
                                                        onChange={(e) => setRelatedForm({ ...relatedForm, receiptNumber: e.target.value })}
                                                    />
                                                </div>
                                                <div className="space-y-2">
                                                    <Label>Package</Label>
                                                    <Input
                                                        placeholder="Package type..."
                                                        value={relatedForm.packageType}
                                                        onChange={(e) => setRelatedForm({ ...relatedForm, packageType: e.target.value })}
                                                    />
                                                </div>
                                                <div className="space-y-2">
                                                    <Label>Gm</Label>
                                                    <Input
                                                        type="number"
                                                        placeholder="GM amount..."
                                                        value={relatedForm.gmAmount}
                                                        onChange={(e) => setRelatedForm({ ...relatedForm, gmAmount: e.target.value })}
                                                    />
                                                </div>
                                                <div className="space-y-2">
                                                    <Label>Pay Date</Label>
                                                    <Input
                                                        type="date"
                                                        value={relatedForm.payDate}
                                                        onChange={(e) => setRelatedForm({ ...relatedForm, payDate: e.target.value })}
                                                    />
                                                </div>
                                                <div className="space-y-2">
                                                    <Label>Bv Date</Label>
                                                    <Input
                                                        type="date"
                                                        value={relatedForm.bvDate}
                                                        onChange={(e) => setRelatedForm({ ...relatedForm, bvDate: e.target.value })}
                                                    />
                                                </div>
                                                <div className="col-span-2">
                                                    <Button
                                                        onClick={handleAddRelated}
                                                        className="w-full bg-[#008d4c] hover:bg-[#00733e]"
                                                        disabled={addRelatedMutation.isPending}
                                                    >
                                                        {addRelatedMutation.isPending ? "Adding..." : "Add Relationship"}
                                                    </Button>
                                                </div>
                                            </div>
                                        </DialogContent>
                                    </Dialog>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="p-0">
                            <Table>
                                <TableHeader className="bg-slate-50 dark:bg-zinc-900">
                                    <TableRow>
                                        <TableHead className="font-semibold text-slate-700 dark:text-zinc-400">No</TableHead>
                                        <TableHead className="font-semibold text-slate-700 dark:text-zinc-400">Company</TableHead>
                                        <TableHead className="font-semibold text-slate-700 dark:text-zinc-400">Person</TableHead>
                                        <TableHead className="font-semibold text-slate-700 dark:text-zinc-400">Follow</TableHead>
                                        <TableHead className="font-semibold text-slate-700 dark:text-zinc-400">Invoice</TableHead>
                                        <TableHead className="font-semibold text-slate-700 dark:text-zinc-400">Receipt</TableHead>
                                        <TableHead className="font-semibold text-slate-700 dark:text-zinc-400">Package</TableHead>
                                        <TableHead className="font-semibold text-slate-700 dark:text-zinc-400">Gm</TableHead>
                                        <TableHead className="font-semibold text-slate-700 dark:text-zinc-400">Pay</TableHead>
                                        <TableHead className="font-semibold text-slate-700 dark:text-zinc-400">Bv</TableHead>
                                        <TableHead className="font-semibold text-slate-700 text-center dark:text-zinc-400">Action</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {loadingRelated ? (
                                        <TableRow>
                                            <TableCell colSpan={11} className="text-center py-8">
                                                Loading...
                                            </TableCell>
                                        </TableRow>
                                    ) : filteredCustomers.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={11} className="text-center py-8 text-muted-foreground">
                                                {searchTerm ? "No customers found matching your search." : "No related customers yet."}
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        filteredCustomers.map((item: any, index: number) => (
                                            <TableRow key={item.id}>
                                                <TableCell className="font-medium text-slate-700 dark:text-zinc-400">{index + 1}</TableCell>
                                                <TableCell className="font-medium text-slate-700 dark:text-zinc-400">{item.customerName}</TableCell>
                                                <TableCell className="text-slate-700 dark:text-zinc-400">{item.personName || '-'}</TableCell>
                                                <TableCell className="text-slate-700 dark:text-zinc-400">{item.followStatus || '-'}</TableCell>
                                                <TableCell className="text-slate-700 dark:text-zinc-400">{item.invoiceNumber || '-'}</TableCell>
                                                <TableCell className="text-slate-700 dark:text-zinc-400">{item.receiptNumber || '-'}</TableCell>
                                                <TableCell className="text-slate-700 dark:text-zinc-400">{item.packageType || '-'}</TableCell>
                                                <TableCell className="text-slate-700 dark:text-zinc-400">{item.gmAmount ? `$${item.gmAmount}` : '-'}</TableCell>
                                                <TableCell className="text-slate-700 dark:text-zinc-400">{item.payDate || '-'}</TableCell>
                                                <TableCell className="text-slate-700 dark:text-zinc-400">{item.bvDate || '-'}</TableCell>
                                                <TableCell className="text-center">
                                                    <div className="flex items-center justify-center gap-1">
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            className="h-8 w-8 text-green-600 hover:text-green-700 hover:bg-green-50"
                                                            onClick={() => handleEditRelated(item)}
                                                        >
                                                            <Edit className="w-4 h-4" />
                                                        </Button>
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50"
                                                            onClick={() => {
                                                                if (confirm("Are you sure?")) {
                                                                    deleteRelatedMutation.mutate(item.id);
                                                                }
                                                            }}
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </Button>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="gm" className="mt-6">
                    <Card className="border-t-4 border-t-[#008d4c] shadow-sm">
                        <CardHeader>
                            <CardTitle className="text-lg font-bold text-slate-700 dark:text-zinc-400">Add GM Entry</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-2 gap-6">
                                {/* Row 1 */}
                                <div className="space-y-2 relative">
                                    <Label>Company Name <span className="text-red-500">*</span></Label>
                                    <Input
                                        placeholder="Search Company Through Id/Name"
                                        value={companySearch}
                                        onChange={(e) => {
                                            setCompanySearch(e.target.value);
                                            setShowCompanySuggestions(true);
                                        }}
                                        onFocus={() => setShowCompanySuggestions(true)}
                                        onBlur={() => {
                                            // Delay to allow click on suggestion
                                            setTimeout(() => setShowCompanySuggestions(false), 200);
                                        }}
                                    />
                                    {showCompanySuggestions && companySuggestions.length > 0 && (
                                        <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-auto dark:bg-zinc-900 dark:border-zinc-800">
                                            {companySuggestions.map((company: any) => (
                                                <div
                                                    key={company.id}
                                                    className="px-4 py-2 cursor-pointer hover:bg-[#008d4c] hover:text-white transition-colors"
                                                    onClick={() => {
                                                        setGmForm({
                                                            ...gmForm,
                                                            companyName: company.companyName || company.accountName,
                                                            companyId: company.id
                                                        });
                                                        setCompanySearch(company.companyName || company.accountName);
                                                        setShowCompanySuggestions(false);
                                                    }}
                                                >
                                                    {company.companyName || company.accountName}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                    {gmForm.companyName && (
                                        <p className="text-sm text-muted-foreground mt-1">
                                            Selected: {gmForm.companyName}
                                        </p>
                                    )}
                                </div>
                                <div className="space-y-2">
                                    <Label>Package <span className="text-red-500">*</span></Label>
                                    <Select
                                        value={gmForm.packageId}
                                        onValueChange={(value) => {
                                            const pkg = packages.find((p: any) => p.id === value);
                                            setGmForm({
                                                ...gmForm,
                                                packageId: value,
                                                packageName: pkg?.name || value
                                            });
                                        }}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Choose..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {packages.map((pkg: any) => (
                                                <SelectItem key={pkg.id} value={pkg.id}>{pkg.name}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                {/* Row 2 */}
                                <div className="space-y-2">
                                    <Label>Payment Status <span className="text-red-500">*</span></Label>
                                    <Select
                                        value={gmForm.paymentStatus}
                                        onValueChange={(value) => setGmForm({ ...gmForm, paymentStatus: value })}
                                    >
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="Paid">Paid</SelectItem>
                                            <SelectItem value="Unpaid">Unpaid</SelectItem>
                                            <SelectItem value="Partial">Partial</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label>Type <span className="text-red-500">*</span></Label>
                                    <Select
                                        value={gmForm.type}
                                        onValueChange={(value) => setGmForm({ ...gmForm, type: value })}
                                    >
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="New">New</SelectItem>
                                            <SelectItem value="Renew">Renew</SelectItem>
                                            <SelectItem value="Upgrade">Upgrade</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                {/* Row 3 */}
                                <div className="space-y-2">
                                    <Label>Payment <span className="text-red-500">*</span></Label>
                                    <Input
                                        type="number"
                                        placeholder="payment in $"
                                        value={gmForm.pkrAmount}
                                        onChange={(e) => setGmForm({ ...gmForm, pkrAmount: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Pay Date</Label>
                                    <Input
                                        type="date"
                                        value={gmForm.payDate}
                                        onChange={(e) => setGmForm({ ...gmForm, payDate: e.target.value })}
                                    />
                                </div>

                                {/* Row 4 */}
                                <div className="space-y-2">
                                    <Label>BV Date</Label>
                                    <Input
                                        type="date"
                                        value={gmForm.bvDate}
                                        onChange={(e) => setGmForm({ ...gmForm, bvDate: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Dollar Rate <span className="text-red-500">*</span></Label>
                                    <Input
                                        type="number"
                                        placeholder="Enter dollar rate"
                                        value={gmForm.dollarRate}
                                        onChange={(e) => setGmForm({ ...gmForm, dollarRate: e.target.value })}
                                    />
                                </div>

                                {/* Row 5 */}
                                <div className="space-y-2">
                                    <Label>Member ID <span className="text-red-500">*</span></Label>
                                    <Input
                                        placeholder="Enter member ID"
                                        value={gmForm.memberId}
                                        onChange={(e) => setGmForm({ ...gmForm, memberId: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Order ID <span className="text-red-500">*</span></Label>
                                    <Input
                                        placeholder="Enter order ID"
                                        value={gmForm.orderId}
                                        onChange={(e) => setGmForm({ ...gmForm, orderId: e.target.value })}
                                    />
                                </div>

                                {/* Detail - Full Width */}
                                <div className="col-span-2 space-y-2">
                                    <Label>Detail</Label>
                                    <Textarea
                                        placeholder="add detail"
                                        value={gmForm.detail}
                                        onChange={(e) => setGmForm({ ...gmForm, detail: e.target.value })}
                                        rows={3}
                                    />
                                </div>

                                {/* Submit Button */}
                                <div className="col-span-2">
                                    <Button
                                        onClick={handleAddGm}
                                        className="bg-[#008d4c] hover:bg-[#00733e] text-white px-8"
                                        disabled={addGmMutation.isPending}
                                    >
                                        {addGmMutation.isPending ? "Submitting..." : "Submit"}
                                    </Button>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}
