import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest, mutationRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronRight, ChevronDown, Folder, Plus, Pencil, Trash2 } from "lucide-react";
import { ServiceFormDialog, emptyServiceForm, type ServiceFormValues } from "@/components/service-form-dialog";

interface ServiceNode {
    id: string;
    code: string;
    name: string;
    description: string | null;
    price: string | number | null;
    discount: string | number | null;
    minDay: number | null;
    maxDay: number | null;
    depId: number | null;
    routeDepartments: string[] | null;
    isActive: boolean;
}

interface SubSubserviceNode extends ServiceNode {}
interface SubserviceNode extends ServiceNode {
    subSubservices: SubSubserviceNode[];
}
interface TopServiceNode extends ServiceNode {
    subServices: SubserviceNode[];
}

type DialogTarget =
    | { level: 1; parentId?: undefined; editingId?: string; initial: ServiceFormValues }
    | { level: 2; parentId: string; editingId?: string; initial: ServiceFormValues }
    | { level: 3; parentId: string; editingId?: string; initial: ServiceFormValues };

function toFormValues(node?: ServiceNode): ServiceFormValues {
    if (!node) return emptyServiceForm;
    return {
        name: node.name,
        description: node.description || "",
        price: node.price != null ? String(node.price) : "",
        discount: node.discount != null ? String(node.discount) : "",
        minDay: node.minDay != null ? String(node.minDay) : "",
        maxDay: node.maxDay != null ? String(node.maxDay) : "",
        depId: node.depId != null ? String(node.depId) : "",
        routeDepartments: node.routeDepartments || [],
    };
}

function toPayload(values: ServiceFormValues) {
    return {
        name: values.name.trim(),
        description: values.description.trim() || null,
        price: values.price.trim() === "" ? null : Number(values.price),
        discount: values.discount.trim() === "" ? null : Number(values.discount),
        minDay: values.minDay.trim() === "" ? null : Number(values.minDay),
        maxDay: values.maxDay.trim() === "" ? null : Number(values.maxDay),
        depId: values.depId.trim() === "" ? null : Number(values.depId),
        routeDepartments: values.routeDepartments.length ? values.routeDepartments : null,
    };
}

function DaysBadges({ node }: { node: ServiceNode }) {
    return (
        <>
            <Badge variant="outline" className="text-[10px] bg-emerald-50 text-emerald-700 border-emerald-200">
                Min Days: {node.minDay ?? "—"}
            </Badge>
            <Badge variant="outline" className="text-[10px] bg-sky-50 text-sky-700 border-sky-200">
                Max Days: {node.maxDay ?? "—"}
            </Badge>
            {node.depId != null && (
                <Badge variant="outline" className="text-[10px] bg-violet-50 text-violet-700 border-violet-200">
                    Dept #{node.depId}
                </Badge>
            )}
        </>
    );
}

