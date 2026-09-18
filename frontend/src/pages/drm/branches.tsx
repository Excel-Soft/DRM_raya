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
import { Trash2, Plus, Pencil } from "lucide-react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface Branch {
    id: string;
    name: string;
    code: string | null;
    isActive: boolean;
    sortOrder: number;
}

interface PhysicalAsset {
    id: string;
    branchId: string | null;
}

const emptyForm = { name: "", code: "", sortOrder: "0", isActive: true };

export default function BranchesPage() {
    const { toast } = useToast();
    const queryClient = useQueryClient();

    const [dialogOpen, setDialogOpen] = useState(false);
    const [editingBranch, setEditingBranch] = useState<Branch | null>(null);
    const [form, setForm] = useState(emptyForm);
    const [activeTab, setActiveTab] = useState("all");

    const { data, isLoading } = useQuery<{ data: Branch[] }>({
        queryKey: ["/api/drm/branches", "all"],
        queryFn: async () => {
            const res = await apiRequest("GET", "/api/drm/branches?includeInactive=true");
            if (!res.ok) throw new Error("Failed to load branches");
            return res.json();
        },
    });
    const branches = data?.data ?? [];

    // Same "All Offices + per-branch count" tab strip as IT Asset Management —
    // counted from the real asset list (not the asset-inventory stats
    // endpoint, which only totals active branches) so an inactive branch
    // still shows its true asset count here.
    const { data: assetsRes } = useQuery<{ data: PhysicalAsset[] }>({
        queryKey: ["/api/it/asset-inventory"],
        queryFn: async () => {
            const res = await apiRequest("GET", "/api/it/asset-inventory");
            if (!res.ok) return { data: [] };
            return res.json();
        },
    });
    const assets = assetsRes?.data ?? [];
    const assetCountByBranch = new Map<string, number>();
    assets.forEach((a) => {
        if (!a.branchId) return;
        assetCountByBranch.set(a.branchId, (assetCountByBranch.get(a.branchId) ?? 0) + 1);
    });

    const visibleBranches = activeTab === "all" ? branches : branches.filter((b) => b.id === activeTab);

    const invalidate = () => {
        queryClient.invalidateQueries({ queryKey: ["/api/drm/branches"] });
    };

    const createMutation = useMutation({
        mutationFn: async () =>
            mutationRequest("POST", "/api/drm/branches", {
                name: form.name.trim(),
                code: form.code.trim() || null,
                sortOrder: Number(form.sortOrder) || 0,
                isActive: form.isActive,
            }),
        onSuccess: () => {
            invalidate();
            setDialogOpen(false);
            setForm(emptyForm);
            toast({ title: "Branch added" });
        },
        onError: (err: any) => toast({ title: "Error", description: err?.message || "Failed to add branch", variant: "destructive" }),
    });

    const updateMutation = useMutation({
        mutationFn: async () =>
            mutationRequest("PATCH", `/api/drm/branches/${editingBranch!.id}`, {
                name: form.name.trim(),
                code: form.code.trim() || null,
                sortOrder: Number(form.sortOrder) || 0,
                isActive: form.isActive,
            }),
        onSuccess: () => {
            invalidate();
            setDialogOpen(false);
            setEditingBranch(null);
            setForm(emptyForm);
            toast({ title: "Branch updated" });
        },
        onError: (err: any) => toast({ title: "Error", description: err?.message || "Failed to update branch", variant: "destructive" }),
    });

    const deleteMutation = useMutation({
        mutationFn: async (id: string) => mutationRequest("DELETE", `/api/drm/branches/${id}`),
        onSuccess: () => {
            invalidate();
            toast({ title: "Branch deleted" });
        },
        onError: (err: any) => toast({ title: "Error", description: err?.message || "Failed to delete branch", variant: "destructive" }),
    });

    const openAdd = () => {
        setEditingBranch(null);
        setForm(emptyForm);
        setDialogOpen(true);
    };

    const openEdit = (branch: Branch) => {
        setEditingBranch(branch);
        setForm({
            name: branch.name,
            code: branch.code || "",
            sortOrder: String(branch.sortOrder),
            isActive: branch.isActive,
        });
        setDialogOpen(true);
    };

    const handleSave = () => {
        if (!form.name.trim()) {
            toast({ title: "Name is required", variant: "destructive" });
            return;
        }
        if (editingBranch) updateMutation.mutate();
        else createMutation.mutate();
    };

    const isSaving = createMutation.isPending || updateMutation.isPending;

    return (
        <div className="p-8">
            <div className="flex items-center justify-between mb-6">
                <h1 className="text-xl font-bold text-slate-700 dark:text-zinc-300">Branches</h1>
                <Button onClick={openAdd} className="bg-[#008d4c] hover:bg-[#00733e] text-white">
                    <Plus className="w-4 h-4 mr-2" />
                    Add Branch
                </Button>
            </div>

            <Card className="border-t-4 border-t-[#008d4c] shadow-sm">
                <CardHeader className="pb-2">
                    <CardTitle className="text-lg font-bold text-slate-700 dark:text-zinc-400">Company Branches</CardTitle>
                    <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-4">
                        <TabsList className="flex-wrap h-auto">
                            <TabsTrigger value="all">All Offices ({assets.length})</TabsTrigger>
                            {branches.map((b) => (
                                <TabsTrigger key={b.id} value={b.id}>{b.name} ({assetCountByBranch.get(b.id) ?? 0})</TabsTrigger>
                            ))}
                        </TabsList>
                    </Tabs>
                </CardHeader>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader className="bg-slate-50 dark:bg-zinc-900">
                            <TableRow>
                                <TableHead className="font-semibold text-slate-700 dark:text-zinc-400">Name</TableHead>
                                <TableHead className="font-semibold text-slate-700 dark:text-zinc-400">Code</TableHead>
                                <TableHead className="font-semibold text-slate-700 text-center dark:text-zinc-400">Sort Order</TableHead>
                                <TableHead className="font-semibold text-slate-700 text-center dark:text-zinc-400">Status</TableHead>
                                <TableHead className="font-semibold text-slate-700 w-24 text-center dark:text-zinc-400">Action</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                <TableRow>
                                    <TableCell colSpan={5} className="text-center py-8">Loading...</TableCell>
                                </TableRow>
                            ) : visibleBranches.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                                        {branches.length === 0 ? "No branches yet. Add one above." : "No branch matches this tab."}
                                    </TableCell>
                                </TableRow>
                            ) : (
                                visibleBranches.map((branch) => (
                                    <TableRow key={branch.id}>
                                        <TableCell className="font-medium text-slate-700 dark:text-zinc-400">{branch.name}</TableCell>
                                        <TableCell className="text-slate-600 dark:text-zinc-300">{branch.code || "—"}</TableCell>
                                        <TableCell className="text-center text-slate-600 dark:text-zinc-300">{branch.sortOrder}</TableCell>
                                        <TableCell className="text-center">
                                            {branch.isActive ? (
                                                <Badge className="bg-green-100 text-green-800 border-green-200">Active</Badge>
                                            ) : (
                                                <Badge className="bg-slate-100 text-slate-600 border-slate-200">Inactive</Badge>
                                            )}
                                        </TableCell>
                                        <TableCell className="text-center">
                                            <div className="flex justify-center gap-1">
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="h-8 w-8 text-slate-500 hover:text-emerald-600"
                                                    onClick={() => openEdit(branch)}
                                                >
                                                    <Pencil className="w-4 h-4" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50"
                                                    onClick={() => {
                                                        if (confirm(`Delete branch "${branch.name}"?`)) deleteMutation.mutate(branch.id);
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

            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{editingBranch ? "Edit Branch" : "Add Branch"}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        <div className="space-y-2">
                            <Label>Name *</Label>
                            <Input
                                placeholder="e.g. Lahore-GulBerg"
                                value={form.name}
                                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Code</Label>
                            <Input
                                placeholder="Optional short code"
                                value={form.code}
                                onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Sort Order</Label>
                            <Input
                                type="number"
                                value={form.sortOrder}
                                onChange={(e) => setForm((f) => ({ ...f, sortOrder: e.target.value }))}
                            />
                        </div>
                        <div className="flex items-center justify-between">
                            <Label>Active</Label>
                            <Switch
                                checked={form.isActive}
                                onCheckedChange={(v) => setForm((f) => ({ ...f, isActive: v }))}
                            />
                        </div>
                        <Button
                            onClick={handleSave}
                            className="w-full bg-[#008d4c] hover:bg-[#00733e]"
                            disabled={isSaving}
                        >
                            {isSaving ? "Saving..." : editingBranch ? "Save Changes" : "Add Branch"}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
