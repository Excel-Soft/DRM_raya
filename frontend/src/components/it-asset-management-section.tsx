import { useMemo, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest, mutationRequest, getAuthHeader } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Upload, Download, Pencil, Trash2 } from "lucide-react";

const ASSET_TYPES = ["Laptop", "Mobile", "LED", "Desktop", "Tablet", "Other"] as const;
const ASSET_CONDITIONS = ["In Use", "In Custody", "Damaged"] as const;
const PROJECT_TYPES = ["New Project", "Renewal"] as const;

const CSV_HEADERS = [
    "No#", "Asset", "Make/Model", "Colour", "Purchase Date", "Warranty", "Warranty Period",
    "Purchased Condition", "Current Condition", "Emp. Code", "Issued Status", "Employee Name",
    "Office", "Specification", "Asset Owned By", "Mobile Phone", "IT Manager Remarks",
] as const;

interface Branch {
    id: string;
    name: string;
    isActive: boolean;
}

interface AssetStats {
    overview: { totalAssets: number; inUse: number; inCustody: number; damaged: number };
    distribution: Array<{ assetType: string; count: number }>;
    branches: Array<{ branchId: string; branchName: string; count: number }>;
    allOfficesCount: number;
    projectTypes: { newProject: number; renewal: number };
}

interface PhysicalAsset {
    id: string;
    assetType: string;
    projectType: string | null;
    makeModel: string | null;
    colour: string | null;
    purchaseDate: string | null;
    warranty: string | null;
    warrantyPeriod: string | null;
    purchasedCondition: string | null;
    currentCondition: string;
    empCode: string | null;
    issuedStatus: string | null;
    employeeName: string | null;
    branchId: string | null;
    branchName: string | null;
    specification: string | null;
    assetOwnedBy: string | null;
    mobilePhone: string | null;
    itManagerRemarks: string | null;
}

const emptyForm = {
    assetType: "Laptop" as string,
    projectType: "" as string,
    makeModel: "", colour: "", purchaseDate: "", warranty: "", warrantyPeriod: "",
    purchasedCondition: "", currentCondition: "In Custody" as string, empCode: "",
    issuedStatus: "", employeeName: "", branchId: "", specification: "",
    assetOwnedBy: "", mobilePhone: "", itManagerRemarks: "",
};

