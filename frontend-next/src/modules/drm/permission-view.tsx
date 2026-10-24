"use client";


import React, { useState } from 'react';
import {
    Users,
    Shield,
    TrendingUp,
    CalendarCheck,
    Trash2,
    Edit,
    User,
    Home,
    CheckCircle2,
    Settings,
    DollarSign,
    Briefcase,
    Target,
    FileText,
    Server,
    ClipboardList,
    Image as ImageIcon,
    Database,
    Bell,
    ShieldAlert,
    PartyPopper,
    Video,
    Share2,
    Loader2,
    Plus,
    X,
    ChevronDown,
    ChevronUp,
    BarChart3,
    PieChart,
    Activity,
    Book,
    RotateCcw,
    LayoutDashboard,
    FileSearch,
    Headset,
    Ticket,
    History,
    Megaphone,
} from 'lucide-react';
import {
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
} from "@/components/ui/legacy/tabs";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { DrmFormActions, DrmSection, drmFieldClass } from "@/modules/drm/drm-ui";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/legacy/select";
import { Switch } from "@/components/ui/legacy/switch";
import { Badge } from "@/components/ui/legacy/badge";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/query/query-client";
import { useToast } from "@/lib/hooks/use-legacy-toast";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/legacy/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

// ─── Icon Mapping ───────────────────────────────────────────────
const iconMap: Record<string, any> = {
    Users, CalendarCheck, TrendingUp, Settings, DollarSign,
    Briefcase, Target, FileText, Server, ClipboardList,
    Image: ImageIcon, Database, Bell, ShieldAlert, PartyPopper,
    Video, Shield, Share2, Home, BarChart3, PieChart, Activity,
    Book, RotateCcw, LayoutDashboard, FileSearch, Headset,
    Ticket, History, Megaphone,
};

const ICON_OPTIONS = Object.keys(iconMap);

// ─── Department badge colours ────────────────────────────────────
const DEPT_COLORS: Record<string, string> = {
    admin: 'bg-gray-200 text-gray-800 dark:text-slate-200',
    sales: 'bg-blue-100 text-blue-800',
    service: 'bg-purple-100 text-purple-800',
    reception: 'bg-pink-100 text-pink-800',
    project: 'bg-yellow-100 text-yellow-800',
    seo: 'bg-orange-100 text-orange-800',
    product: 'bg-green-100 text-green-800',
    account: 'bg-teal-100 text-teal-800',
    it: 'bg-indigo-100 text-indigo-800',
    qa: 'bg-red-100 text-red-800',
    hod: 'bg-amber-100 text-amber-800',
    internship: 'bg-lime-100 text-lime-800',
    lead: 'bg-sky-100 text-sky-800',
    verification: 'bg-violet-100 text-violet-800',
    complaint: 'bg-rose-100 text-rose-800',
    marketing: 'bg-fuchsia-100 text-fuchsia-800',
    media: 'bg-cyan-100 text-cyan-800',
    software: 'bg-emerald-100 text-emerald-800',
    trade: 'bg-stone-100 text-stone-800',
    web: 'bg-blue-200 text-blue-900',
    customer: 'bg-indigo-100 text-indigo-800',
    attendance: 'bg-amber-100 text-amber-800',
    pms: 'bg-emerald-100 text-emerald-800',
    training: 'bg-orange-100 text-orange-800',
    reports: 'bg-rose-100 text-rose-800',
    default: 'bg-gray-100 text-gray-700',
};

function deptColor(name: string): string {
    const n = name.toLowerCase();
    for (const key of Object.keys(DEPT_COLORS)) {
        if (n.includes(key)) return DEPT_COLORS[key];
    }
    return DEPT_COLORS.default;
}

// ─── Pre-defined department list for add form ────────────────────
const ALL_DEPARTMENTS = [
    'Admin', 'Sales Department', 'Service Department', 'Reception Department',
    'Project Department', 'SEO/SMM Department', 'Product Posting',
    'D&D Department', 'Accounts Department', 'Internship & Trainee',
    'IT Department', 'Web Excels', 'QA Department', 'Lead Department',
    'Verification Department', 'Complaint Department', 'Marketing Department',
    'Media Department', 'Head of Department', 'Software Department',
    'Trade Assurance', 'Customer', 'Attendance', 'PMS', 'LEAD', 'Training', 'User Reports',
];

