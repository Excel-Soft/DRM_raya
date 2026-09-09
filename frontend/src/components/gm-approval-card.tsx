import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest, mutationRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { CheckCircle2, XCircle, Clock, Eye, Pencil, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    DialogDescription,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

interface GmApprovalCardProps {
    role: "account-manager" | "sales-manager" | "super-hod";
    viewOnly?: boolean;
}

export function GmApprovalCard({ role, viewOnly = false }: GmApprovalCardProps) {
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const [selectedEntry, setSelectedEntry] = useState<any>(null);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [comment, setComment] = useState("");
    const [action, setAction] = useState<"approve" | "reject">("approve");

    // Edit dialog state
    const [editDialogOpen, setEditDialogOpen] = useState(false);
    const [editEntry, setEditEntry] = useState<any>(null);
    const [editForm, setEditForm] = useState({
        orderDollar: "",
        customerDollar: "",
        dollarRate: "",
        pkr: "",
        package: "",
        paymentStatus: "",
        notes: "",
    });

    // Delete state
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [deleteEntry, setDeleteEntry] = useState<any>(null);

    const endpoint = role === "account-manager"
        ? "/api/gm-pool/pending-account-manager"
        : role === "super-hod"
            ? "/api/gm-pool/pending-super-hod"
            : "/api/gm-pool/pending-sales-manager";

    const { data, isLoading } = useQuery({
        queryKey: [`pending-gm-${role}`],
        queryFn: async () => {
            const res = await apiRequest("GET", `${endpoint}?page=1&pageSize=10`);
            return res.json();
        },
        refetchInterval: 30000, // Refresh every 30 seconds
    });

    const { data: packagesData } = useQuery<{ packages: any[] }>({
        queryKey: ["gm-packages"],
        queryFn: async () => {
            const res = await apiRequest("GET", "/api/gm-packages");
            return res.json();
        },
        staleTime: 5 * 60 * 1000,
    });
    const packages = packagesData?.packages || [];

    const approveMutation = useMutation({
        mutationFn: async ({ id, comment }: { id: string; comment: string }) => {
            const url = role === "account-manager"
                ? `/api/gm-pool/${id}/account-manager-approve`
                : role === "super-hod"
                    ? `/api/gm-pool/${id}/super-hod-approve`
                    : `/api/gm-pool/${id}/sales-manager-approve`;
            return mutationRequest("POST", url, { comment });
        },
        onSuccess: (data) => {
            toast({
                title: "Approved!",
                description: data.message || "GM entry approved successfully"
            });
            queryClient.invalidateQueries({ queryKey: [`pending-gm-${role}`] });
            setDialogOpen(false);
            setComment("");
        },
        onError: (error: any) => {
            toast({
                title: "Error",
                description: error.message || "Failed to approve",
                variant: "destructive"
            });
        },
    });

    const rejectMutation = useMutation({
        mutationFn: async ({ id, comment }: { id: string; comment: string }) => {
            const url = role === "account-manager"
                ? `/api/gm-pool/${id}/account-manager-reject`
                : role === "super-hod"
                    ? `/api/gm-pool/${id}/super-hod-reject`
                    : `/api/gm-pool/${id}/sales-manager-reject`;
            const res = await apiRequest("POST", url, { comment });
            return res.json();
        },
        onSuccess: () => {
            toast({
                title: "Rejected",
                description: "GM entry rejected successfully"
            });
            queryClient.invalidateQueries({ queryKey: [`pending-gm-${role}`] });
            setDialogOpen(false);
            setComment("");
        },
        onError: (error: any) => {
            toast({
                title: "Error",
                description: error.message || "Failed to reject",
                variant: "destructive"
            });
        },
    });

    const editMutation = useMutation({
        mutationFn: async ({ id, updates }: { id: string; updates: any }) => {
            const res = await apiRequest("PATCH", `/api/gm-pool/${id}/super-hod-update`, updates);
            return res.json();
        },
        onSuccess: (data) => {
            toast({
                title: "Updated!",
                description: data.message || "GM entry updated successfully"
            });
            queryClient.invalidateQueries({ queryKey: [`pending-gm-${role}`] });
            setEditDialogOpen(false);
            setEditEntry(null);
        },
        onError: (error: any) => {
            toast({
                title: "Error",
                description: error.message || "Failed to update entry",
                variant: "destructive"
            });
        },
    });

    // Delete mutation - soft delete via account API
    const deleteMutation = useMutation({
        mutationFn: async (id: string) => {
            const res = await apiRequest("DELETE", `/api/account/gm-entries/${id}`);
            return res.json();
        },
        onSuccess: () => {
            toast({
                title: "Deleted!",
                description: "GM entry deleted successfully"
            });
            queryClient.invalidateQueries({ queryKey: [`pending-gm-${role}`] });
            setDeleteDialogOpen(false);
            setDeleteEntry(null);
        },
        onError: (error: any) => {
            toast({
                title: "Error",
                description: error.message || "Failed to delete entry",
                variant: "destructive"
            });
        },
    });

    const handleDelete = (entry: any) => {
        setDeleteEntry(entry);
        setDeleteDialogOpen(true);
    };

    const handleAction = (entry: any, actionType: "approve" | "reject") => {
        setSelectedEntry(entry);
        setAction(actionType);
        setComment("");
        setDialogOpen(true);
    };

    const handleEdit = (entry: any) => {
        setEditEntry(entry);
        setEditForm({
            orderDollar: String(entry.amount_usd || entry.orderDollar || ""),
            customerDollar: String(entry.customer_dollar || entry.customerDollar || ""),
            dollarRate: String(entry.dollar_rate || entry.dollarRate || ""),
            pkr: String(entry.amount_pkr || entry.pkr || ""),
            package: entry.package_type || entry.packageType || "",
            paymentStatus: entry.payment_status || entry.paymentStatus || "",
            notes: entry.notes || "",
        });
        setEditDialogOpen(true);
    };

    const handleEditSubmit = () => {
        if (!editEntry) return;

        const updates: any = {};
        if (editForm.orderDollar !== "") updates.orderDollar = parseFloat(editForm.orderDollar);
        if (editForm.customerDollar !== "") updates.customerDollar = parseFloat(editForm.customerDollar);
        if (editForm.dollarRate !== "") updates.dollarRate = parseFloat(editForm.dollarRate);
        if (editForm.pkr !== "") updates.pkr = parseFloat(editForm.pkr);
        if (editForm.package !== "") updates.package = editForm.package;
        if (editForm.paymentStatus !== "") updates.paymentStatus = editForm.paymentStatus;
        if (editForm.notes !== "") updates.notes = editForm.notes;

        editMutation.mutate({ id: editEntry.id, updates });
    };

    const handleSubmit = () => {
        if (!selectedEntry) return;

        if (action === "approve") {
            approveMutation.mutate({ id: selectedEntry.id, comment });
        } else {
            if (!comment.trim()) {
                toast({
                    title: "Comment Required",
                    description: "Please provide a reason for rejection",
                    variant: "destructive"
                });
                return;
            }
            rejectMutation.mutate({ id: selectedEntry.id, comment });
        }
    };

    const entries = data?.entries || [];
    const pendingCount = data?.meta?.total || 0;

    return (
        <>
            <Card className="border-none shadow-md bg-white dark:bg-zinc-900">
                <CardHeader className="flex flex-row items-center justify-between pb-3 border-b">
                    <div className="flex items-center gap-2">
                        <Clock className="h-5 w-5 text-orange-500" />
                        <CardTitle className="text-lg font-bold text-slate-800 dark:text-zinc-100">
                            {viewOnly ? "GM Approvals (View Only)" : role === "super-hod" ? "GM Entries Management" : "Pending GM Approvals"}
                        </CardTitle>
                    </div>
                    <div className="flex items-center gap-2">
                        {viewOnly && (
                            <Badge variant="secondary" className="bg-slate-100 text-slate-600 dark:text-zinc-300 dark:bg-zinc-900">
                                <Eye className="h-3 w-3 mr-1" />
                                View Only
                            </Badge>
                        )}
                        <Badge variant="secondary" className="bg-orange-100 text-orange-700 dark:bg-orange-950/40 dark:text-orange-400">
                            {pendingCount} {viewOnly ? "Entries" : "Pending"}
                        </Badge>
                    </div>
                </CardHeader>
                <CardContent className="pt-4">
                    {isLoading ? (
                        <div className="text-center py-8 text-slate-500 dark:text-zinc-400">Loading...</div>
                    ) : entries.length === 0 ? (
                        <div className="text-center py-8 text-slate-500 dark:text-zinc-400">
                            <CheckCircle2 className="h-12 w-12 mx-auto mb-2 text-green-500" />
                            <p className="font-medium">All caught up!</p>
                            <p className="text-sm">No pending approvals</p>
                        </div>
                    ) : (
                        <div className="space-y-3 max-h-96 overflow-y-auto">
                            {entries.map((entry: any) => (
                                <div
                                    key={entry.id}
                                    className="p-4 border rounded-lg hover:shadow-sm transition-shadow bg-slate-50 dark:bg-zinc-900"
                                >
                                    <div className="flex justify-between items-start mb-2">
                                        <div>
                                            <p className="font-semibold text-slate-900 dark:text-zinc-100">{entry.company_name || entry.companyName}</p>
                                            <p className="text-sm text-slate-600 dark:text-zinc-300">DRM ID: {entry.drm_id || entry.drmId}</p>
                                        </div>
                                        <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-900">
                                            {entry.package_type || entry.packageType || "Standard"}
                                        </Badge>
                                    </div>

                                    <div className="grid grid-cols-2 gap-2 text-sm mb-3">
                                        <div>
                                            <span className="text-slate-500 dark:text-zinc-400">Amount:</span>
                                            <span className="ml-1 font-medium text-slate-900 dark:text-zinc-100">
                                                ${entry.amount_usd || entry.amountUsd || entry.orderDollar || "0"}
                                            </span>
                                        </div>
                                        <div>
                                            <span className="text-slate-500 dark:text-zinc-400">Member:</span>
                                            <span className="ml-1 font-medium text-slate-900 dark:text-zinc-100">
                                                {entry.member_id || entry.memberId || "N/A"}
                                            </span>
                                        </div>
                                        {(entry.dollar_rate || entry.dollarRate) && (
                                            <div>
                                                <span className="text-slate-500 dark:text-zinc-400">Rate:</span>
                                                <span className="ml-1 font-medium text-slate-900 dark:text-zinc-100">
                                                    {entry.dollar_rate || entry.dollarRate}
                                                </span>
                                            </div>
                                        )}
                                        {(entry.amount_pkr || entry.pkr) && (
                                            <div>
                                                <span className="text-slate-500 dark:text-zinc-400">PKR:</span>
                                                <span className="ml-1 font-medium text-slate-900 dark:text-zinc-100">
                                                    {entry.amount_pkr || entry.pkr}
                                                </span>
                                            </div>
                                        )}
                                    </div>

                                    {entry.hod_comment && (
                                        <div className="mb-3 p-2 bg-blue-50 dark:bg-blue-950/40 rounded text-xs">
                                            <span className="font-medium text-blue-900 dark:text-blue-300">HOD Comment:</span>
                                            <p className="text-blue-700 dark:text-blue-400 mt-1">{entry.hod_comment}</p>
                                        </div>
                                    )}

                                    {entry.account_manager_comment && (
                                        <div className="mb-3 p-2 bg-purple-50 dark:bg-purple-950/40 rounded text-xs">
                                            <span className="font-medium text-purple-900 dark:text-purple-300">Account Manager Comment:</span>
                                            <p className="text-purple-700 dark:text-purple-400 mt-1">{entry.account_manager_comment}</p>
                                        </div>
                                    )}

                                    {!viewOnly && role === "super-hod" ? (
                                        /* Super HOD: Only Edit & Delete — no Approve/Reject */
                                        <div className="flex gap-2">
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                className="flex-1 border-blue-300 text-blue-700 hover:bg-blue-50"
                                                onClick={() => handleEdit(entry)}
                                            >
                                                <Pencil className="h-4 w-4 mr-1" />
                                                Edit
                                            </Button>
                                            <Button
                                                size="sm"
                                                variant="destructive"
                                                className="flex-1"
                                                onClick={() => handleDelete(entry)}
                                            >
                                                <Trash2 className="h-4 w-4 mr-1" />
                                                Delete
                                            </Button>
                                        </div>
                                    ) : !viewOnly ? (
                                        /* Account Manager / Sales Manager: Approve & Reject */
                                        <div className="flex gap-2">
                                            <Button
                                                size="sm"
                                                className="flex-1 bg-green-600 hover:bg-green-700"
                                                onClick={() => handleAction(entry, "approve")}
                                            >
                                                <CheckCircle2 className="h-4 w-4 mr-1" />
                                                Approve
                                            </Button>
                                            <Button
                                                size="sm"
                                                variant="destructive"
                                                className="flex-1"
                                                onClick={() => handleAction(entry, "reject")}
                                            >
                                                <XCircle className="h-4 w-4 mr-1" />
                                                Reject
                                            </Button>
                                        </div>
                                    ) : null}

                                    {viewOnly && (
                                        <div className="flex items-center gap-2 pt-1">
                                            <div className="flex items-center gap-1.5 text-xs text-slate-500 bg-slate-100 rounded-full px-3 py-1 dark:text-zinc-400 dark:bg-zinc-900">
                                                <Eye className="h-3 w-3" />
                                                <span>View Only — No action required</span>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Approve / Reject Dialog */}
            {!viewOnly && (
                <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>
                                {action === "approve" ? "Approve" : "Reject"} GM Entry
                            </DialogTitle>
                            <DialogDescription>
                                {selectedEntry && (
                                    <div className="mt-2 space-y-1 text-sm">
                                        <p><strong>Company:</strong> {selectedEntry.company_name || selectedEntry.companyName}</p>
                                        <p><strong>DRM ID:</strong> {selectedEntry.drm_id || selectedEntry.drmId}</p>
                                        <p><strong>Amount:</strong> ${selectedEntry.amount_usd || selectedEntry.amountUsd || selectedEntry.orderDollar}</p>
                                    </div>
                                )}
                            </DialogDescription>
                        </DialogHeader>

                        <div className="space-y-4 py-4">
                            <div>
                                <Label htmlFor="comment">
                                    Comment {action === "reject" && <span className="text-red-500">*</span>}
                                </Label>
                                <Textarea
                                    id="comment"
                                    placeholder={action === "approve" ? "Optional comment..." : "Please provide a reason for rejection"}
                                    value={comment}
                                    onChange={(e) => setComment(e.target.value)}
                                    rows={3}
                                    className="mt-1"
                                />
                            </div>
                        </div>

                        <DialogFooter>
                            <Button variant="outline" onClick={() => setDialogOpen(false)}>
                                Cancel
                            </Button>
                            <Button
                                className={action === "approve" ? "bg-green-600 hover:bg-green-700" : ""}
                                variant={action === "reject" ? "destructive" : "default"}
                                onClick={handleSubmit}
                                disabled={!comment || !comment.trim() || approveMutation.isPending || rejectMutation.isPending}
                            >
                                {approveMutation.isPending || rejectMutation.isPending ? "Processing..." : action === "approve" ? "Approve" : "Reject"}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            )}

            {/* Edit Dialog - Super HOD only */}
            {role === "super-hod" && (
                <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
                    <DialogContent className="max-w-lg">
                        <DialogHeader>
                            <DialogTitle className="flex items-center gap-2">
                                <Pencil className="h-5 w-5 text-blue-600" />
                                Edit GM Entry
                            </DialogTitle>
                            <DialogDescription>
                                {editEntry && (
                                    <div className="mt-1 text-sm">
                                        <strong>{editEntry.company_name || editEntry.companyName}</strong>
                                        {" — "}DRM ID: {editEntry.drm_id || editEntry.drmId}
                                    </div>
                                )}
                            </DialogDescription>
                        </DialogHeader>

                        <div className="space-y-4 py-2">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <Label htmlFor="edit-order-dollar">Amount (USD)</Label>
                                    <Input
                                        id="edit-order-dollar"
                                        type="number"
                                        placeholder="e.g. 900"
                                        value={editForm.orderDollar}
                                        onChange={(e) => setEditForm(f => ({ ...f, orderDollar: e.target.value }))}
                                        className="mt-1"
                                    />
                                </div>
                                <div>
                                    <Label htmlFor="edit-customer-dollar">Customer Dollar</Label>
                                    <Input
                                        id="edit-customer-dollar"
                                        type="number"
                                        placeholder="e.g. 850"
                                        value={editForm.customerDollar}
                                        onChange={(e) => setEditForm(f => ({ ...f, customerDollar: e.target.value }))}
                                        className="mt-1"
                                    />
                                </div>
                                <div>
                                    <Label htmlFor="edit-dollar-rate">Dollar Rate</Label>
                                    <Input
                                        id="edit-dollar-rate"
                                        type="number"
                                        placeholder="e.g. 278"
                                        value={editForm.dollarRate}
                                        onChange={(e) => setEditForm(f => ({ ...f, dollarRate: e.target.value }))}
                                        className="mt-1"
                                    />
                                </div>
                                <div>
                                    <Label htmlFor="edit-pkr">PKR Amount</Label>
                                    <Input
                                        id="edit-pkr"
                                        type="number"
                                        placeholder="e.g. 250200"
                                        value={editForm.pkr}
                                        onChange={(e) => setEditForm(f => ({ ...f, pkr: e.target.value }))}
                                        className="mt-1"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <Label htmlFor="edit-package">Package Type</Label>
                                    <Select
                                        value={editForm.package}
                                        onValueChange={(val) => setEditForm(f => ({ ...f, package: val }))}
                                    >
                                        <SelectTrigger id="edit-package" className="mt-1">
                                            <SelectValue placeholder="Select package" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {packages.map((pkg) => (
                                                <SelectItem key={pkg.id} value={pkg.name}>
                                                    {pkg.name} ({pkg.orderDollar ?? pkg.priceUsd} $)
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div>
                                    <Label htmlFor="edit-payment-status">Payment Status</Label>
                                    <Select
                                        value={editForm.paymentStatus}
                                        onValueChange={(val) => setEditForm(f => ({ ...f, paymentStatus: val }))}
                                    >
                                        <SelectTrigger id="edit-payment-status" className="mt-1">
                                            <SelectValue placeholder="Select status" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="Paid">Paid</SelectItem>
                                            <SelectItem value="Partial">Partial</SelectItem>
                                            <SelectItem value="Pending">Pending</SelectItem>
                                            <SelectItem value="Loan">Loan</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            <div>
                                <Label htmlFor="edit-notes">Notes</Label>
                                <Textarea
                                    id="edit-notes"
                                    placeholder="Additional notes..."
                                    value={editForm.notes}
                                    onChange={(e) => setEditForm(f => ({ ...f, notes: e.target.value }))}
                                    rows={3}
                                    className="mt-1"
                                />
                            </div>
                        </div>

                        <DialogFooter>
                            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
                                Cancel
                            </Button>
                            <Button
                                className="bg-blue-600 hover:bg-blue-700"
                                onClick={handleEditSubmit}
                                disabled={editMutation.isPending}
                            >
                                {editMutation.isPending ? "Saving..." : "Save Changes"}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            )}

            {/* Delete Confirmation Dialog - Super HOD */}
            {role === "super-hod" && (
                <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle className="flex items-center gap-2 text-red-600">
                                <Trash2 className="h-5 w-5" />
                                Delete GM Entry
                            </DialogTitle>
                            <DialogDescription>
                                {deleteEntry && (
                                    <div className="mt-2 space-y-1 text-sm">
                                        <p><strong>Company:</strong> {deleteEntry.company_name || deleteEntry.companyName}</p>
                                        <p><strong>DRM ID:</strong> {deleteEntry.drm_id || deleteEntry.drmId}</p>
                                        <p><strong>Amount:</strong> ${deleteEntry.amount_usd || deleteEntry.amountUsd || deleteEntry.orderDollar}</p>
                                    </div>
                                )}
                                <p className="mt-3 text-red-500 font-medium">Are you sure you want to delete this entry? This action cannot be undone.</p>
                            </DialogDescription>
                        </DialogHeader>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
                                Cancel
                            </Button>
                            <Button
                                variant="destructive"
                                onClick={() => deleteEntry && deleteMutation.mutate(deleteEntry.id)}
                                disabled={deleteMutation.isPending}
                            >
                                {deleteMutation.isPending ? "Deleting..." : "Delete Entry"}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            )}
        </>
    );
}