export function ServiceCatalogTree() {
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const [expandedServices, setExpandedServices] = useState<Set<string>>(new Set());
    const [expandedSubs, setExpandedSubs] = useState<Set<string>>(new Set());
    const [dialogTarget, setDialogTarget] = useState<DialogTarget | null>(null);

    const { data, isLoading } = useQuery<{ data: TopServiceNode[] }>({
        queryKey: ["/api/drm/services"],
        queryFn: async () => {
            const res = await apiRequest("GET", "/api/drm/services");
            return res.json();
        },
    });
    const list = data?.data ?? [];

    const invalidate = () => queryClient.invalidateQueries({ queryKey: ["/api/drm/services"] });

    const saveMutation = useMutation({
        mutationFn: async (values: ServiceFormValues) => {
            if (!dialogTarget) return;
            const payload = toPayload(values);
            if (dialogTarget.level === 1) {
                return dialogTarget.editingId
                    ? mutationRequest("PATCH", `/api/drm/services/${dialogTarget.editingId}`, payload)
                    : mutationRequest("POST", "/api/drm/services", payload);
            }
            if (dialogTarget.level === 2) {
                return dialogTarget.editingId
                    ? mutationRequest("PATCH", `/api/drm/services/subservices/${dialogTarget.editingId}`, payload)
                    : mutationRequest("POST", `/api/drm/services/${dialogTarget.parentId}/subservices`, payload);
            }
            return dialogTarget.editingId
                ? mutationRequest("PATCH", `/api/drm/services/sub-subservices/${dialogTarget.editingId}`, payload)
                : mutationRequest("POST", `/api/drm/services/subservices/${dialogTarget.parentId}/sub-subservices`, payload);
        },
        onSuccess: () => {
            invalidate();
            setDialogTarget(null);
            toast({ title: "Saved" });
        },
        onError: (error: Error) => toast({ title: "Error", description: error.message, variant: "destructive" }),
    });

    const deleteMutation = useMutation({
        mutationFn: async ({ level, id }: { level: 1 | 2 | 3; id: string }) => {
            const path =
                level === 1 ? `/api/drm/services/${id}` :
                level === 2 ? `/api/drm/services/subservices/${id}` :
                `/api/drm/services/sub-subservices/${id}`;
            await mutationRequest("DELETE", path);
        },
        onSuccess: () => {
            invalidate();
            toast({ title: "Deleted" });
        },
        onError: (error: Error) => toast({ title: "Error", description: error.message, variant: "destructive" }),
    });

    const toggleService = (id: string) =>
        setExpandedServices((s) => {
            const next = new Set(s);
            next.has(id) ? next.delete(id) : next.add(id);
            return next;
        });
    const toggleSub = (id: string) =>
        setExpandedSubs((s) => {
            const next = new Set(s);
            next.has(id) ? next.delete(id) : next.add(id);
            return next;
        });

    return (
        <div>
            <div className="mb-4">
                <Button
                    className="bg-[#008d4c] hover:bg-[#00733e] text-white"
                    onClick={() => setDialogTarget({ level: 1, initial: emptyServiceForm })}
                >
                    <Plus className="w-4 h-4 mr-2" />
                    Add New Service
                </Button>
            </div>

            <div className="divide-y divide-slate-100 dark:divide-zinc-800 rounded-md border border-slate-100 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-2">
            {isLoading ? (
                <div className="p-8 text-center text-muted-foreground">Loading...</div>
            ) : list.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">No services found. Add one above.</div>
            ) : list.map((service) => (
                <div key={service.id} className="py-1">
                    <div className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-slate-50 dark:hover:bg-zinc-900 group">
                        <button onClick={() => toggleService(service.id)} className="text-slate-400">
                            {expandedServices.has(service.id) ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                        </button>
                        <Folder className="w-4 h-4 text-amber-500" />
                        <span className="font-semibold text-slate-700 dark:text-zinc-300">{service.name}</span>
                        <DaysBadges node={service} />
                        <div className="ml-auto flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button variant="ghost" size="sm" className="h-7 w-7"
                                onClick={() => setDialogTarget({ level: 2, parentId: service.id, initial: emptyServiceForm })}
                                title="Add Sub-Service"
                            >
                                <Plus className="w-3.5 h-3.5 text-emerald-600" />
                            </Button>
                            <Button variant="ghost" size="sm" className="h-7 w-7"
                                onClick={() => setDialogTarget({ level: 1, editingId: service.id, initial: toFormValues(service) })}
                            >
                                <Pencil className="w-3.5 h-3.5 text-slate-500" />
                            </Button>
                            <Button variant="ghost" size="sm" className="h-7 w-7"
                                onClick={() => { if (confirm(`Delete "${service.name}"?`)) deleteMutation.mutate({ level: 1, id: service.id }); }}
                            >
                                <Trash2 className="w-3.5 h-3.5 text-red-500" />
                            </Button>
                        </div>
                    </div>

                    {expandedServices.has(service.id) && (
                        <div className="pl-8 border-l border-slate-100 ml-4 dark:border-zinc-800">
                            {service.subServices.length === 0 ? (
                                <div className="text-xs text-muted-foreground py-1.5 px-2">No sub-services yet.</div>
                            ) : (
                                service.subServices.map((sub) => (
                                    <div key={sub.id}>
                                        <div className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-slate-50 dark:hover:bg-zinc-900 group">
                                            <button onClick={() => toggleSub(sub.id)} className="text-slate-400">
                                                {expandedSubs.has(sub.id) ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                                            </button>
                                            <Folder className="w-3.5 h-3.5 text-sky-500" />
                                            <span className="text-slate-600 dark:text-zinc-400">{sub.name}</span>
                                            <DaysBadges node={sub} />
                                            <div className="ml-auto flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <Button variant="ghost" size="sm" className="h-7 w-7"
                                                    onClick={() => setDialogTarget({ level: 3, parentId: sub.id, initial: emptyServiceForm })}
                                                    title="Add Sub-Sub-Service"
                                                >
                                                    <Plus className="w-3.5 h-3.5 text-emerald-600" />
                                                </Button>
                                                <Button variant="ghost" size="sm" className="h-7 w-7"
                                                    onClick={() => setDialogTarget({ level: 2, parentId: service.id, editingId: sub.id, initial: toFormValues(sub) })}
                                                >
                                                    <Pencil className="w-3.5 h-3.5 text-slate-500" />
                                                </Button>
                                                <Button variant="ghost" size="sm" className="h-7 w-7"
                                                    onClick={() => { if (confirm(`Delete "${sub.name}"?`)) deleteMutation.mutate({ level: 2, id: sub.id }); }}
                                                >
                                                    <Trash2 className="w-3.5 h-3.5 text-red-500" />
                                                </Button>
                                            </div>
                                        </div>
                                        {(sub.price != null || sub.discount != null || sub.description) && (
                                            <div className="pl-9 pb-1 flex flex-wrap gap-2 text-[11px] text-slate-500 dark:text-zinc-500">
                                                {sub.price != null && <span>Price: <b className="text-slate-700 dark:text-zinc-300">{sub.price}</b></span>}
                                                {sub.discount != null && <span>Discount: <b className="text-slate-700 dark:text-zinc-300">{sub.discount}</b></span>}
                                                {sub.description && <span>Detail: <b className="text-slate-700 dark:text-zinc-300">{sub.description}</b></span>}
                                            </div>
                                        )}

                                        {expandedSubs.has(sub.id) && (
                                            <div className="pl-8 border-l border-slate-100 ml-4 dark:border-zinc-800">
                                                {sub.subSubservices.length === 0 ? (
                                                    <div className="text-xs text-muted-foreground py-1.5 px-2">No sub-sub-services yet.</div>
                                                ) : (
                                                    sub.subSubservices.map((leaf) => (
                                                        <div key={leaf.id} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-slate-50 dark:hover:bg-zinc-900 group">
                                                            <Folder className="w-3 h-3 text-slate-400" />
                                                            <span className="text-slate-600 dark:text-zinc-400">{leaf.name}</span>
                                                            <DaysBadges node={leaf} />
                                                            <div className="ml-auto flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                                <Button variant="ghost" size="sm" className="h-7 w-7"
                                                                    onClick={() => setDialogTarget({ level: 3, parentId: sub.id, editingId: leaf.id, initial: toFormValues(leaf) })}
                                                                >
                                                                    <Pencil className="w-3.5 h-3.5 text-slate-500" />
                                                                </Button>
                                                                <Button variant="ghost" size="sm" className="h-7 w-7"
                                                                    onClick={() => { if (confirm(`Delete "${leaf.name}"?`)) deleteMutation.mutate({ level: 3, id: leaf.id }); }}
                                                                >
                                                                    <Trash2 className="w-3.5 h-3.5 text-red-500" />
                                                                </Button>
                                                            </div>
                                                        </div>
                                                    ))
                                                )}
                                            </div>
                                        )}
                                    </div>
                                ))
                            )}
                        </div>
                    )}
                </div>
            ))}
            </div>

            {dialogTarget && (
                <ServiceFormDialog
                    open={true}
                    onOpenChange={(open) => { if (!open) setDialogTarget(null); }}
                    levelLabel={dialogTarget.level === 1 ? "Service" : dialogTarget.level === 2 ? "Sub-Service" : "Sub-Sub-Service"}
                    initialValues={dialogTarget.initial}
                    isEditing={!!dialogTarget.editingId}
                    isSaving={saveMutation.isPending}
                    onSave={(values) => saveMutation.mutate(values)}
                />
            )}
        </div>
    );
}
