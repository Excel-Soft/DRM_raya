import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest, mutationRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Trash2, Plus, Pencil } from "lucide-react";

interface DepartmentRow {
    id: string;
    code: string;
    name: string;
    isActive: boolean;
    sortOrder: number;
}

interface DepartmentFormState {
    name: string;
    code: string;
    isActive: boolean;
}

const emptyForm: DepartmentFormState = { name: "", code: "", isActive: true };

// Every department currently in use throughout the project — the same list
// that powers the "Allowed Department(s)" checkboxes and the single-value
// "Project Department" select on Service for Quotation entries. This is the
// live, admin-manageable source of truth (drm.departments); adding, renaming
// or deactivating a department here takes effect everywhere that reads it.
export function DepartmentsManager() {
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [form, setForm] = useState<DepartmentFormState>(emptyForm);
    const { toast } = useToast();
    const queryClient = useQueryClient();

    const { data: departments = [], isLoading } = useQuery<DepartmentRow[]>({
        queryKey: ["/api/drm/departments", "all"],
        queryFn: async () => {
            const res = await apiRequest("GET", "/api/drm/departments?includeInactive=true");
            const body = await res.json();
            return body.data ?? [];
        },
    });

    const invalidate = () => queryClient.invalidateQueries({ queryKey: ["/api/drm/departments"] });

    const saveMutation = useMutation({
        mutationFn: async (input: DepartmentFormState) =>
            editingId
                ? mutationRequest("PATCH", `/api/drm/departments/${editingId}`, {
                    name: input.name,
                    code: input.code.trim() || undefined,
                    isActive: input.isActive,
                })
                : mutationRequest("POST", "/api/drm/departments", {
                    name: input.name,
                    code: input.code.trim() || undefined,
                    isActive: input.isActive,
                }),
        onSuccess: () => {
            invalidate();
            closeDialog();
            toast({ title: "Success", description: editingId ? "Department updated successfully" : "Department added successfully" });
        },
        onError: (error: Error) => {
            toast({ title: "Error", description: error.message || "Failed to save department", variant: "destructive" });
        },
    });

    const deleteMutation = useMutation({
        mutationFn: async (id: string) => mutationRequest("DELETE", `/api/drm/departments/${id}`),
        onSuccess: () => {
            invalidate();
            toast({ title: "Success", description: "Department deleted successfully" });
        },
        onError: (error: Error) => {
            toast({ title: "Error", description: error.message || "Failed to delete department", variant: "destructive" });
        },
    });

    const openAdd = () => {
        setEditingId(null);
        setForm(emptyForm);
        setDialogOpen(true);
    };

    const openEdit = (dept: DepartmentRow) => {
        setEditingId(dept.id);
        setForm({ name: dept.name, code: dept.code, isActive: dept.isActive });
        setDialogOpen(true);
    };

    const closeDialog = () => {
        setDialogOpen(false);
        setEditingId(null);
        setForm(emptyForm);
    };

    const handleSave = () => {
        if (!form.name.trim()) return;
        saveMutation.mutate(form);
    };

    return (
        <>
            <div className="flex items-center justify-between mb-6">
                <Button className="bg-[#008d4c] hover:bg-[#00733e] text-white" onClick={openAdd}>
                    <Plus className="w-4 h-4 mr-2" />
                    Add New Department
                </Button>
            </div>

            <Card className="border-t-4 border-t-[#008d4c] shadow-sm">
                <CardHeader className="pb-2">
                    <CardTitle className="text-lg font-bold text-slate-700 dark:text-zinc-400">Departments</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader className="bg-slate-50 dark:bg-zinc-900">
                            <TableRow>
                                <TableHead className="font-semibold text-slate-700 w-full dark:text-zinc-400">Name</TableHead>
                                <TableHead className="font-semibold text-slate-700 dark:text-zinc-400">Code</TableHead>
                                <TableHead className="font-semibold text-slate-700 dark:text-zinc-400">Status</TableHead>
                                <TableHead className="font-semibold text-slate-700 w-24 text-center dark:text-zinc-400">Action</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                <TableRow>
                                    <TableCell colSpan={4} className="text-center py-8">Loading...</TableCell>
                                </TableRow>
                            ) : departments.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                                        No departments found. Add one above.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                departments.map((dept) => (
                                    <TableRow key={dept.id}>
                                        <TableCell className="font-medium text-slate-700 dark:text-zinc-400">{dept.name}</TableCell>
                                        <TableCell className="text-slate-600 dark:text-zinc-400">{dept.code}</TableCell>
                                        <TableCell>
                                            <Badge variant={dept.isActive ? "default" : "secondary"} className={dept.isActive ? "bg-[#008d4c] hover:bg-[#008d4c]" : ""}>
                                                {dept.isActive ? "Active" : "Inactive"}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-center">
                                            <div className="flex items-center justify-center gap-1">
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="h-8 w-8 text-slate-500 hover:text-slate-700 hover:bg-slate-100"
                                                    onClick={() => openEdit(dept)}
                                                >
                                                    <Pencil className="w-4 h-4" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50"
                                                    onClick={() => {
                                                        if (confirm("Are you sure?")) deleteMutation.mutate(dept.id);
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

            <Dialog open={dialogOpen} onOpenChange={(open) => (open ? setDialogOpen(true) : closeDialog())}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{editingId ? "Edit Department" : "Add New Department"}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label>Name</Label>
                            <Input
                                placeholder="Enter department name..."
                                value={form.name}
                                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Code</Label>
                            <Input
                                placeholder="Auto-generated from name if left blank"
                                value={form.code}
                                onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))}
                            />
                            <p className="text-xs text-muted-foreground">
                                Stable identifier used everywhere this department is referenced (Allowed Departments, Project Department, etc.). Changing it on an existing department does not update rows already saved with the old code.
                            </p>
                        </div>
                        <label className="flex items-center gap-2 text-sm cursor-pointer">
                            <Checkbox
                                checked={form.isActive}
                                onCheckedChange={(checked) => setForm((f) => ({ ...f, isActive: checked === true }))}
                            />
                            Active
                        </label>
                        <Button
                            onClick={handleSave}
                            className="w-full bg-[#008d4c] hover:bg-[#00733e]"
                            disabled={saveMutation.isPending || !form.name.trim()}
                        >
                            {saveMutation.isPending ? "Saving..." : editingId ? "Save Changes" : "Add Department"}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
}
