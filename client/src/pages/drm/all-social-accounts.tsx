import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import {
    Facebook,
    Instagram,
    Linkedin,
    Youtube,
    Music2,
    PlusCircle,
    Trash2,
    Link as LinkIcon,
    Pencil,
    BadgeCheck,
    Power,
    Globe,
} from "lucide-react";
import { apiRequestJson, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

type SocialAccountRow = {
    id: string;
    ownerName: string | null;
    platform: string;
    accountName: string | null;
    url: string | null;
    customerId: string | null;
    customerName: string | null;
    projectId: string | null;
    status: string;
    isVerified: boolean;
    verifiedBy: string | null;
    verifiedByName: string | null;
    verifiedAt: string | null;
    createdBy: string | null;
    createdByName: string | null;
    createdAt: string | null;
    updatedAt: string | null;
};

type SocialAccountsResponse = {
    data: SocialAccountRow[];
    total: number;
    page: number;
    pageSize: number;
};

const PAGE_SIZE = 25;

const PLATFORMS = ["Facebook", "Instagram", "Linkedin", "Youtube", "Tiktok"];

const CHANNELS: { name: string; icon: JSX.Element }[] = [
    { name: "Facebook", icon: <Facebook size={17} className="text-[#4267B2] dark:text-zinc-400" /> },
    { name: "Instagram", icon: <Instagram size={17} className="text-[#E1306C]" /> },
    { name: "Linkedin", icon: <Linkedin size={17} className="text-[#0077b5] dark:text-zinc-400" /> },
    { name: "Youtube", icon: <Youtube size={17} className="text-[#495057] dark:text-zinc-400" /> },
    { name: "Tiktok", icon: <Music2 size={17} className="text-[#495057] dark:text-zinc-400" /> },
];

function platformIcon(platform: string) {
    switch ((platform || "").toLowerCase()) {
        case "facebook":
            return <Facebook size={16} className="text-[#4267B2]" />;
        case "instagram":
            return <Instagram size={16} className="text-[#E1306C]" />;
        case "linkedin":
            return <Linkedin size={16} className="text-[#0077b5]" />;
        case "youtube":
            return <Youtube size={16} className="text-[#FF0000]" />;
        case "tiktok":
            return <Music2 size={16} className="text-[#495057] dark:text-zinc-400" />;
        default:
            return <Globe size={16} className="text-[#6c757d]" />;
    }
}

function isHttpUrl(value: string): boolean {
    try {
        const u = new URL(value);
        return u.protocol === "http:" || u.protocol === "https:";
    } catch {
        return false;
    }
}

function formatDate(value: string | null): string {
    if (!value) return "—";
    const d = new Date(value);
    if (isNaN(d.getTime())) return "—";
    return d.toLocaleDateString();
}

const emptyChannelDraft = () =>
    CHANNELS.reduce<Record<string, { username: string; url: string }>>((acc, c) => {
        acc[c.name] = { username: "", url: "" };
        return acc;
    }, {});

export default function AllSocialAccountsPage() {
    const { toast } = useToast();

    const [isAddAccountModalOpen, setAddAccountModalOpen] = useState(false);
    const [isAddChannelModalOpen, setAddChannelModalOpen] = useState(false);

    // Filters
    const [searchInput, setSearchInput] = useState("");
    const [searchTerm, setSearchTerm] = useState("");
    const [platformFilter, setPlatformFilter] = useState("all");
    const [statusFilter, setStatusFilter] = useState("all");
    const [verifiedFilter, setVerifiedFilter] = useState("all");
    const [page, setPage] = useState(1);

    // Add New Account form
    const [accOwner, setAccOwner] = useState("");
    const [accPlatform, setAccPlatform] = useState("Facebook");
    const [accName, setAccName] = useState("");
    const [accUrl, setAccUrl] = useState("");
    const [accStatus, setAccStatus] = useState("active");

    // Add New Channel form
    const [channelOwner, setChannelOwner] = useState("");
    const [channelDraft, setChannelDraft] = useState<Record<string, { username: string; url: string }>>(emptyChannelDraft());

    // Edit form
    const [editTarget, setEditTarget] = useState<SocialAccountRow | null>(null);
    const [editOwner, setEditOwner] = useState("");
    const [editPlatform, setEditPlatform] = useState("Facebook");
    const [editName, setEditName] = useState("");
    const [editUrl, setEditUrl] = useState("");
    const [editStatus, setEditStatus] = useState("active");

    useEffect(() => {
        const t = setTimeout(() => {
            setSearchTerm(searchInput);
            setPage(1);
        }, 350);
        return () => clearTimeout(t);
    }, [searchInput]);

    useEffect(() => {
        setPage(1);
    }, [platformFilter, statusFilter, verifiedFilter]);

    const queryParams = new URLSearchParams();
    queryParams.set("page", String(page));
    queryParams.set("pageSize", String(PAGE_SIZE));
    if (searchTerm.trim()) queryParams.set("search", searchTerm.trim());
    if (platformFilter !== "all") queryParams.set("platform", platformFilter);
    if (statusFilter !== "all") queryParams.set("status", statusFilter);
    if (verifiedFilter !== "all") queryParams.set("is_verified", verifiedFilter === "verified" ? "true" : "false");
    const queryString = queryParams.toString();

    const { data: response, isLoading } = useQuery<SocialAccountsResponse>({
        queryKey: ["/api/drm/social-accounts", queryString],
        queryFn: () => apiRequestJson<SocialAccountsResponse>("GET", `/api/drm/social-accounts?${queryString}`),
    });

    const rows = response?.data ?? [];
    const total = response?.total ?? 0;
    const totalPages = total > 0 ? Math.ceil(total / PAGE_SIZE) : 1;
    const startEntry = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
    const endEntry = total === 0 ? 0 : Math.min(page * PAGE_SIZE, total);

    const invalidate = () => {
        queryClient.invalidateQueries({ queryKey: ["/api/drm/social-accounts"] });
    };

    const createMutation = useMutation({
        mutationFn: (payload: Record<string, unknown>) =>
            apiRequestJson("POST", "/api/drm/social-accounts", payload),
        onError: (err: any) => {
            toast({ title: "Failed to add account", description: err?.message, variant: "destructive" });
        },
    });

    const updateMutation = useMutation({
        mutationFn: (vars: { id: string; payload: Record<string, unknown> }) =>
            apiRequestJson("PATCH", `/api/drm/social-accounts/${vars.id}`, vars.payload),
        onError: (err: any) => {
            toast({ title: "Failed to update account", description: err?.message, variant: "destructive" });
        },
    });

    const verifyMutation = useMutation({
        mutationFn: (id: string) => apiRequestJson("PATCH", `/api/drm/social-accounts/${id}/verify`),
        onSuccess: () => {
            toast({ title: "Account verified" });
            invalidate();
        },
        onError: (err: any) => {
            toast({ title: "Failed to verify", description: err?.message, variant: "destructive" });
        },
    });

    const deleteMutation = useMutation({
        mutationFn: (id: string) => apiRequestJson("DELETE", `/api/drm/social-accounts/${id}`),
        onSuccess: () => {
            toast({ title: "Account deleted" });
            invalidate();
        },
        onError: (err: any) => {
            toast({ title: "Failed to delete", description: err?.message, variant: "destructive" });
        },
    });

    const handleAddAccount = async () => {
        if (!accPlatform.trim()) {
            toast({ title: "Platform is required", variant: "destructive" });
            return;
        }
        if (accUrl.trim() && !isHttpUrl(accUrl.trim())) {
            toast({ title: "URL must be a valid http(s) URL", variant: "destructive" });
            return;
        }
        try {
            await createMutation.mutateAsync({
                ownerName: accOwner.trim() || undefined,
                platform: accPlatform.trim(),
                accountName: accName.trim() || undefined,
                url: accUrl.trim() || undefined,
                status: accStatus,
            });
            toast({ title: "Account added" });
            setAddAccountModalOpen(false);
            setAccOwner("");
            setAccPlatform("Facebook");
            setAccName("");
            setAccUrl("");
            setAccStatus("active");
            invalidate();
        } catch {
            /* handled in onError */
        }
    };

    const handleAddChannel = async () => {
        const entries = CHANNELS.map((c) => ({
            platform: c.name,
            username: channelDraft[c.name]?.username.trim() ?? "",
            url: channelDraft[c.name]?.url.trim() ?? "",
        })).filter((e) => e.username || e.url);

        if (entries.length === 0) {
            toast({ title: "Add at least one channel profile", variant: "destructive" });
            return;
        }
        const invalid = entries.find((e) => e.url && !isHttpUrl(e.url));
        if (invalid) {
            toast({ title: `${invalid.platform} URL must be a valid http(s) URL`, variant: "destructive" });
            return;
        }
        try {
            for (const e of entries) {
                await createMutation.mutateAsync({
                    ownerName: channelOwner.trim() || undefined,
                    platform: e.platform,
                    accountName: e.username || undefined,
                    url: e.url || undefined,
                    status: "active",
                });
            }
            toast({ title: `${entries.length} channel${entries.length > 1 ? "s" : ""} added` });
            setAddChannelModalOpen(false);
            setChannelOwner("");
            setChannelDraft(emptyChannelDraft());
            invalidate();
        } catch {
            /* handled in onError */
        }
    };

    const openEdit = (row: SocialAccountRow) => {
        setEditTarget(row);
        setEditOwner(row.ownerName ?? "");
        setEditPlatform(row.platform ?? "Facebook");
        setEditName(row.accountName ?? "");
        setEditUrl(row.url ?? "");
        setEditStatus(row.status ?? "active");
    };

    const handleEditSave = async () => {
        if (!editTarget) return;
        if (!editPlatform.trim()) {
            toast({ title: "Platform is required", variant: "destructive" });
            return;
        }
        if (editUrl.trim() && !isHttpUrl(editUrl.trim())) {
            toast({ title: "URL must be a valid http(s) URL", variant: "destructive" });
            return;
        }
        try {
            await updateMutation.mutateAsync({
                id: editTarget.id,
                payload: {
                    ownerName: editOwner.trim() || null,
                    platform: editPlatform.trim(),
                    accountName: editName.trim() || null,
                    url: editUrl.trim() || null,
                    status: editStatus,
                },
            });
            toast({ title: "Account updated" });
            setEditTarget(null);
            invalidate();
        } catch {
            /* handled in onError */
        }
    };

    const handleToggleStatus = async (row: SocialAccountRow) => {
        const next = row.status === "active" ? "inactive" : "active";
        try {
            await updateMutation.mutateAsync({ id: row.id, payload: { status: next } });
            toast({ title: next === "active" ? "Account activated" : "Account deactivated" });
            invalidate();
        } catch {
            /* handled in onError */
        }
    };

    return (
        <div className="p-6 bg-[#f8f9fa] min-h-[calc(100vh-60px)] dark:bg-zinc-950">
            <h1 className="text-[15px] font-bold text-[#495057] tracking-wide uppercase mb-4 dark:text-zinc-400">
                All Social Accounts
            </h1>

            <div className="mb-6 flex flex-wrap items-center gap-3">
                <Button
                    className="bg-[#00a65a] hover:bg-[#008d4c] text-white px-4 text-[13px] font-medium tracking-wide h-9 shadow-sm rounded-sm"
                    onClick={() => setAddAccountModalOpen(true)}
                    data-testid="button-add-account"
                >
                    Add New Account
                </Button>
                <Button
                    variant="outline"
                    className="px-4 text-[13px] font-medium tracking-wide h-9 shadow-sm rounded-sm"
                    onClick={() => setAddChannelModalOpen(true)}
                    data-testid="button-add-channel"
                >
                    Add New Channel
                </Button>

                <div className="flex flex-wrap items-center gap-2 ml-auto">
                    <Select value={platformFilter} onValueChange={setPlatformFilter}>
                        <SelectTrigger className="h-9 w-36 text-[13px]" data-testid="select-platform-filter">
                            <SelectValue placeholder="Platform" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Platforms</SelectItem>
                            {PLATFORMS.map((p) => (
                                <SelectItem key={p} value={p}>{p}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                        <SelectTrigger className="h-9 w-32 text-[13px]" data-testid="select-status-filter">
                            <SelectValue placeholder="Status" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Status</SelectItem>
                            <SelectItem value="active">Active</SelectItem>
                            <SelectItem value="inactive">Inactive</SelectItem>
                        </SelectContent>
                    </Select>
                    <Select value={verifiedFilter} onValueChange={setVerifiedFilter}>
                        <SelectTrigger className="h-9 w-36 text-[13px]" data-testid="select-verified-filter">
                            <SelectValue placeholder="Verification" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All</SelectItem>
                            <SelectItem value="verified">Verified</SelectItem>
                            <SelectItem value="unverified">Unverified</SelectItem>
                        </SelectContent>
                    </Select>
                    <Input
                        placeholder="Search"
                        value={searchInput}
                        onChange={(e) => setSearchInput(e.target.value)}
                        className="h-9 w-48 text-[13px]"
                        data-testid="input-search"
                    />
                </div>
            </div>

            {/* Table Area */}
            <div className="w-full bg-white shadow-sm border border-gray-100 rounded-sm overflow-hidden dark:bg-zinc-900 dark:border-zinc-800">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="border-b border-gray-100 dark:border-zinc-800" style={{ backgroundColor: "#e2f2e7" }}>
                            <th className="px-4 py-3 text-[13px] font-bold text-[#212529] dark:text-zinc-100">S.No</th>
                            <th className="px-4 py-3 text-[13px] font-bold text-[#212529] dark:text-zinc-100">Owner</th>
                            <th className="px-4 py-3 text-[13px] font-bold text-[#212529] dark:text-zinc-100">Platform</th>
                            <th className="px-4 py-3 text-[13px] font-bold text-[#212529] dark:text-zinc-100">Account</th>
                            <th className="px-4 py-3 text-[13px] font-bold text-[#212529] dark:text-zinc-100">URL</th>
                            <th className="px-4 py-3 text-[13px] font-bold text-[#212529] dark:text-zinc-100">Status</th>
                            <th className="px-4 py-3 text-[13px] font-bold text-[#212529] dark:text-zinc-100">Verified</th>
                            <th className="px-4 py-3 text-[13px] font-bold text-[#212529] dark:text-zinc-100">Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        {isLoading ? (
                            <tr>
                                <td colSpan={8} className="px-4 py-6 text-center text-[13px] text-[#6c757d] dark:text-zinc-400">
                                    Loading...
                                </td>
                            </tr>
                        ) : rows.length === 0 ? (
                            <tr>
                                <td colSpan={8} className="px-4 py-6 text-center text-[13px] text-[#6c757d] dark:text-zinc-400">
                                    No data available in table
                                </td>
                            </tr>
                        ) : (
                            rows.map((row, idx) => (
                                <tr
                                    key={row.id}
                                    className="border-b border-gray-50 hover:bg-gray-50 transition-colors dark:hover:bg-zinc-800 dark:border-zinc-800"
                                    data-testid={`row-social-${row.id}`}
                                >
                                    <td className="px-4 py-4 text-[13px] text-[#212529] font-medium dark:text-zinc-100">{startEntry + idx}</td>
                                    <td className="px-4 py-4 text-[13px] text-[#495057] dark:text-zinc-400">{row.ownerName ?? "—"}</td>
                                    <td className="px-4 py-4 text-[13px] text-[#495057] dark:text-zinc-400">
                                        <div className="flex items-center gap-1.5">
                                            {platformIcon(row.platform)}
                                            <span className="capitalize">{row.platform || "—"}</span>
                                        </div>
                                    </td>
                                    <td className="px-4 py-4 text-[13px] text-[#495057] dark:text-zinc-400">{row.accountName ?? "—"}</td>
                                    <td className="px-4 py-4 text-[13px] text-[#495057] dark:text-zinc-400 max-w-[220px] truncate">
                                        {row.url ? (
                                            <a href={row.url} target="_blank" rel="noreferrer" className="text-[#00a65a] hover:underline">
                                                {row.url}
                                            </a>
                                        ) : (
                                            "—"
                                        )}
                                    </td>
                                    <td className="px-4 py-4 text-[13px]">
                                        <span
                                            className={`px-2 py-0.5 rounded-[4px] text-[12px] font-bold ${
                                                row.status === "active"
                                                    ? "bg-[#d1fae5] text-[#059669] dark:bg-emerald-900/40 dark:text-emerald-300"
                                                    : "bg-slate-200 text-slate-600 dark:bg-zinc-800 dark:text-zinc-300"
                                            }`}
                                        >
                                            {row.status === "active" ? "Active" : "Inactive"}
                                        </span>
                                    </td>
                                    <td className="px-4 py-4 text-[13px]">
                                        {row.isVerified ? (
                                            <span className="inline-flex items-center gap-1 text-[#059669] dark:text-emerald-300 font-medium">
                                                <BadgeCheck size={15} /> Yes
                                            </span>
                                        ) : (
                                            <span className="text-[#6c757d] dark:text-zinc-500">No</span>
                                        )}
                                    </td>
                                    <td className="px-4 py-4 text-[13px]">
                                        <div className="flex items-center gap-3">
                                            {!row.isVerified && (
                                                <BadgeCheck
                                                    size={17}
                                                    className="text-[#00a65a] cursor-pointer hover:scale-110 transition-transform"
                                                    onClick={() => verifyMutation.mutate(row.id)}
                                                    data-testid={`button-verify-${row.id}`}
                                                />
                                            )}
                                            <Pencil
                                                size={16}
                                                className="text-[#3498db] cursor-pointer hover:scale-110 transition-transform"
                                                onClick={() => openEdit(row)}
                                                data-testid={`button-edit-${row.id}`}
                                            />
                                            <Power
                                                size={16}
                                                className={`cursor-pointer hover:scale-110 transition-transform ${
                                                    row.status === "active" ? "text-[#f39c12]" : "text-[#95a5a6]"
                                                }`}
                                                onClick={() => handleToggleStatus(row)}
                                                data-testid={`button-toggle-${row.id}`}
                                            />
                                            <Trash2
                                                size={17}
                                                className="text-[#e74c3c] cursor-pointer hover:scale-110 transition-transform"
                                                onClick={() => {
                                                    if (window.confirm("Delete this social account?")) deleteMutation.mutate(row.id);
                                                }}
                                                data-testid={`button-delete-${row.id}`}
                                            />
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>

                {/* Pagination footer */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 border-t border-gray-100 dark:border-zinc-800">
                    <span className="text-[13px] text-[#6c757d] dark:text-zinc-400">
                        Showing {startEntry} to {endEntry} of {total} entries
                    </span>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            className="h-8 px-3 text-[13px]"
                            disabled={page <= 1}
                            onClick={() => setPage((p) => Math.max(1, p - 1))}
                            data-testid="button-prev-page"
                        >
                            Previous
                        </Button>
                        <span className="text-[13px] text-[#495057] dark:text-zinc-300">
                            Page {page} of {totalPages}
                        </span>
                        <Button
                            variant="outline"
                            className="h-8 px-3 text-[13px]"
                            disabled={page >= totalPages}
                            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                            data-testid="button-next-page"
                        >
                            Next
                        </Button>
                    </div>
                </div>
            </div>

            {/* Add New Account Modal */}
            <Dialog open={isAddAccountModalOpen} onOpenChange={setAddAccountModalOpen}>
                <DialogContent className="max-w-[450px] p-0 flex flex-col gap-0 overflow-hidden bg-white rounded-md dark:bg-zinc-900">
                    <DialogHeader className="p-4 border-b border-gray-100 bg-white dark:bg-zinc-900 dark:border-zinc-800">
                        <DialogTitle className="text-[17px] font-semibold text-[#495057] dark:text-zinc-400">
                            Add New Account
                        </DialogTitle>
                    </DialogHeader>

                    <div className="p-6 space-y-5">
                        <div className="space-y-1.5 flex flex-col">
                            <Label className="text-[14px] font-semibold text-[#495057] dark:text-zinc-400">Owner Name:</Label>
                            <Input
                                className="h-10 shadow-sm text-[13px] font-medium"
                                value={accOwner}
                                onChange={(e) => setAccOwner(e.target.value)}
                                data-testid="input-account-owner"
                            />
                        </div>

                        <div className="space-y-1.5 flex flex-col">
                            <Label className="text-[14px] font-semibold text-[#495057] dark:text-zinc-400">Platform:</Label>
                            <Select value={accPlatform} onValueChange={setAccPlatform}>
                                <SelectTrigger className="h-10 w-full text-[13px] text-gray-600 shadow-sm dark:text-zinc-300" data-testid="select-account-platform">
                                    <SelectValue placeholder="Select" />
                                </SelectTrigger>
                                <SelectContent>
                                    {PLATFORMS.map((p) => (
                                        <SelectItem key={p} value={p}>{p}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-1.5 flex flex-col">
                            <Label className="text-[14px] font-semibold text-[#495057] dark:text-zinc-400">Account Name:</Label>
                            <Input
                                className="h-10 shadow-sm text-[13px] font-medium"
                                value={accName}
                                onChange={(e) => setAccName(e.target.value)}
                                data-testid="input-account-name"
                            />
                        </div>

                        <div className="space-y-1.5 flex flex-col">
                            <Label className="text-[14px] font-semibold text-[#495057] dark:text-zinc-400">Account URL:</Label>
                            <Input
                                className="h-10 shadow-sm text-[13px] font-medium"
                                placeholder="https://..."
                                value={accUrl}
                                onChange={(e) => setAccUrl(e.target.value)}
                                data-testid="input-account-url"
                            />
                        </div>

                        <div className="space-y-1.5 flex flex-col">
                            <Label className="text-[14px] font-semibold text-[#495057] dark:text-zinc-400">Status:</Label>
                            <Select value={accStatus} onValueChange={setAccStatus}>
                                <SelectTrigger className="h-10 w-full text-[13px] text-gray-600 shadow-sm dark:text-zinc-300" data-testid="select-account-status">
                                    <SelectValue placeholder="Select" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="active">Active</SelectItem>
                                    <SelectItem value="inactive">Inactive</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="flex items-center justify-end p-4 border-t border-gray-100 bg-white gap-3 dark:bg-zinc-900 dark:border-zinc-800">
                        <Button
                            variant="secondary"
                            className="bg-[#f0f2f5] hover:bg-gray-200 text-gray-800 px-5 font-medium shadow-none h-9 text-[13px] dark:text-zinc-100 dark:bg-zinc-900"
                            onClick={() => setAddAccountModalOpen(false)}
                        >
                            Close
                        </Button>
                        <Button
                            className="bg-[#00a65a] hover:bg-[#008d4c] text-white px-6 font-medium shadow-none h-9 text-[13px]"
                            onClick={handleAddAccount}
                            disabled={createMutation.isPending}
                            data-testid="button-save-account"
                        >
                            {createMutation.isPending ? "Saving..." : "Save"}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Add New Channel Modal */}
            <Dialog open={isAddChannelModalOpen} onOpenChange={setAddChannelModalOpen}>
                <DialogContent className="max-w-[550px] p-0 flex flex-col gap-0 overflow-hidden bg-white rounded-md dark:bg-zinc-900">
                    <DialogHeader className="p-4 border-b border-gray-100 bg-white dark:bg-zinc-900 dark:border-zinc-800">
                        <DialogTitle className="text-[17px] font-semibold text-[#495057] dark:text-zinc-400">
                            Add New Channel
                        </DialogTitle>
                    </DialogHeader>

                    <div className="p-6 space-y-4 overflow-y-auto max-h-[75vh]">
                        <div className="space-y-1.5 flex flex-col">
                            <Label className="text-[14px] font-semibold text-[#495057] dark:text-zinc-400">Owner:</Label>
                            <Input
                                value={channelOwner}
                                onChange={(e) => setChannelOwner(e.target.value)}
                                placeholder="Owner name"
                                className="h-10 text-[13px] shadow-sm font-medium"
                                data-testid="input-channel-owner"
                            />
                        </div>

                        {CHANNELS.map((social, idx) => (
                            <div key={idx} className="flex flex-col md:flex-row gap-4 items-start w-full mt-3">
                                <div className="space-y-1.5 w-full">
                                    <Label className="text-[13px] font-semibold text-[#495057] dark:text-zinc-400">{social.name} Profile:</Label>
                                    <div className="flex rounded-md border border-gray-300 overflow-hidden focus-within:border-blue-400 focus-within:ring-1 focus-within:ring-blue-400 transition-colors bg-white dark:bg-zinc-900 dark:border-zinc-800">
                                        <div className="flex items-center justify-center w-11 bg-[#f4f6f9] border-r border-gray-300 shrink-0 dark:border-zinc-800 dark:bg-zinc-900">
                                            {social.icon}
                                        </div>
                                        <Input
                                            className="flex-1 border-0 rounded-none h-9 shadow-none focus-visible:ring-0 px-3 text-[13px]"
                                            placeholder="Username"
                                            value={channelDraft[social.name]?.username ?? ""}
                                            onChange={(e) =>
                                                setChannelDraft((prev) => ({
                                                    ...prev,
                                                    [social.name]: { ...prev[social.name], username: e.target.value },
                                                }))
                                            }
                                            data-testid={`input-channel-username-${social.name.toLowerCase()}`}
                                        />
                                    </div>
                                </div>

                                <div className="space-y-1.5 w-full">
                                    <Label className="text-[13px] font-semibold text-[#495057] dark:text-zinc-400">{social.name} Url:</Label>
                                    <div className="flex rounded-md border border-gray-300 overflow-hidden focus-within:border-blue-400 focus-within:ring-1 focus-within:ring-blue-400 transition-colors bg-white dark:bg-zinc-900 dark:border-zinc-800">
                                        <div className="flex items-center justify-center w-11 bg-[#f4f6f9] border-r border-gray-300 shrink-0 dark:border-zinc-800 dark:bg-zinc-900">
                                            <LinkIcon size={16} className="text-[#4267B2] dark:text-zinc-400" />
                                        </div>
                                        <Input
                                            className="flex-1 border-0 rounded-none h-9 shadow-none focus-visible:ring-0 px-3 text-[13px]"
                                            placeholder="Profile link"
                                            value={channelDraft[social.name]?.url ?? ""}
                                            onChange={(e) =>
                                                setChannelDraft((prev) => ({
                                                    ...prev,
                                                    [social.name]: { ...prev[social.name], url: e.target.value },
                                                }))
                                            }
                                            data-testid={`input-channel-url-${social.name.toLowerCase()}`}
                                        />
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="flex items-center justify-end p-4 border-t border-gray-100 bg-white gap-3 dark:bg-zinc-900 dark:border-zinc-800">
                        <Button
                            variant="secondary"
                            className="bg-[#f0f2f5] hover:bg-gray-200 text-gray-800 px-5 font-medium shadow-none h-9 text-[13px] dark:text-zinc-100 dark:bg-zinc-900"
                            onClick={() => setAddChannelModalOpen(false)}
                        >
                            Close
                        </Button>
                        <Button
                            className="bg-[#00a65a] hover:bg-[#008d4c] text-white px-6 font-medium shadow-none h-9 text-[13px]"
                            onClick={handleAddChannel}
                            disabled={createMutation.isPending}
                            data-testid="button-save-channel"
                        >
                            {createMutation.isPending ? "Saving..." : "Save"}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Edit Account Modal */}
            <Dialog open={!!editTarget} onOpenChange={(open) => { if (!open) setEditTarget(null); }}>
                <DialogContent className="max-w-[450px] p-0 flex flex-col gap-0 overflow-hidden bg-white rounded-md dark:bg-zinc-900">
                    <DialogHeader className="p-4 border-b border-gray-100 bg-white dark:bg-zinc-900 dark:border-zinc-800">
                        <DialogTitle className="text-[17px] font-semibold text-[#495057] dark:text-zinc-400">
                            Edit Account
                        </DialogTitle>
                    </DialogHeader>

                    <div className="p-6 space-y-5">
                        <div className="space-y-1.5 flex flex-col">
                            <Label className="text-[14px] font-semibold text-[#495057] dark:text-zinc-400">Owner Name:</Label>
                            <Input
                                className="h-10 shadow-sm text-[13px] font-medium"
                                value={editOwner}
                                onChange={(e) => setEditOwner(e.target.value)}
                                data-testid="input-edit-owner"
                            />
                        </div>

                        <div className="space-y-1.5 flex flex-col">
                            <Label className="text-[14px] font-semibold text-[#495057] dark:text-zinc-400">Platform:</Label>
                            <Select value={editPlatform} onValueChange={setEditPlatform}>
                                <SelectTrigger className="h-10 w-full text-[13px] text-gray-600 shadow-sm dark:text-zinc-300" data-testid="select-edit-platform">
                                    <SelectValue placeholder="Select" />
                                </SelectTrigger>
                                <SelectContent>
                                    {PLATFORMS.map((p) => (
                                        <SelectItem key={p} value={p}>{p}</SelectItem>
                                    ))}
                                    {editTarget && !PLATFORMS.includes(editTarget.platform) && editTarget.platform && (
                                        <SelectItem value={editTarget.platform}>{editTarget.platform}</SelectItem>
                                    )}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-1.5 flex flex-col">
                            <Label className="text-[14px] font-semibold text-[#495057] dark:text-zinc-400">Account Name:</Label>
                            <Input
                                className="h-10 shadow-sm text-[13px] font-medium"
                                value={editName}
                                onChange={(e) => setEditName(e.target.value)}
                                data-testid="input-edit-name"
                            />
                        </div>

                        <div className="space-y-1.5 flex flex-col">
                            <Label className="text-[14px] font-semibold text-[#495057] dark:text-zinc-400">Account URL:</Label>
                            <Input
                                className="h-10 shadow-sm text-[13px] font-medium"
                                placeholder="https://..."
                                value={editUrl}
                                onChange={(e) => setEditUrl(e.target.value)}
                                data-testid="input-edit-url"
                            />
                        </div>

                        <div className="space-y-1.5 flex flex-col">
                            <Label className="text-[14px] font-semibold text-[#495057] dark:text-zinc-400">Status:</Label>
                            <Select value={editStatus} onValueChange={setEditStatus}>
                                <SelectTrigger className="h-10 w-full text-[13px] text-gray-600 shadow-sm dark:text-zinc-300" data-testid="select-edit-status">
                                    <SelectValue placeholder="Select" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="active">Active</SelectItem>
                                    <SelectItem value="inactive">Inactive</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="flex items-center justify-end p-4 border-t border-gray-100 bg-white gap-3 dark:bg-zinc-900 dark:border-zinc-800">
                        <Button
                            variant="secondary"
                            className="bg-[#f0f2f5] hover:bg-gray-200 text-gray-800 px-5 font-medium shadow-none h-9 text-[13px] dark:text-zinc-100 dark:bg-zinc-900"
                            onClick={() => setEditTarget(null)}
                        >
                            Close
                        </Button>
                        <Button
                            className="bg-[#00a65a] hover:bg-[#008d4c] text-white px-6 font-medium shadow-none h-9 text-[13px]"
                            onClick={handleEditSave}
                            disabled={updateMutation.isPending}
                            data-testid="button-save-edit"
                        >
                            {updateMutation.isPending ? "Saving..." : "Save"}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