// ─── Types ───────────────────────────────────────────────────────
interface PermissionRow {
    id: string;
    path: string;
    name: string;
    menuIcon: string;
    permissions: { name: string; type: string }[];
    subUrls: { isRoot: boolean; items: string[] };
    allowedRoleIds: string[];
    isActive: boolean;
}

// ─── Main Page ───────────────────────────────────────────────────
export function PermissionPage() {
    const { toast } = useToast();
    const queryClient = useQueryClient();

    // ── search
    const [searchTerm, setSearchTerm] = useState('');

    // ── add-permission form
    const [isAddPermOpen, setIsAddPermOpen] = useState(false);
    const [menuHead, setMenuHead] = useState('');
    const [menuIconPath, setMenuIconPath] = useState('Home');

    // ── add-sub-url form
    const [isAddSubOpen, setIsAddSubOpen] = useState(false);
    const [selectedPermId, setSelectedPermId] = useState('');
    const [subUrlTitle, setSubUrlTitle] = useState('');
    const [subUrlPath, setSubUrlPath] = useState('');

    // ── edit dialog
    const [editTarget, setEditTarget] = useState<PermissionRow | null>(null);
    const [editName, setEditName] = useState('');
    const [editIcon, setEditIcon] = useState('Home');
    const [editDepts, setEditDepts] = useState<string[]>([]);      // department badges
    const [editSubUrls, setEditSubUrls] = useState<string[]>([]);  // sub-url chips
    const [editRoleIds, setEditRoleIds] = useState<string[]>([]);  // allowed role ids
    const [newSubUrl, setNewSubUrl] = useState('');
    const [newRoleId, setNewRoleId] = useState('');

    // ── data
    const { data: permissions, isLoading } = useQuery<PermissionRow[]>({
        queryKey: ['/api/drm/permissions'],
        queryFn: async () => {
            const res = await apiRequest("GET", "/api/drm/permissions");
            return await res.json();
        }
    });

    // ── fetch dynamic roles list
    const { data: rolesList } = useQuery<{ id: string; name: string }[]>({
        queryKey: ['/api/settings/roles'],
    });

    // ── mutations
    const createPermMutation = useMutation({
        mutationFn: async () => {
            const res = await apiRequest('POST', '/api/drm/permissions', { name: menuHead, menuIcon: menuIconPath });
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['/api/drm/permissions'] });
            toast({ title: 'Success', description: 'Permission created' });
            setMenuHead(''); setMenuIconPath('Home'); setIsAddPermOpen(false);
        },
        onError: () => toast({ title: 'Error', description: 'Failed to create permission', variant: 'destructive' }),
    });

    const addSubUrlMutation = useMutation({
        mutationFn: async () => {
            const res = await apiRequest('POST', `/api/drm/permissions/${selectedPermId}/sub-urls`, { url: subUrlPath, title: subUrlTitle });
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['/api/drm/permissions'] });
            toast({ title: 'Success', description: 'Sub-URL added' });
            setSubUrlPath(''); setSubUrlTitle(''); setSelectedPermId(''); setIsAddSubOpen(false);
        },
        onError: () => toast({ title: 'Error', description: 'Failed to add sub-URL', variant: 'destructive' }),
    });

    const toggleMutation = useMutation({
        mutationFn: async (id: string) => {
            const res = await apiRequest('PUT', `/api/drm/permissions/${id}/toggle`);
            return res.json();
        },
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['/api/drm/permissions'] }),
        onError: () => toast({ title: 'Error', description: 'Failed to toggle status', variant: 'destructive' }),
    });

    const deleteMutation = useMutation({
        mutationFn: async (id: string) => { await apiRequest('DELETE', `/api/drm/permissions/${id}`); },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['/api/drm/permissions'] });
            toast({ title: 'Deleted', description: 'Permission removed' });
        },
        onError: () => toast({ title: 'Error', description: 'Failed to delete', variant: 'destructive' }),
    });

    const editMutation = useMutation({
        mutationFn: async () => {
            if (!editTarget) return;
            const res = await apiRequest('PUT', `/api/drm/permissions/${editTarget.id}`, {
                name: editName,
                menuIcon: editIcon,
                permissions: editDepts.map(d => ({ name: d, type: 'default' })),
                subUrls: { isRoot: true, items: editSubUrls },
                allowedRoleIds: editRoleIds,
            });
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['/api/drm/permissions'] });
            toast({ title: 'Updated', description: 'Permission updated successfully' });
            setEditTarget(null);
        },
        onError: () => toast({ title: 'Error', description: 'Failed to update permission', variant: 'destructive' }),
    });

    // ── open edit dialog
    const openEdit = (row: PermissionRow) => {
        setEditTarget(row);
        setEditName(row.name);
        setEditIcon(row.menuIcon || 'Home');
        setEditDepts((row.permissions || []).map((p: any) => p.name));
        setEditSubUrls(row.subUrls?.items || []);
        setEditRoleIds(row.allowedRoleIds || []);
        setNewSubUrl('');
        setNewRoleId('');
    };

    if (isLoading) {
        return <div className="flex justify-center items-center min-h-screen"><Loader2 className="w-8 h-8 animate-spin text-[#00a65a] dark:text-zinc-400" /></div>;
    }

    const matchesSearch = (row: PermissionRow) => {
        const q = searchTerm.trim().toLowerCase();
        if (!q) return true;
        if (row.name.toLowerCase().includes(q)) return true;
        if ((row.permissions || []).some(p => p.name.toLowerCase().includes(q))) return true;
        if ((row.allowedRoleIds || []).some(r => r.toLowerCase().includes(q))) return true;
        if (((row.subUrls as any)?.items || []).some((u: string) => u.toLowerCase().includes(q))) return true;
        return false;
    };
    const searchedPermissions = permissions?.filter(matchesSearch) || [];
    const reportModules = searchedPermissions.filter(p => p.name.toLowerCase().includes('report'));
    const coreModules = searchedPermissions.filter(p => !p.name.toLowerCase().includes('report'));

    const renderRows = (data: PermissionRow[] | undefined) => {
        if (!data || data.length === 0) {
            return (
                <tr>
                    <td colSpan={7} className="text-center py-12 text-gray-400">
                        No permissions found.
                    </td>
                </tr>
            );
        }
        return data.map((row) => {
            const Icon = iconMap[row.menuIcon] || Home;
            const depts: { name: string; type: string }[] = Array.isArray(row.permissions) ? row.permissions : [];
            const subItems: string[] = (row.subUrls as any)?.items || [];
            const roleIds: string[] = row.allowedRoleIds || [];

            return (
                <tr key={row.id} className="hover:bg-gray-50 transition-colors align-top dark:hover:bg-zinc-800">
                    {/* ── checkbox ── */}
                    <td className="px-5 py-4">
                        <input type="checkbox" className="rounded border-gray-300 text-[#00a65a] dark:border-zinc-800 dark:text-zinc-400" />
                    </td>
                    {/* ── Menu ── */}
                    <td className="px-5 py-4">
                        <div className="flex items-center gap-2 text-gray-800 font-medium dark:text-zinc-100">
                            <Icon className="w-4 h-4 text-gray-500 shrink-0 dark:text-zinc-400" />
                            <span>{row.name}</span>
                        </div>
                    </td>
                    {/* ── Permission (department badges) ── */}
                    <td className="px-5 py-4">
                        <div className="flex flex-wrap gap-1.5 items-start">
                            <Home className="w-3.5 h-3.5 text-gray-400 mt-0.5 mr-0.5 shrink-0" />
                            {depts.length === 0 && (
                                <span className="text-gray-400 text-xs italic">No departments</span>
                            )}
                            {depts.map((d, i) => (
                                <span
                                    key={i}
                                    className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${deptColor(d.name)}`}
                                >
                                    {d.name}
                                </span>
                            ))}
                        </div>
                    </td>
                    {/* ── Sub-Url ── */}
                    <td className="px-5 py-4">
                        <div className="flex flex-wrap gap-1.5 items-center">
                            {subItems.length === 0 ? (
                                <span className="text-gray-400 text-xs italic">No sub-URLs</span>
                            ) : (
                                <>
                                    <span className="text-gray-500 text-xs font-medium whitespace-nowrap dark:text-zinc-400">
                                        {row.name} →
                                    </span>
                                    {subItems.map((item, i) => (
                                        <span
                                            key={i}
                                            className="inline-block rounded-full px-2.5 py-0.5 text-xs font-medium bg-[#e4f6ec] text-[#00a65a] dark:bg-zinc-900 dark:text-zinc-400"
                                        >
                                            {item}
                                        </span>
                                    ))}
                                </>
                            )}
                        </div>
                    </td>
                    {/* ── Allowed Roles ── */}
                    <td className="px-5 py-4">
                        <div className="flex items-center gap-1.5 flex-wrap">
                            <User className="w-4 h-4 text-gray-400 shrink-0" />
                            {roleIds.length === 0 ? (
                                <span className="text-gray-400 text-xs italic">None</span>
                            ) : (
                                roleIds.map((r, i) => (
                                    <span
                                        key={i}
                                        className="inline-block rounded-full px-2 py-0.5 text-xs font-bold bg-blue-100 text-blue-700"
                                    >
                                        {r}
                                    </span>
                                ))
                            )}
                        </div>
                    </td>
                    {/* ── Active/Inactive ── */}
                    <td className="px-5 py-4">
                        <div className="flex items-center gap-2">
                            <Switch
                                checked={row.isActive}
                                onCheckedChange={() => toggleMutation.mutate(row.id)}
                                className="data-[state=checked]:bg-[#00a65a]"
                            />
                            <span className={`text-xs font-medium ${row.isActive ? 'text-[#00a65a]' : 'text-gray-400'}`}>
                                {row.isActive ? 'active' : 'inactive'}
                            </span>
                        </div>
                    </td>
                    {/* ── Actions ── */}
                    <td className="px-5 py-4">
                        <div className="flex items-center gap-2">
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => openEdit(row)}
                                className="h-8 w-8 p-0 text-emerald-700 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-950/40"
                            >
                                <Edit className="w-4 h-4" />
                            </Button>
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => { if (confirm('Delete this permission?')) deleteMutation.mutate(row.id); }}
                                className="h-8 w-8 p-0 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40"
                            >
                                <Trash2 className="w-4 h-4" />
                            </Button>
                        </div>
                    </td>
                </tr>
            );
        });
    }

    return (
        <div className="space-y-4">
            <PageHeader
                eyebrow="DRM Setting"
                title="DRM Permission"
                description="Configure sidebar menu entries, sub-URLs, and role access. Changes are enforced by the backend."
                actions={
                    <div className="flex flex-wrap gap-2">
                        <Button type="button" variant="secondary" size="sm" onClick={() => setIsAddPermOpen((v) => !v)}>
                            {isAddPermOpen ? "Hide new menu" : "New menu item"}
                        </Button>
                        <Button type="button" variant="secondary" size="sm" onClick={() => setIsAddSubOpen((v) => !v)}>
                            {isAddSubOpen ? "Hide sub-URL" : "Add sub-URL"}
                        </Button>
                    </div>
                }
            />

            {isAddPermOpen ? (
                <DrmSection title="New permission" description="Creates a top-level menu group in the sidebar.">
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        <div>
                            <label className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300">Menu head</label>
                            <input
                                value={menuHead}
                                onChange={(e) => setMenuHead(e.target.value)}
                                placeholder="e.g. Users"
                                className={drmFieldClass}
                            />
                        </div>
                        <div>
                            <label className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300">Icon</label>
                            <select
                                value={menuIconPath}
                                onChange={(e) => setMenuIconPath(e.target.value)}
                                className={drmFieldClass}
                            >
                                {ICON_OPTIONS.map((i) => (
                                    <option key={i} value={i}>
                                        {i}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>
                    <DrmFormActions>
                        <Button type="button" variant="secondary" size="sm" onClick={() => setIsAddPermOpen(false)}>
                            Cancel
                        </Button>
                        <Button
                            type="button"
                            variant="primary"
                            size="sm"
                            disabled={createPermMutation.isPending || !menuHead.trim()}
                            onClick={() => createPermMutation.mutate()}
                        >
                            {createPermMutation.isPending ? "Creating…" : "Create menu"}
                        </Button>
                    </DrmFormActions>
                </DrmSection>
            ) : null}

            {isAddSubOpen ? (
                <DrmSection title="Add sub-URL" description="Attach child links under an existing menu permission.">
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                        <div>
                            <label className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300">Main menu</label>
                            <Select value={selectedPermId} onValueChange={setSelectedPermId}>
                                <SelectTrigger className={drmFieldClass + " h-9"}>
                                    <SelectValue placeholder="Choose…" />
                                </SelectTrigger>
                                <SelectContent>
                                    {permissions?.map((p) => (
                                        <SelectItem key={p.id} value={p.id}>
                                            {p.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <label className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300">URL title</label>
                            <input
                                value={subUrlTitle}
                                onChange={(e) => setSubUrlTitle(e.target.value)}
                                placeholder="e.g. Add User, User List"
                                className={drmFieldClass}
                            />
                        </div>
                        <div>
                            <label className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300">URL slug(s)</label>
                            <input
                                value={subUrlPath}
                                onChange={(e) => setSubUrlPath(e.target.value)}
                                placeholder="e.g. add-user,user-list"
                                className={drmFieldClass}
                            />
                        </div>
                    </div>
                    <DrmFormActions>
                        <Button type="button" variant="secondary" size="sm" onClick={() => setIsAddSubOpen(false)}>
                            Cancel
                        </Button>
                        <Button
                            type="button"
                            variant="primary"
                            size="sm"
                            disabled={addSubUrlMutation.isPending || !selectedPermId || !subUrlPath.trim()}
                            onClick={() => addSubUrlMutation.mutate()}
                        >
                            {addSubUrlMutation.isPending ? "Adding…" : "Add sub-URL"}
                        </Button>
                    </DrmFormActions>
                </DrmSection>
            ) : null}

            {/* ── Permissions Table ────────────────────────────── */}
            <Tabs defaultValue="all" className="w-full">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                    <TabsList className="bg-white border border-gray-200 p-1 h-11 dark:bg-zinc-900 dark:border-zinc-800">
                        <TabsTrigger value="all" className="data-[state=active]:bg-emerald-600 data-[state=active]:text-white text-[10px] sm:text-xs font-semibold px-4 sm:px-6">
                            All Modules
                        </TabsTrigger>
                        <TabsTrigger value="core" className="data-[state=active]:bg-emerald-600 data-[state=active]:text-white text-[10px] sm:text-xs font-semibold px-4 sm:px-6 border-l border-gray-100 dark:border-zinc-800">
                            Core Modules
                        </TabsTrigger>
                        <TabsTrigger value="reports" className="data-[state=active]:bg-[#00a65a] data-[state=active]:text-white uppercase text-[10px] sm:text-xs font-bold px-4 sm:px-6 border-l border-gray-100 dark:border-zinc-800">
                            Reports
                        </TabsTrigger>
                    </TabsList>
                    <div className="relative w-full sm:w-64">
                        <Input
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            placeholder="Search menu, department, role..."
                            className="h-9 text-sm border-gray-300 dark:border-zinc-800"
                        />
                        {searchTerm && (
                            <button
                                onClick={() => setSearchTerm('')}
                                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                            >
                                <X className="w-3.5 h-3.5" />
                            </button>
                        )}
                    </div>
                </div>

                <div className="bg-white border border-gray-200 rounded shadow-sm overflow-hidden dark:bg-zinc-900 dark:border-zinc-800">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-gray-50 border-b border-gray-200 text-gray-700 font-semibold text-xs uppercase tracking-wide dark:bg-zinc-900 dark:border-zinc-800 dark:text-zinc-400">
                                <tr>
                                    <th className="px-5 py-3 w-8">
                                        <input type="checkbox" className="rounded border-gray-300 dark:border-zinc-800" />
                                    </th>
                                    <th className="px-5 py-3 min-w-[130px]">Menu</th>
                                    <th className="px-5 py-3 min-w-[260px]">Permission</th>
                                    <th className="px-5 py-3 min-w-[280px]">Sub-Url</th>
                                    <th className="px-5 py-3 min-w-[130px]">Allowed Roles</th>
                                    <th className="px-5 py-3 min-w-[130px]">Active/Deactive</th>
                                    <th className="px-5 py-3">Action</th>
                                </tr>
                            </thead>
                            
                            <TabsContent value="all" asChild>
                                <tbody className="divide-y divide-gray-100">
                                    {renderRows(searchedPermissions)}
                                </tbody>
                            </TabsContent>
                            
                            <TabsContent value="core" asChild>
                                <tbody className="divide-y divide-gray-100">
                                    {renderRows(coreModules)}
                                </tbody>
                            </TabsContent>
                            
                            <TabsContent value="reports" asChild>
                                <tbody className="divide-y divide-gray-100">
                                    {renderRows(reportModules)}
                                </tbody>
                            </TabsContent>
                        </table>
                    </div>
                </div>
            </Tabs>

            {/* ══════════════════════════════════════════════════
                  Edit Dialog
            ══════════════════════════════════════════════════ */}
            <Dialog open={!!editTarget} onOpenChange={open => { if (!open) setEditTarget(null); }}>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Edit className="w-5 h-5 text-[#00a65a] dark:text-zinc-400" />
                            Edit Permission — <span className="text-[#00a65a] dark:text-zinc-400">{editTarget?.name}</span>
                        </DialogTitle>
                    </DialogHeader>

                    <div className="space-y-5 py-2">

                        {/* Name + Icon */}
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label className="text-xs font-bold uppercase text-gray-600 mb-1 block dark:text-zinc-300">Menu Name</Label>
                                <Input
                                    value={editName}
                                    onChange={e => setEditName(e.target.value)}
                                    placeholder="e.g. Users"
                                />
                            </div>
                            <div>
                                <Label className="text-xs font-bold uppercase text-gray-600 mb-1 block dark:text-zinc-300">Icon</Label>
                                <select
                                    value={editIcon}
                                    onChange={e => setEditIcon(e.target.value)}
                                    className="w-full border border-gray-300 rounded-sm px-3 py-2 text-sm focus:outline-none focus:border-[#00a65a] bg-white dark:bg-zinc-900 dark:border-zinc-800"
                                >
                                    {ICON_OPTIONS.map(i => <option key={i} value={i}>{i}</option>)}
                                </select>
                            </div>
                        </div>

                        {/* Departments / Permissions */}
                        <div>
                            <Label className="text-xs font-bold uppercase text-gray-600 mb-2 block dark:text-zinc-300">
                                Departments (Permissions)
                            </Label>
                            {/* selected chips */}
                            <div className="flex flex-wrap gap-1.5 mb-2 min-h-[32px] p-2 border border-gray-200 rounded bg-gray-50 dark:bg-zinc-900 dark:border-zinc-800">
                                {editDepts.length === 0 && <span className="text-gray-400 text-xs italic">No departments selected</span>}
                                {editDepts.map((d, i) => (
                                    <span key={i} className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${deptColor(d)}`}>
                                        {d}
                                        <button
                                            onClick={() => setEditDepts(editDepts.filter((_, idx) => idx !== i))}
                                            className="ml-0.5 hover:text-red-500"
                                        >
                                            <X className="w-3 h-3" />
                                        </button>
                                    </span>
                                ))}
                            </div>
                            {/* dropdown to add */}
                            <select
                                onChange={e => {
                                    const val = e.target.value;
                                    if (val && !editDepts.includes(val)) setEditDepts([...editDepts, val]);
                                    e.target.value = '';
                                }}
                                className="w-full border border-gray-300 rounded-sm px-3 py-2 text-sm focus:outline-none focus:border-[#00a65a] bg-white dark:bg-zinc-900 dark:border-zinc-800"
                                defaultValue=""
                            >
                                <option value="" disabled>— Add department —</option>
                                {ALL_DEPARTMENTS.filter(d => !editDepts.includes(d)).map(d => (
                                    <option key={d} value={d}>{d}</option>
                                ))}
                            </select>
                        </div>

                        {/* Sub URLs */}
                        <div>
                            <Label className="text-xs font-bold uppercase text-gray-600 mb-2 block dark:text-zinc-300">
                                Sub URLs
                            </Label>
                            <div className="flex flex-wrap gap-1.5 mb-2 min-h-[32px] p-2 border border-gray-200 rounded bg-gray-50 dark:bg-zinc-900 dark:border-zinc-800">
                                {editSubUrls.length === 0 && <span className="text-gray-400 text-xs italic">No sub-URLs</span>}
                                {editSubUrls.map((u, i) => (
                                    <span key={i} className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium bg-[#e4f6ec] text-[#00a65a] dark:bg-zinc-900 dark:text-zinc-400">
                                        {u}
                                        <button
                                            onClick={() => setEditSubUrls(editSubUrls.filter((_, idx) => idx !== i))}
                                            className="ml-0.5 hover:text-red-500"
                                        >
                                            <X className="w-3 h-3" />
                                        </button>
                                    </span>
                                ))}
                            </div>
                            <div className="flex gap-2">
                                <input
                                    value={newSubUrl}
                                    onChange={e => setNewSubUrl(e.target.value)}
                                    onKeyDown={e => {
                                        if (e.key === 'Enter' && newSubUrl.trim()) {
                                            const items = newSubUrl.split(',').map(s => s.trim()).filter(Boolean);
                                            setEditSubUrls([...editSubUrls, ...items.filter(s => !editSubUrls.includes(s))]);
                                            setNewSubUrl('');
                                        }
                                    }}
                                    placeholder="Type slug and press Enter (comma separated ok)"
                                    className="flex-1 border border-gray-300 rounded-sm px-3 py-2 text-sm focus:outline-none focus:border-[#00a65a] dark:border-zinc-800"
                                />
                                <Button
                                    type="button"
                                    variant="primary"
                                    size="sm"
                                    onClick={() => {
                                        const items = newSubUrl.split(',').map(s => s.trim()).filter(Boolean);
                                        setEditSubUrls([...editSubUrls, ...items.filter(s => !editSubUrls.includes(s))]);
                                        setNewSubUrl('');
                                    }}
                                >
                                    <Plus className="w-4 h-4" />
                                </Button>
                            </div>
                        </div>

                        {/* Allowed Roles */}
                        <div>
                            <Label className="text-xs font-bold uppercase text-gray-600 mb-2 block dark:text-zinc-300">
                                Allowed Roles
                            </Label>
                            <div className="flex flex-wrap gap-1.5 mb-2 min-h-[32px] p-2 border border-gray-200 rounded bg-gray-50 dark:bg-zinc-900 dark:border-zinc-800">
                                {editRoleIds.length === 0 && <span className="text-gray-400 text-xs italic">No roles assigned</span>}
                                {editRoleIds.map((r, i) => (
                                    <span key={i} className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold bg-blue-100 text-blue-700">
                                        {r}
                                        <button
                                            onClick={() => setEditRoleIds(editRoleIds.filter((_, idx) => idx !== i))}
                                            className="ml-0.5 hover:text-red-500"
                                        >
                                            <X className="w-3 h-3" />
                                        </button>
                                    </span>
                                ))}
                            </div>

                            <div className="flex gap-2">
                                <select
                                    className="flex-1 border border-gray-300 rounded-sm px-3 py-2 text-sm focus:outline-none focus:border-[#00a65a] bg-white dark:bg-zinc-900 dark:border-zinc-800"
                                    value=""
                                    onChange={(e) => {
                                        const selectedRole = e.target.value;
                                        if (selectedRole && !editRoleIds.includes(selectedRole)) {
                                            setEditRoleIds([...editRoleIds, selectedRole]);
                                        }
                                    }}
                                >
                                    <option value="" disabled>— Select Role to Allow —</option>
                                    {rolesList?.filter(role => !editRoleIds.includes(role.name)).map((role) => (
                                        <option key={role.id} value={role.name}>{role.name}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button type="button" variant="secondary" onClick={() => setEditTarget(null)}>Cancel</Button>
                        <Button
                            variant="primary"
                            type="button"
                            onClick={() => editMutation.mutate()}
                            disabled={editMutation.isPending}
                        >
                            {editMutation.isPending ? 'Saving...' : 'Save Changes'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

        </div>
    );
}
