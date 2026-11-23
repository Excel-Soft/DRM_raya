
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest, mutationRequest } from "@/lib/queryClient";
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
import { Trash2, Plus } from "lucide-react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { ServiceCatalogTree } from "@/components/service-catalog-tree";
import { QaAttributeTree } from "@/components/qa-attribute-tree";
import { BuyerDetailTree } from "@/components/buyer-detail-tree";
import { DepartmentsManager } from "@/components/departments-manager";
import { CompanyBusinessTypeTree } from "@/components/company-business-type-tree";
import { LegacyAttributeTree } from "@/components/legacy-attribute-tree";

const ATTRIBUTE_CATEGORIES = [
    "Company Detail",
    "Company Business Type",
    "Service Type",
    "RC Link",
    "Source",
    "Job Designation",
    "Q & A",
    "Service for Quotation",
    "Whatsapp Message",
    "Contact Attribute",
    "Donation Head",
    "Penalty Head",
    "Company Branch",
    "Country",
    "Govt Leave",
    "Account Monthly Task",
    "Buyer Detail",
    "Portfolio Categories",
    "Alibaba Packages",
    "Departments",
];

function attributeNameColumnLabel(category: string): string {
    const labels: Record<string, string> = {
        "Company Detail": "Business Type",
        "Company Business Type": "Category",
        "Service Type": "Role Title",
        "RC Link": "Role Title",
        Source: "Source Name",
        "Job Designation": "Designation",
        "Q & A": "Question / Answer",
        "Whatsapp Message": "Message",
        "Contact Attribute": "Contact Method",
        "Donation Head": "Donation Head",
        "Penalty Head": "Penalty Head",
        "Company Branch": "Branch Name",
        Country: "Country",
        "Govt Leave": "Leave Title",
        "Account Monthly Task": "Task Name",
        "Buyer Detail": "Buyer",
        "Portfolio Categories": "Category Name",
        "Alibaba Packages": "Package Name",
        Departments: "Department",
    };
    return labels[category] ?? "Name";
}

