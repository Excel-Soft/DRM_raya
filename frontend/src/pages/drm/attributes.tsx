
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
    "Others",
    "Exporter & Manufacturer"
];

export default function AttributesPage() {
    const [selectedCategory, setSelectedCategory] = useState(ATTRIBUTE_CATEGORIES[0]);
    const [isAddOpen, setIsAddOpen] = useState(false);
    const [newItemName, setNewItemName] = useState("");
    const { toast } = useToast();
    const queryClient = useQueryClient();

    // "Company Branch" is not a generic attributes bucket — it's a thin view
    // over the real, dedicated drm.branches table (full CRUD with code/sortOrder/
    // isActive already lives at /drm/branches) so this list and that page never
    // drift into two different sources of truth for the same "office" concept.
    const isBranchCategory = selectedCategory === "Company Branch";
    // "Service for Quotation" is a real 3-level hierarchy (services ->
    // service_subservices -> service_sub_subservices) with its own CRUD API
    // and its own tree UI — nothing about the generic single-field
    // attributes list/dialog applies here, so it renders entirely separately.
    const isServiceCategory = selectedCategory === "Service for Quotation";

    // Fetch attributes for selected category (Service for Quotation manages
    // its own fetching entirely inside <ServiceCatalogTree />).
    const { data: attributes = [], isLoading } = useQuery({
        queryKey: isBranchCategory ? ["/api/drm/branches", "all"] : ["/api/attributes", selectedCategory],
        queryFn: async () => {
            if (isBranchCategory) {
                const res = await apiRequest("GET", "/api/drm/branches?includeInactive=true");
                const body = await res.json();
                return (body.data ?? []).map((b: any) => ({ id: b.id, name: b.name }));
            }
            const res = await apiRequest("GET", `/api/attributes/${encodeURIComponent(selectedCategory)}`);
            return res.json();
        },
        enabled: !isServiceCategory,
    });

    // Add mutation — mutationRequest throws on non-2xx so 401/403 messages
    // (e.g. "You are not authorized to manage attributes.") surface honestly.
    const addMutation = useMutation({
        mutationFn: async (name: string) =>
            isBranchCategory
                ? mutationRequest("POST", "/api/drm/branches", { name })
                : mutationRequest("POST", "/api/attributes", {
                    category: selectedCategory,
                    name,
                }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: isBranchCategory ? ["/api/drm/branches"] : ["/api/attributes", selectedCategory] });
            setNewItemName("");
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
            await mutationRequest("DELETE", isBranchCategory ? `/api/drm/branches/${id}` : `/api/attributes/${id}`);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: isBranchCategory ? ["/api/drm/branches"] : ["/api/attributes", selectedCategory] });
            toast({ title: "Success", description: "Item deleted successfully" });
        },
        onError: (error: Error) => {
            toast({ title: "Error", description: error.message || "Failed to delete item", variant: "destructive" });
        },
    });

    const handleAdd = () => {
        if (!newItemName.trim()) return;
        addMutation.mutate(newItemName);
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
            <div className="flex-1 p-8">
                {isServiceCategory ? (
                    <ServiceCatalogTree />
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

                        <Card className="border-t-4 border-t-[#008d4c] shadow-sm">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-lg font-bold text-slate-700 dark:text-zinc-400">{selectedCategory}</CardTitle>
                            </CardHeader>
                            <CardContent className="p-0">
                                <Table>
                                    <TableHeader className="bg-slate-50 dark:bg-zinc-900">
                                        <TableRow>
                                            <TableHead className="font-semibold text-slate-700 w-full dark:text-zinc-400">Role Title</TableHead>
                                            <TableHead className="font-semibold text-slate-700 w-20 text-center dark:text-zinc-400">Action</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {isLoading ? (
                                            <TableRow>
                                                <TableCell colSpan={2} className="text-center py-8">Loading...</TableCell>
                                            </TableRow>
                                        ) : attributes.length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={2} className="text-center py-8 text-muted-foreground">
                                                    No items found. Add one above.
                                                </TableCell>
                                            </TableRow>
                                        ) : (
                                            attributes.map((item: any) => (
                                                <TableRow key={item.id}>
                                                    <TableCell className="font-medium text-slate-700 dark:text-zinc-400">{item.name}</TableCell>
                                                    <TableCell className="text-center">
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50"
                                                            onClick={() => {
                                                                if (confirm("Are you sure?")) deleteMutation.mutate(item.id);
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
