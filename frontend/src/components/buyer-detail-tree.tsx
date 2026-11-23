import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest, mutationRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ChevronRight, ChevronDown, Folder, Plus, Trash2, Mail, Phone } from "lucide-react";

interface AttributeRow {
    id: string;
    category: string;
    name: string;
    parentId: string | null;
    email: string | null;
    phone: string | null;
}

const CATEGORY = "Buyer Detail";

export function BuyerDetailTree() {
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const [expanded, setExpanded] = useState<Set<string>>(new Set());
    const [addBuyerOpen, setAddBuyerOpen] = useState(false);
    const [addRefOpen, setAddRefOpen] = useState(false);
    const [buyerName, setBuyerName] = useState("");
    const [refBuyerId, setRefBuyerId] = useState("");
    const [refName, setRefName] = useState("");
    const [refEmail, setRefEmail] = useState("");
    const [refPhone, setRefPhone] = useState("");

    const queryKey = ["/api/attributes", CATEGORY];
    const { data: rows = [], isLoading } = useQuery<AttributeRow[]>({
        queryKey,
        queryFn: async () => {
            const res = await apiRequest("GET", `/api/attributes/${encodeURIComponent(CATEGORY)}`);
            return res.json();
        },
    });
    const buyers = rows.filter((r) => !r.parentId);
    const refsByBuyer = new Map<string, AttributeRow[]>();
    rows.filter((r) => r.parentId).forEach((r) => {
        const list = refsByBuyer.get(r.parentId as string) ?? [];
        list.push(r);
        refsByBuyer.set(r.parentId as string, list);
    });

    const invalidate = () => queryClient.invalidateQueries({ queryKey });

    const addMutation = useMutation({
        mutationFn: async (payload: { name: string; parentId?: string | null; email?: string; phone?: string }) =>
            mutationRequest("POST", "/api/attributes", { category: CATEGORY, ...payload }),
        onSuccess: () => {
            invalidate();
            setAddBuyerOpen(false);
            setAddRefOpen(false);
            setBuyerName("");
            setRefBuyerId("");
            setRefName("");
            setRefEmail("");
            setRefPhone("");
            toast({ title: "Saved" });
        },
        onError: (error: Error) => toast({ title: "Error", description: error.message, variant: "destructive" }),
    });

    const deleteMutation = useMutation({
        mutationFn: async (id: string) => mutationRequest("DELETE", `/api/attributes/${id}`),
        onSuccess: () => {
            invalidate();
            toast({ title: "Deleted" });
        },
        onError: (error: Error) => toast({ title: "Error", description: error.message, variant: "destructive" }),
    });

    const toggle = (id: string) =>
        setExpanded((s) => {
            const next = new Set(s);
            next.has(id) ? next.delete(id) : next.add(id);
            return next;
        });

    useEffect(() => {
        if (buyers.length > 0) {
            setExpanded(new Set(buyers.map((b) => b.id)));
        }
    }, [buyers]);

    return (
        <div className="w-full max-w-none">
            <div className="mb-6 flex flex-wrap items-center gap-2">
                <Button className="bg-[#008d4c] hover:bg-[#00733e] text-white" onClick={() => setAddBuyerOpen(true)}>
                    <Plus className="w-4 h-4 mr-2" />
                    Add New Buyer
                </Button>
                <Button variant="outline" onClick={() => setAddRefOpen(true)} disabled={buyers.length === 0}>
                    <Plus className="w-4 h-4 mr-2" />
                    Add Reference
                </Button>
            </div>

            <div className="rounded-md border border-t-4 border-t-[#008d4c] border-slate-100 bg-white p-2 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
                {isLoading ? (
                    <div className="p-8 text-center text-muted-foreground">Loading...</div>
                ) : buyers.length === 0 ? (
                    <div className="p-8 text-center text-muted-foreground">No buyers yet. Add one above.</div>
                ) : (
                    buyers.map((buyer) => {
                        const refs = refsByBuyer.get(buyer.id) ?? [];
                        const isOpen = expanded.has(buyer.id);
                        return (
                            <div key={buyer.id} className="py-1">
                                <div className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-slate-50 dark:hover:bg-zinc-900 group">
                                    <button onClick={() => toggle(buyer.id)} className="text-slate-400">
                                        {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                                    </button>
                                    <Folder className="w-4 h-4 text-amber-500" />
                                    <span className="font-semibold text-slate-700 dark:text-zinc-300">{buyer.name}</span>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="ml-auto h-7 w-7 shrink-0 text-red-500 hover:bg-red-50 hover:text-red-700"
                                        onClick={() => {
                                            if (confirm(`Delete "${buyer.name}" and all its references?`)) deleteMutation.mutate(buyer.id);
                                        }}
                                    >
                                        <Trash2 className="w-3.5 h-3.5" />
                                    </Button>
                                </div>
                                {isOpen && (
                                    <div className="ml-6 mt-1 space-y-1 border-l border-slate-200 pl-3 dark:border-zinc-800">
                                        {refs.length === 0 ? (
                                            <div className="py-1.5 text-xs text-muted-foreground">No references.</div>
                                        ) : (
                                            refs.map((ref) => (
                                                <div
                                                    key={ref.id}
                                                    className="flex flex-wrap items-center gap-2 rounded px-2 py-1.5 hover:bg-slate-50 dark:hover:bg-zinc-900"
                                                >
                                                    <Folder className="h-3.5 w-3.5 shrink-0 text-sky-500" />
                                                    <span className="text-sm text-slate-600 dark:text-zinc-400">{ref.name}</span>
                                                    {ref.email && (
                                                        <span className="flex items-center gap-1 rounded bg-slate-100 px-2 py-0.5 text-[11px] text-slate-500 dark:bg-zinc-800 dark:text-zinc-400">
                                                            <Mail className="h-3 w-3" />
                                                            {ref.email}
                                                        </span>
                                                    )}
                                                    {ref.phone && (
                                                        <span className="flex items-center gap-1 rounded bg-emerald-50 px-2 py-0.5 text-[11px] text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400">
                                                            <Phone className="h-3 w-3" />
                                                            {ref.phone}
                                                        </span>
                                                    )}
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        className="ml-auto h-7 w-7 shrink-0 text-red-500 hover:bg-red-50 hover:text-red-700"
                                                        onClick={() => {
                                                            if (confirm(`Delete "${ref.name}"?`)) deleteMutation.mutate(ref.id);
                                                        }}
                                                    >
                                                        <Trash2 className="h-3.5 w-3.5" />
                                                    </Button>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })
                )}
            </div>

            <Dialog open={addBuyerOpen} onOpenChange={setAddBuyerOpen}>
                <DialogContent>
                    <DialogHeader><DialogTitle>Add New Buyer</DialogTitle></DialogHeader>
                    <div className="space-y-4 py-2">
                        <div className="space-y-2">
                            <Label>Name</Label>
                            <Input value={buyerName} onChange={(e) => setBuyerName(e.target.value)} placeholder="Enter buyer name..." />
                        </div>
                        <Button
                            className="w-full bg-[#008d4c] hover:bg-[#00733e]"
                            disabled={addMutation.isPending || !buyerName.trim()}
                            onClick={() => addMutation.mutate({ name: buyerName.trim(), parentId: null })}
                        >
                            {addMutation.isPending ? "Adding..." : "Add Buyer"}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            <Dialog open={addRefOpen} onOpenChange={setAddRefOpen}>
                <DialogContent>
                    <DialogHeader><DialogTitle>Add Reference</DialogTitle></DialogHeader>
                    <div className="space-y-4 py-2">
                        <div className="space-y-2">
                            <Label>Buyer</Label>
                            <Select value={refBuyerId} onValueChange={setRefBuyerId}>
                                <SelectTrigger><SelectValue placeholder="Choose a buyer..." /></SelectTrigger>
                                <SelectContent>
                                    {buyers.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>Name</Label>
                            <Input value={refName} onChange={(e) => setRefName(e.target.value)} placeholder="Enter reference name..." />
                        </div>
                        <div className="space-y-2">
                            <Label>Email (optional)</Label>
                            <Input value={refEmail} onChange={(e) => setRefEmail(e.target.value)} placeholder="Enter email..." />
                        </div>
                        <div className="space-y-2">
                            <Label>Phone (optional)</Label>
                            <Input value={refPhone} onChange={(e) => setRefPhone(e.target.value)} placeholder="Enter phone..." />
                        </div>
                        <Button
                            className="w-full bg-[#008d4c] hover:bg-[#00733e]"
                            disabled={addMutation.isPending || !refName.trim() || !refBuyerId}
                            onClick={() => addMutation.mutate({
                                name: refName.trim(),
                                parentId: refBuyerId,
                                email: refEmail.trim() || undefined,
                                phone: refPhone.trim() || undefined,
                            })}
                        >
                            {addMutation.isPending ? "Adding..." : "Add Reference"}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