export default function AttributesPage() {
    // ?category=<name> opens that section directly (e.g. the old /drm/branches link -> Company Branch).
    const [selectedCategory, setSelectedCategory] = useState(() => {
        const fromUrl = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("category") : null;
        return (ATTRIBUTE_CATEGORIES as readonly string[]).includes(fromUrl ?? "")
            ? (fromUrl as (typeof ATTRIBUTE_CATEGORIES)[number])
            : ATTRIBUTE_CATEGORIES[0];
    });
    const [isAddOpen, setIsAddOpen] = useState(false);
    const [newItemName, setNewItemName] = useState("");
    const [newItemAmount, setNewItemAmount] = useState("");
    const [newItemDateLabel, setNewItemDateLabel] = useState("");
    const [newItemBranch, setNewItemBranch] = useState("");
    const { toast } = useToast();
    const queryClient = useQueryClient();

    // "Service for Quotation" is a real 3-level hierarchy (services ->
    // service_subservices -> service_sub_subservices) with its own CRUD API
    // and its own tree UI — nothing about the generic single-field
    // attributes list/dialog applies here, so it renders entirely separately.
    const isServiceCategory = selectedCategory === "Service for Quotation";
    // "Q & A" uses the same generic attributes table/endpoints as every other
    // category, but with the new self-referencing parentId column to model
    // question -> answer(s) — its own tree UI handles fetching/rendering.
    const isQaCategory = selectedCategory === "Q & A";
    // "Penalty Head" is still the plain generic attributes list, but each
    // row also carries a default deduction amount — the only category that
    // uses the attributes.amount column today.
    const isPenaltyCategory = selectedCategory === "Penalty Head";
    // "Govt Leave" rows carry a recurring "DD Mon" date alongside the name.
    const isGovtLeaveCategory = selectedCategory === "Govt Leave";
    // "Account Monthly Task" rows carry both a branch and a recurring
    // day-of-month date alongside the name.
    const isAccountTaskCategory = selectedCategory === "Account Monthly Task";
    // "Buyer Detail" is a genuine 2-level tree (buyer -> reference contacts,
    // each with optional email/phone) — its own tree UI handles fetching/rendering.
    const isBuyerDetailCategory = selectedCategory === "Buyer Detail";
    // "Departments" is a thin view over the real, dedicated drm.departments
    // table (full CRUD with code/sortOrder/isActive lives at
    // /api/drm/departments) — same "single source of truth" reasoning as
    // Company Branch above. It also needs an Edit affordance the generic
    // add/delete list below doesn't have, so it gets its own component.
    const isDepartmentCategory = selectedCategory === "Departments";
    const isCompanyBusinessTypeCategory = selectedCategory === "Company Business Type";
    const isAlibabaPackagesCategory = selectedCategory === "Alibaba Packages";
    const isPortfolioCategoriesCategory = selectedCategory === "Portfolio Categories";
    const extraColumnCount = (isPenaltyCategory ? 1 : 0) + (isGovtLeaveCategory ? 1 : 0) + (isAccountTaskCategory ? 2 : 0);
    const nameColumnLabel = attributeNameColumnLabel(selectedCategory);

    // Fetch attributes for selected category (Service for Quotation / Q & A /
    // Buyer Detail / Departments manage their own fetching entirely inside their own components).
    const { data: attributes = [], isLoading } = useQuery({
        queryKey: ["/api/attributes", selectedCategory],
        queryFn: async () => {
            const res = await apiRequest("GET", `/api/attributes/${encodeURIComponent(selectedCategory)}`);
            return res.json();
        },
        enabled:
            !isServiceCategory &&
            !isQaCategory &&
            !isBuyerDetailCategory &&
            !isDepartmentCategory &&
            !isCompanyBusinessTypeCategory &&
            !isAlibabaPackagesCategory &&
            !isPortfolioCategoriesCategory,
    });

    // Add mutation — mutationRequest throws on non-2xx so 401/403 messages
    // (e.g. "You are not authorized to manage attributes.") surface honestly.
    const addMutation = useMutation({
        mutationFn: async (input: { name: string; amount?: string; dateLabel?: string; branch?: string }) =>
            mutationRequest("POST", "/api/attributes", {
                    category: selectedCategory,
                    name: input.name,
                    ...(isPenaltyCategory && input.amount ? { amount: input.amount } : {}),
                    ...((isGovtLeaveCategory || isAccountTaskCategory) && input.dateLabel ? { dateLabel: input.dateLabel } : {}),
                    ...(isAccountTaskCategory && input.branch ? { branch: input.branch } : {}),
                }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/attributes", selectedCategory] });
            setNewItemName("");
            setNewItemAmount("");
            setNewItemDateLabel("");
            setNewItemBranch("");
            setIsAddOpen(false);
            toast({ title: "Success", description: "Item added successfully" });
        },
        onError: (error: Error) => {
            toast({ title: "Error", description: error.message || "Failed to add item", variant: "destructive" });
        },
    });

    // Delete mutation
    const deleteMutation = useMutation({
        mutationFn: async (id: string) => {
            await mutationRequest("DELETE", `/api/attributes/${id}`);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/attributes", selectedCategory] });
            toast({ title: "Success", description: "Item deleted successfully" });
        },
        onError: (error: Error) => {
            toast({ title: "Error", description: error.message || "Failed to delete item", variant: "destructive" });
        },
    });

    const handleAdd = () => {
        if (!newItemName.trim()) return;
        addMutation.mutate({
            name: newItemName,
            amount: newItemAmount.trim(),
            dateLabel: newItemDateLabel.trim(),
            branch: newItemBranch.trim(),
        });
    };

    return (
        <div className="flex bg-slate-50 min-h-screen dark:bg-zinc-950">
            {/* Sidebar */}
            <div className="w-64 bg-white border-r border-slate-200 h-full min-h-screen p-4 space-y-1 dark:bg-zinc-950 dark:border-zinc-800">
                <h2 className="text-sm font-bold text-slate-500 uppercase mb-4 px-3 dark:text-zinc-400">Attribute</h2>
                {ATTRIBUTE_CATEGORIES.map((cat) => (
                    <button
                        key={cat}
                        onClick={() => setSelectedCategory(cat)}
                        className={`w-full text-left px-3 py-2 text-sm font-medium rounded-md transition-colors ${selectedCategory === cat
                                ? "bg-[#008d4c] text-white"
                                : "text-slate-600 dark:text-slate-300 hover:bg-slate-100"
                            }`}
                    >
                        {cat}
                    </button>
                ))}
            </div>

            {/* Main Content */}
            <div className="min-w-0 flex-1 p-8">
                {isServiceCategory ? (
                    <ServiceCatalogTree />
                ) : isQaCategory ? (
                    <QaAttributeTree />
                ) : isBuyerDetailCategory ? (
                    <BuyerDetailTree />
                ) : isDepartmentCategory ? (
                    <DepartmentsManager />
                ) : isCompanyBusinessTypeCategory ? (
                    <CompanyBusinessTypeTree />
                ) : isAlibabaPackagesCategory ? (
                    <LegacyAttributeTree
                        title="Alibaba Packages"
                        queryKey="/api/attributes/alibaba-packages/tree"
                        apiPath="/api/attributes/alibaba-packages/tree"
                    />
                ) : isPortfolioCategoriesCategory ? (
                    <LegacyAttributeTree
                        title="Portfolio Categories"
                        queryKey="/api/attributes/portfolio-categories/tree"
                        apiPath="/api/attributes/portfolio-categories/tree"
                    />
                ) : (
                    <>
                        <div className="flex items-center justify-between mb-6">
                            {/* Add Button */}
                            <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
                                <DialogTrigger asChild>
                                    <Button className="bg-[#008d4c] hover:bg-[#00733e] text-white">
                                        <Plus className="w-4 h-4 mr-2" />
                                        Add New {selectedCategory}
                                    </Button>
                                </DialogTrigger>
                                <DialogContent>
                                    <DialogHeader>
                                        <DialogTitle>Add New {selectedCategory}</DialogTitle>
                                    </DialogHeader>
                                    <div className="space-y-4 py-4">
                                        <div className="space-y-2">
                                            <Label>Name</Label>
                                            <Input
                                                placeholder="Enter name..."
                                                value={newItemName}
                                                onChange={(e) => setNewItemName(e.target.value)}
                                            />
                                        </div>
                                        {isPenaltyCategory && (
                                            <div className="space-y-2">
                                                <Label>Amount</Label>
                                                <Input
                                                    type="number"
                                                    placeholder="Enter amount..."
                                                    value={newItemAmount}
                                                    onChange={(e) => setNewItemAmount(e.target.value)}
                                                />
                                            </div>
                                        )}
                                        {isAccountTaskCategory && (
                                            <div className="space-y-2">
                                                <Label>Branch</Label>
                                                <Input
                                                    placeholder="Enter branch..."
                                                    value={newItemBranch}
                                                    onChange={(e) => setNewItemBranch(e.target.value)}
                                                />
                                            </div>
                                        )}
                                        {(isGovtLeaveCategory || isAccountTaskCategory) && (
                                            <div className="space-y-2">
                                                <Label>Date</Label>
                                                <Input
                                                    placeholder={isGovtLeaveCategory ? "e.g. 01 May" : "e.g. 15"}
                                                    value={newItemDateLabel}
                                                    onChange={(e) => setNewItemDateLabel(e.target.value)}
                                                />
                                            </div>
                                        )}
                                        <Button
                                            onClick={handleAdd}
                                            className="w-full bg-[#008d4c] hover:bg-[#00733e]"
                                            disabled={addMutation.isPending}
                                        >
                                            {addMutation.isPending ? "Adding..." : "Add Item"}
                                        </Button>
                                    </div>
                                </DialogContent>
                            </Dialog>
                        </div>

                        <Card className="w-full border-t-4 border-t-[#008d4c] shadow-sm">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-lg font-bold text-slate-700 dark:text-zinc-400">{selectedCategory}</CardTitle>
                            </CardHeader>
                            <CardContent className="p-0">
                                <Table className="w-full">
                                    <TableHeader className="bg-slate-50 dark:bg-zinc-900">
                                        <TableRow>
                                            <TableHead className="min-w-[200px] font-semibold text-slate-700 dark:text-zinc-400">
                                                {nameColumnLabel}
                                            </TableHead>
                                            {isAccountTaskCategory && (
                                                <TableHead className="w-28 whitespace-nowrap font-semibold text-slate-700 dark:text-zinc-400">Branch</TableHead>
                                            )}
                                            {(isGovtLeaveCategory || isAccountTaskCategory) && (
                                                <TableHead className="w-32 whitespace-nowrap font-semibold text-slate-700 dark:text-zinc-400">Date</TableHead>
                                            )}
                                            {isPenaltyCategory && (
                                                <TableHead className="w-24 whitespace-nowrap font-semibold text-slate-700 dark:text-zinc-400">Amount</TableHead>
                                            )}
                                            <TableHead className="w-20 shrink-0 text-center font-semibold text-slate-700 dark:text-zinc-400">Action</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {isLoading ? (
                                            <TableRow>
                                                <TableCell colSpan={2 + extraColumnCount} className="text-center py-8">Loading...</TableCell>
                                            </TableRow>
                                        ) : attributes.length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={2 + extraColumnCount} className="text-center py-8 text-muted-foreground">
                                                    No items found. Add one above.
                                                </TableCell>
                                            </TableRow>
                                        ) : (
                                            attributes.map((item: any) => (
                                                <TableRow key={item.id}>
                                                    <TableCell className="font-medium text-slate-700 dark:text-zinc-400 whitespace-normal break-words align-top">
                                                        {item.name}
                                                    </TableCell>
                                                    {isAccountTaskCategory && (
                                                        <TableCell className="text-slate-600 dark:text-zinc-400">{item.branch ?? "-"}</TableCell>
                                                    )}
                                                    {(isGovtLeaveCategory || isAccountTaskCategory) && (
                                                        <TableCell className="text-red-500 font-medium">{item.dateLabel ?? "-"}</TableCell>
                                                    )}
                                                    {isPenaltyCategory && (
                                                        <TableCell className="text-red-500 font-medium">{item.amount ?? "-"}</TableCell>
                                                    )}
                                                    <TableCell className="text-center">
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50"
                                                            onClick={() => {
                                                                const msg = item.legacyReadOnly
                                                                    ? "Delete this legacy row from the archive? This matches old DRM behavior."
                                                                    : "Are you sure?";
                                                                if (confirm(msg)) deleteMutation.mutate(item.id);
                                                            }}
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </Button>
                                                    </TableCell>
                                                </TableRow>
                                            ))
                                        )}
                                    </TableBody>
                                </Table>
                            </CardContent>
                        </Card>
                    </>
                )}
            </div>
        </div>
    );
}