export function ItAssetManagementSection() {
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [activeBranchTab, setActiveBranchTab] = useState("all");
    const [assetTypeFilter, setAssetTypeFilter] = useState("all");
    const [conditionFilter, setConditionFilter] = useState("all");
    const [searchTerm, setSearchTerm] = useState("");
    const [pageSize, setPageSize] = useState(10);
    const [page, setPage] = useState(1);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [importOpen, setImportOpen] = useState(false);
    const [importFile, setImportFile] = useState<File | null>(null);
    const [importing, setImporting] = useState(false);
    const [editingAsset, setEditingAsset] = useState<PhysicalAsset | null>(null);
    const [form, setForm] = useState(emptyForm);

    const { data: branchesRes } = useQuery<{ data: Branch[] }>({
        queryKey: ["/api/drm/branches"],
        queryFn: async () => {
            const res = await apiRequest("GET", "/api/drm/branches");
            if (!res.ok) throw new Error("Failed to load branches");
            return res.json();
        },
    });
    const branches = (branchesRes?.data ?? []).filter((b) => b.isActive);

    const { data: statsRes } = useQuery<{ data: AssetStats }>({
        queryKey: ["/api/it/asset-inventory/stats"],
        queryFn: async () => {
            const res = await apiRequest("GET", "/api/it/asset-inventory/stats");
            if (!res.ok) throw new Error("Failed to load asset stats");
            return res.json();
        },
    });
    const stats = statsRes?.data;

    const assetFilters = {
        branchId: activeBranchTab === "all" ? undefined : activeBranchTab,
        assetType: assetTypeFilter === "all" ? undefined : assetTypeFilter,
        condition: conditionFilter === "all" ? undefined : conditionFilter,
    };

    const { data: assetsRes, isLoading } = useQuery<{ data: PhysicalAsset[] }>({
        queryKey: ["/api/it/asset-inventory", assetFilters],
        queryFn: async () => {
            const params = new URLSearchParams();
            if (assetFilters.branchId) params.set("branchId", assetFilters.branchId);
            if (assetFilters.assetType) params.set("assetType", assetFilters.assetType);
            if (assetFilters.condition) params.set("condition", assetFilters.condition);
            const res = await apiRequest("GET", `/api/it/asset-inventory?${params.toString()}`);
            if (!res.ok) throw new Error("Failed to load assets");
            return res.json();
        },
    });
    const allAssets = assetsRes?.data ?? [];

    const filteredAssets = useMemo(() => {
        if (!searchTerm.trim()) return allAssets;
        const q = searchTerm.trim().toLowerCase();
        return allAssets.filter((a) =>
            [a.assetType, a.makeModel, a.colour, a.empCode, a.employeeName, a.branchName, a.specification, a.assetOwnedBy]
                .some((v) => (v || "").toLowerCase().includes(q)),
        );
    }, [allAssets, searchTerm]);

    const pagedAssets = filteredAssets.slice((page - 1) * pageSize, page * pageSize);
    const totalPages = Math.max(1, Math.ceil(filteredAssets.length / pageSize));

    const invalidateAll = () => {
        queryClient.invalidateQueries({ queryKey: ["/api/it/asset-inventory"] });
        queryClient.invalidateQueries({ queryKey: ["/api/it/asset-inventory/stats"] });
    };

    const createMutation = useMutation({
        mutationFn: async () => mutationRequest("POST", "/api/it/asset-inventory", buildPayload()),
        onSuccess: () => {
            invalidateAll();
            setDialogOpen(false);
            setForm(emptyForm);
            toast({ title: "Asset added" });
        },
        onError: (err: any) => toast({ title: "Error", description: err?.message || "Failed to add asset", variant: "destructive" }),
    });

    const updateMutation = useMutation({
        mutationFn: async () => mutationRequest("PATCH", `/api/it/asset-inventory/${editingAsset!.id}`, buildPayload()),
        onSuccess: () => {
            invalidateAll();
            setDialogOpen(false);
            setEditingAsset(null);
            setForm(emptyForm);
            toast({ title: "Asset updated" });
        },
        onError: (err: any) => toast({ title: "Error", description: err?.message || "Failed to update asset", variant: "destructive" }),
    });

    const deleteMutation = useMutation({
        mutationFn: async (id: string) => mutationRequest("DELETE", `/api/it/asset-inventory/${id}`),
        onSuccess: () => {
            invalidateAll();
            toast({ title: "Asset deleted" });
        },
        onError: (err: any) => toast({ title: "Error", description: err?.message || "Failed to delete asset", variant: "destructive" }),
    });

    function buildPayload() {
        return {
            assetType: form.assetType,
            projectType: form.projectType || null,
            makeModel: form.makeModel || null,
            colour: form.colour || null,
            purchaseDate: form.purchaseDate || null,
            warranty: form.warranty || null,
            warrantyPeriod: form.warrantyPeriod || null,
            purchasedCondition: form.purchasedCondition || null,
            currentCondition: form.currentCondition,
            empCode: form.empCode || null,
            issuedStatus: form.issuedStatus || null,
            employeeName: form.employeeName || null,
            branchId: form.branchId || null,
            specification: form.specification || null,
            assetOwnedBy: form.assetOwnedBy || null,
            mobilePhone: form.mobilePhone || null,
            itManagerRemarks: form.itManagerRemarks || null,
        };
    }

    const openAdd = () => {
        setEditingAsset(null);
        setForm(emptyForm);
        setDialogOpen(true);
    };

    const openEdit = (asset: PhysicalAsset) => {
        setEditingAsset(asset);
        setForm({
            assetType: asset.assetType,
            projectType: asset.projectType || "",
            makeModel: asset.makeModel || "",
            colour: asset.colour || "",
            purchaseDate: asset.purchaseDate ? asset.purchaseDate.slice(0, 10) : "",
            warranty: asset.warranty || "",
            warrantyPeriod: asset.warrantyPeriod || "",
            purchasedCondition: asset.purchasedCondition || "",
            currentCondition: asset.currentCondition,
            empCode: asset.empCode || "",
            issuedStatus: asset.issuedStatus || "",
            employeeName: asset.employeeName || "",
            branchId: asset.branchId || "",
            specification: asset.specification || "",
            assetOwnedBy: asset.assetOwnedBy || "",
            mobilePhone: asset.mobilePhone || "",
            itManagerRemarks: asset.itManagerRemarks || "",
        });
        setDialogOpen(true);
    };

    const handleSave = () => {
        if (!form.assetType) {
            toast({ title: "Asset type is required", variant: "destructive" });
            return;
        }
        if (editingAsset) updateMutation.mutate();
        else createMutation.mutate();
    };

    const exportToCSV = () => {
        const rows = filteredAssets.map((a, idx) => ({
            "No#": idx + 1,
            "Asset": a.assetType,
            "Make/Model": a.makeModel || "",
            "Colour": a.colour || "",
            "Purchase Date": a.purchaseDate ? a.purchaseDate.slice(0, 10) : "",
            "Warranty": a.warranty || "",
            "Warranty Period": a.warrantyPeriod || "",
            "Purchased Condition": a.purchasedCondition || "",
            "Current Condition": a.currentCondition || "",
            "Emp. Code": a.empCode || "",
            "Issued Status": a.issuedStatus || "",
            "Employee Name": a.employeeName || "",
            "Office": a.branchName || "",
            "Specification": a.specification || "",
            "Asset Owned By": a.assetOwnedBy || "",
            "Mobile Phone": a.mobilePhone || "",
            "IT Manager Remarks": a.itManagerRemarks || "",
        }));
        const lines = [
            CSV_HEADERS.join(","),
            ...rows.map((row) =>
                CSV_HEADERS.map((h) => `"${String((row as any)[h] ?? "").replace(/"/g, '""')}"`).join(","),
            ),
        ];
        const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", "it-asset-inventory.csv");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    const handleImport = async () => {
        if (!importFile) return;
        setImporting(true);
        try {
            const fd = new FormData();
            fd.append("file", importFile);
            const res = await fetch("/api/it/asset-inventory/import", {
                method: "POST",
                headers: getAuthHeader(),
                credentials: "include",
                body: fd,
            });
            const body = await res.json();
            if (!res.ok) throw new Error(body?.error || "Import failed");
            invalidateAll();
            setImportOpen(false);
            setImportFile(null);
            const warnCount = body.warnings?.length || 0;
            const skipCount = body.skippedRows?.length || 0;
            toast({
                title: `Imported ${body.imported} asset(s)`,
                description: warnCount || skipCount ? `${warnCount} warning(s), ${skipCount} row(s) skipped` : undefined,
            });
        } catch (err: any) {
            toast({ title: "Import failed", description: err?.message, variant: "destructive" });
        } finally {
            setImporting(false);
        }
    };

    const isSaving = createMutation.isPending || updateMutation.isPending;

    return (
        <Card className="border-none shadow-sm">
            <CardHeader>
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <CardTitle className="text-lg font-bold text-slate-700 dark:text-zinc-300">IT Asset Management</CardTitle>
                    <div className="flex items-center gap-2">
                        <Button size="sm" onClick={openAdd} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                            <Plus className="h-4 w-4 mr-1.5" /> Add New Asset
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => setImportOpen(true)}>
                            <Upload className="h-4 w-4 mr-1.5" /> Import CSV
                        </Button>
                        <Button size="sm" variant="outline" onClick={exportToCSV}>
                            <Download className="h-4 w-4 mr-1.5" /> Export CSV
                        </Button>
                    </div>
                </div>

                <div className="flex flex-wrap gap-4 mt-4">
                    <div className="flex flex-col gap-1.5 w-56">
                        <Label className="text-xs text-muted-foreground">Filter by Asset Type</Label>
                        <Select value={assetTypeFilter} onValueChange={(v) => { setAssetTypeFilter(v); setPage(1); }}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Types</SelectItem>
                                {ASSET_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="flex flex-col gap-1.5 w-56">
                        <Label className="text-xs text-muted-foreground">Filter by Condition</Label>
                        <Select value={conditionFilter} onValueChange={(v) => { setConditionFilter(v); setPage(1); }}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Conditions</SelectItem>
                                {ASSET_CONDITIONS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                <Tabs value={activeBranchTab} onValueChange={(v) => { setActiveBranchTab(v); setPage(1); }} className="mt-4">
                    <TabsList className="flex-wrap h-auto">
                        <TabsTrigger value="all">All Offices ({stats?.allOfficesCount ?? 0})</TabsTrigger>
                        {(stats?.branches ?? []).map((b) => (
                            <TabsTrigger key={b.branchId} value={b.branchId}>{b.branchName} ({b.count})</TabsTrigger>
                        ))}
                    </TabsList>
                </Tabs>
            </CardHeader>
            <CardContent className="p-0">
                <div className="p-4 flex flex-wrap items-center justify-between gap-4 border-t border-b">
                    <div className="flex items-center gap-2">
                        <span className="text-sm text-slate-500 dark:text-zinc-400">Show</span>
                        <Select value={String(pageSize)} onValueChange={(v) => { setPageSize(Number(v)); setPage(1); }}>
                            <SelectTrigger className="h-8 w-20"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                {[10, 25, 50, 100].map((n) => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}
                            </SelectContent>
                        </Select>
                        <span className="text-sm text-slate-500 dark:text-zinc-400">entries</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-sm text-slate-500 dark:text-zinc-400">Search:</span>
                        <Input
                            className="h-9 w-56"
                            value={searchTerm}
                            onChange={(e) => { setSearchTerm(e.target.value); setPage(1); }}
                        />
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <Table>
                        <TableHeader className="bg-slate-50/80 dark:bg-zinc-900/80">
                            <TableRow>
                                <TableHead>No#</TableHead>
                                <TableHead>Asset</TableHead>
                                <TableHead>Project Type</TableHead>
                                <TableHead>Make/Model</TableHead>
                                <TableHead>Colour</TableHead>
                                <TableHead>Purchase Date</TableHead>
                                <TableHead>Warranty</TableHead>
                                <TableHead>Warranty Period</TableHead>
                                <TableHead>Purchased Condition</TableHead>
                                <TableHead>Current Condition</TableHead>
                                <TableHead>Emp. Code</TableHead>
                                <TableHead>Issued Status</TableHead>
                                <TableHead>Employee Name</TableHead>
                                <TableHead>Office</TableHead>
                                <TableHead>Specification</TableHead>
                                <TableHead>Asset Owned By</TableHead>
                                <TableHead>Mobile Phone</TableHead>
                                <TableHead>IT Manager Remarks</TableHead>
                                <TableHead className="text-right">Action</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                <TableRow><TableCell colSpan={19} className="text-center py-8">Loading...</TableCell></TableRow>
                            ) : pagedAssets.length === 0 ? (
                                <TableRow><TableCell colSpan={19} className="text-center py-8 text-muted-foreground">No assets found.</TableCell></TableRow>
                            ) : (
                                pagedAssets.map((a, idx) => (
                                    <TableRow key={a.id}>
                                        <TableCell>{(page - 1) * pageSize + idx + 1}</TableCell>
                                        <TableCell className="font-medium">{a.assetType}</TableCell>
                                        <TableCell>{a.projectType || "—"}</TableCell>
                                        <TableCell>{a.makeModel || "—"}</TableCell>
                                        <TableCell>{a.colour || "—"}</TableCell>
                                        <TableCell>{a.purchaseDate ? a.purchaseDate.slice(0, 10) : "—"}</TableCell>
                                        <TableCell>{a.warranty || "—"}</TableCell>
                                        <TableCell>{a.warrantyPeriod || "—"}</TableCell>
                                        <TableCell>{a.purchasedCondition || "—"}</TableCell>
                                        <TableCell>{a.currentCondition}</TableCell>
                                        <TableCell>{a.empCode || "—"}</TableCell>
                                        <TableCell>{a.issuedStatus || "—"}</TableCell>
                                        <TableCell>{a.employeeName || "—"}</TableCell>
                                        <TableCell>{a.branchName || "—"}</TableCell>
                                        <TableCell className="max-w-[160px] truncate">{a.specification || "—"}</TableCell>
                                        <TableCell>{a.assetOwnedBy || "—"}</TableCell>
                                        <TableCell>{a.mobilePhone || "—"}</TableCell>
                                        <TableCell className="max-w-[160px] truncate">{a.itManagerRemarks || "—"}</TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex justify-end gap-1">
                                                <Button variant="ghost" size="sm" className="h-8 w-8 text-slate-500 hover:text-emerald-600" onClick={() => openEdit(a)}>
                                                    <Pencil className="w-4 h-4" />
                                                </Button>
                                                <Button
                                                    variant="ghost" size="sm" className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50"
                                                    onClick={() => { if (confirm("Delete this asset?")) deleteMutation.mutate(a.id); }}
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
                </div>

                <div className="flex items-center justify-between p-4">
                    <span className="text-sm text-muted-foreground">
                        Page {page} of {totalPages} · {filteredAssets.length} total
                    </span>
                    <div className="flex gap-2">
                        <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>Prev</Button>
                        <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>Next</Button>
                    </div>
                </div>
            </CardContent>

            {/* Add/Edit Dialog */}
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>{editingAsset ? "Edit Asset" : "Add New Asset"}</DialogTitle>
                    </DialogHeader>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-2">
                        <div className="space-y-1.5">
                            <Label>Asset Type *</Label>
                            <Select value={form.assetType} onValueChange={(v) => setForm((f) => ({ ...f, assetType: v }))}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    {ASSET_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1.5">
                            <Label>Current Condition</Label>
                            <Select value={form.currentCondition} onValueChange={(v) => setForm((f) => ({ ...f, currentCondition: v }))}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    {ASSET_CONDITIONS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1.5">
                            <Label>Project Type</Label>
                            <Select value={form.projectType || "none"} onValueChange={(v) => setForm((f) => ({ ...f, projectType: v === "none" ? "" : v }))}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="none">Unassigned</SelectItem>
                                    {PROJECT_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1.5">
                            <Label>Make/Model</Label>
                            <Input value={form.makeModel} onChange={(e) => setForm((f) => ({ ...f, makeModel: e.target.value }))} />
                        </div>
                        <div className="space-y-1.5">
                            <Label>Colour</Label>
                            <Input value={form.colour} onChange={(e) => setForm((f) => ({ ...f, colour: e.target.value }))} />
                        </div>
                        <div className="space-y-1.5">
                            <Label>Purchase Date</Label>
                            <Input type="date" value={form.purchaseDate} onChange={(e) => setForm((f) => ({ ...f, purchaseDate: e.target.value }))} />
                        </div>
                        <div className="space-y-1.5">
                            <Label>Warranty</Label>
                            <Input value={form.warranty} onChange={(e) => setForm((f) => ({ ...f, warranty: e.target.value }))} placeholder="Yes / No" />
                        </div>
                        <div className="space-y-1.5">
                            <Label>Warranty Period</Label>
                            <Input value={form.warrantyPeriod} onChange={(e) => setForm((f) => ({ ...f, warrantyPeriod: e.target.value }))} />
                        </div>
                        <div className="space-y-1.5">
                            <Label>Purchased Condition</Label>
                            <Input value={form.purchasedCondition} onChange={(e) => setForm((f) => ({ ...f, purchasedCondition: e.target.value }))} />
                        </div>
                        <div className="space-y-1.5">
                            <Label>Emp. Code</Label>
                            <Input value={form.empCode} onChange={(e) => setForm((f) => ({ ...f, empCode: e.target.value }))} />
                        </div>
                        <div className="space-y-1.5">
                            <Label>Issued Status</Label>
                            <Input value={form.issuedStatus} onChange={(e) => setForm((f) => ({ ...f, issuedStatus: e.target.value }))} />
                        </div>
                        <div className="space-y-1.5">
                            <Label>Employee Name</Label>
                            <Input value={form.employeeName} onChange={(e) => setForm((f) => ({ ...f, employeeName: e.target.value }))} />
                        </div>
                        <div className="space-y-1.5">
                            <Label>Office</Label>
                            <Select value={form.branchId} onValueChange={(v) => setForm((f) => ({ ...f, branchId: v }))}>
                                <SelectTrigger><SelectValue placeholder="Select office" /></SelectTrigger>
                                <SelectContent>
                                    {branches.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1.5">
                            <Label>Asset Owned By</Label>
                            <Input value={form.assetOwnedBy} onChange={(e) => setForm((f) => ({ ...f, assetOwnedBy: e.target.value }))} />
                        </div>
                        <div className="space-y-1.5">
                            <Label>Mobile Phone</Label>
                            <Input value={form.mobilePhone} onChange={(e) => setForm((f) => ({ ...f, mobilePhone: e.target.value }))} />
                        </div>
                        <div className="space-y-1.5 md:col-span-2">
                            <Label>Specification</Label>
                            <Textarea value={form.specification} onChange={(e) => setForm((f) => ({ ...f, specification: e.target.value }))} />
                        </div>
                        <div className="space-y-1.5 md:col-span-2">
                            <Label>IT Manager Remarks</Label>
                            <Textarea value={form.itManagerRemarks} onChange={(e) => setForm((f) => ({ ...f, itManagerRemarks: e.target.value }))} />
                        </div>
                        <div className="md:col-span-2">
                            <Button onClick={handleSave} disabled={isSaving} className="w-full bg-emerald-600 hover:bg-emerald-700">
                                {isSaving ? "Saving..." : editingAsset ? "Save Changes" : "Add Asset"}
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Import CSV Dialog */}
            <Dialog open={importOpen} onOpenChange={setImportOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Import Assets from CSV</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        <p className="text-sm text-muted-foreground">
                            CSV must use the same headers as Export CSV: {CSV_HEADERS.join(", ")}.
                        </p>
                        <Input
                            ref={fileInputRef}
                            type="file"
                            accept=".csv"
                            onChange={(e) => setImportFile(e.target.files?.[0] || null)}
                        />
                        <Button onClick={handleImport} disabled={!importFile || importing} className="w-full bg-emerald-600 hover:bg-emerald-700">
                            {importing ? "Importing..." : "Import"}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </Card>
    );
}
