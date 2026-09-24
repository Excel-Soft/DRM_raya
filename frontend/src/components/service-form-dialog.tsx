import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

// Free-text department codes — same convention projects.departmentType
// already uses elsewhere in this schema. Static fallback for callers that
// just need a label lookup outside of React Query (e.g. plain badge
// rendering) — the live, admin-manageable list now lives in
// drm.departments (see /drm/attributes -> Departments tab) and is what
// useDepartmentOptions() below actually renders in this form.
export const DEPARTMENT_OPTIONS = [
    { value: "SALES", label: "Sales" },
    { value: "ACCOUNTS", label: "Accounts" },
    { value: "IT", label: "IT" },
    { value: "SOFTWARE", label: "Software" },
    { value: "DND", label: "D&D" },
    { value: "PRODUCT_POSTING", label: "Product Posting" },
    { value: "SEO_SMM", label: "SEO/SMM" },
    { value: "SERVICE", label: "Service" },
    { value: "MARKETING", label: "Marketing" },
    { value: "LEAD", label: "Lead" },
    { value: "QA", label: "QA" },
    { value: "RECEPTION", label: "Reception" },
    { value: "VERIFICATION", label: "Verification" },
] as const;

export interface DepartmentOption {
    value: string;
    label: string;
}

// Live department list from drm.departments, falling back to the static
// DEPARTMENT_OPTIONS above while loading or if the request fails — so a
// brand-new/renamed/deactivated department (managed from the Departments
// attributes tab) shows up here without needing a code change, while never
// leaving this form with an empty picker.
export function useDepartmentOptions(): DepartmentOption[] {
    const { data } = useQuery<DepartmentOption[]>({
        queryKey: ["/api/drm/departments"],
        queryFn: async () => {
            const res = await apiRequest("GET", "/api/drm/departments");
            const body = await res.json();
            return (body.data ?? [])
                .filter((d: any) => d.isActive)
                .map((d: any) => ({ value: d.code, label: d.name }));
        },
        staleTime: 60_000,
    });
    return data && data.length > 0 ? data : (DEPARTMENT_OPTIONS as unknown as DepartmentOption[]);
}

export interface ServiceFormValues {
    name: string;
    description: string;
    price: string;
    discount: string;
    minDay: string;
    maxDay: string;
    depId: string;
    routeDepartments: string[];
    projectDepartment: string;
}

export const emptyServiceForm: ServiceFormValues = {
    name: "", description: "", price: "", discount: "", minDay: "", maxDay: "", depId: "", routeDepartments: [], projectDepartment: "",
};

interface ServiceFormDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    levelLabel: string; // "Service" | "Sub-Service" | "Sub-Sub-Service"
    initialValues: ServiceFormValues;
    isEditing: boolean;
    isSaving: boolean;
    onSave: (values: ServiceFormValues) => void;
}

export function ServiceFormDialog({ open, onOpenChange, levelLabel, initialValues, isEditing, isSaving, onSave }: ServiceFormDialogProps) {
    const [form, setForm] = useState<ServiceFormValues>(initialValues);
    const departmentOptions = useDepartmentOptions();

    useEffect(() => {
        if (open) setForm(initialValues);
    }, [open, initialValues]);

    const toggleDept = (value: string) => {
        setForm((f) => ({
            ...f,
            routeDepartments: f.routeDepartments.includes(value)
                ? f.routeDepartments.filter((d) => d !== value)
                : [...f.routeDepartments, value],
        }));
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>{isEditing ? `Edit ${levelLabel}` : `Add New ${levelLabel}`}</DialogTitle>
                </DialogHeader>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-2">
                    <div className="space-y-1.5 md:col-span-2">
                        <Label>Name *</Label>
                        <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
                    </div>
                    <div className="space-y-1.5 md:col-span-2">
                        <Label>Detail / Description</Label>
                        <Textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
                    </div>
                    <div className="space-y-1.5">
                        <Label>Price</Label>
                        <Input type="number" value={form.price} onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))} />
                    </div>
                    <div className="space-y-1.5">
                        <Label>Discount</Label>
                        <Input type="number" value={form.discount} onChange={(e) => setForm((f) => ({ ...f, discount: e.target.value }))} />
                    </div>
                    <div className="space-y-1.5">
                        <Label>Min Days</Label>
                        <Input type="number" value={form.minDay} onChange={(e) => setForm((f) => ({ ...f, minDay: e.target.value }))} />
                    </div>
                    <div className="space-y-1.5">
                        <Label>Max Days</Label>
                        <Input type="number" value={form.maxDay} onChange={(e) => setForm((f) => ({ ...f, maxDay: e.target.value }))} />
                    </div>
                    <div className="space-y-1.5 md:col-span-2">
                        <Label>Legacy Department ID</Label>
                        <Input
                            type="number"
                            placeholder="Legacy numeric department id — no name mapping exists for these yet"
                            value={form.depId}
                            onChange={(e) => setForm((f) => ({ ...f, depId: e.target.value }))}
                        />
                    </div>
                    <div className="space-y-1.5 md:col-span-2">
                        <Label>Allowed Department(s)</Label>
                        <p className="text-xs text-muted-foreground">
                            Which department(s) may use this service to build a quotation.
                        </p>
                        <div className="grid grid-cols-2 gap-2 mt-1">
                            {departmentOptions.map((opt) => (
                                <label key={opt.value} className="flex items-center gap-2 text-sm cursor-pointer">
                                    <Checkbox
                                        checked={form.routeDepartments.includes(opt.value)}
                                        onCheckedChange={() => toggleDept(opt.value)}
                                    />
                                    {opt.label}
                                </label>
                            ))}
                        </div>
                    </div>
                    <div className="space-y-1.5 md:col-span-2">
                        <Label>Project Department</Label>
                        <p className="text-xs text-muted-foreground">
                            When an invoice for this service is approved, the project is routed here. Not wired into the live approval flow yet — a planned follow-up.
                        </p>
                        <Select
                            value={form.projectDepartment || "__none__"}
                            onValueChange={(v) => setForm((f) => ({ ...f, projectDepartment: v === "__none__" ? "" : v }))}
                        >
                            <SelectTrigger><SelectValue placeholder="Choose a department..." /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="__none__">None</SelectItem>
                                {departmentOptions.map((opt) => (
                                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>
                <Button
                    onClick={() => onSave(form)}
                    className="w-full bg-[#008d4c] hover:bg-[#00733e]"
                    disabled={isSaving || !form.name.trim()}
                >
                    {isSaving ? "Saving..." : isEditing ? "Save Changes" : `Add ${levelLabel}`}
                </Button>
            </DialogContent>
        </Dialog>
    );
}
