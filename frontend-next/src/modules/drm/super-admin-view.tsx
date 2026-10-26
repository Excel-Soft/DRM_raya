"use client";

import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest, extractApiError } from "@/lib/query/query-client";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/legacy/select";
import { DrmFormActions, DrmFormModal, DrmSection, drmFieldClass, drmPanelClass } from "@/modules/drm/drm-ui";
import { cn } from "@/lib/utils/cn";
import { useToast } from "@/lib/hooks/use-legacy-toast";
import { Loader2, UserPlus, Pencil, Trash2, Shield, Settings, Users, Activity, Globe, MapPin, CheckCircle2, XCircle, Plus, Eye, EyeOff, Search } from "lucide-react";
import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/legacy/tabs";
import { Checkbox } from "@/components/ui/legacy/checkbox";

interface User {
    id: string;
    fullName: string;
    email: string;
    role: string;
    roles: string[];
    branch: string;
    country: string;
    isActive: boolean;
    createdAt: string;
    password?: string;
}

interface Role {
    id: string;
    name: string;
    description: string;
}

interface Policy {
    id: string;
    key: string;
    value_json: any;
    description: string;
}

interface AllowedIp {
    id: string;
    ip_cidr: string;
    description: string;
    is_active: boolean;
}

function formatRoleLabel(name: string) {
    return name.replace(/_/g, " ");
}

function RoleCheckboxGrid({
    roles,
    loading,
    idPrefix,
    defaultChecked,
}: {
    roles: Role[];
    loading?: boolean;
    idPrefix: string;
    defaultChecked?: (name: string) => boolean;
}) {
    if (loading) {
        return (
            <div className={cn(drmPanelClass, "flex items-center justify-center p-6")}>
                <Loader2 className="h-5 w-5 animate-spin text-emerald-600" />
            </div>
        );
    }
    return (
        <div className={cn(drmPanelClass, "max-h-52 overflow-y-auto p-3")}>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {roles.map((r) => (
                    <label
                        key={r.id}
                        htmlFor={`${idPrefix}_${r.name}`}
                        className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-zinc-700 hover:bg-zinc-50 dark:text-zinc-300 dark:hover:bg-zinc-800/80"
                    >
                        <Checkbox
                            id={`${idPrefix}_${r.name}`}
                            name={`role_${r.name}`}
                            defaultChecked={defaultChecked?.(r.name)}
                        />
                        <span className="font-medium capitalize">{formatRoleLabel(r.name)}</span>
                    </label>
                ))}
            </div>
        </div>
    );
}

export function SuperAdminDashboard() {
    const { toast } = useToast();
    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
    const [editingUser, setEditingUser] = useState<User | null>(null);
    const [searchQuery, setSearchQuery] = useState("");
    const [settingsView, setSettingsView] = useState<"none" | "roles" | "ips" | "policies" | "locations">("none");
    const [showPassword, setShowPassword] = useState(false);
    const [activeTab, setActiveTab] = useState("overview");

    // Dialog states for settings
    const [isAddRoleDialogOpen, setIsAddRoleDialogOpen] = useState(false);
    const [editingRole, setEditingRole] = useState<Role | null>(null);
    const [isAddIpDialogOpen, setIsAddIpDialogOpen] = useState(false);
    const [editingPolicy, setEditingPolicy] = useState<Policy | null>(null);

    // Queries
    const { data: users, isLoading: usersLoading } = useQuery<User[]>({
        queryKey: ["/api/users", "super-admin"],
        queryFn: async () => {
            const res = await apiRequest("GET", "/api/users");
            const data = await res.json();
            return data.users || [];
        }
    });

    const { data: roles, isLoading: rolesLoading } = useQuery<Role[]>({
        queryKey: ["/api/settings/roles"],
        queryFn: async () => {
            const res = await apiRequest("GET", "/api/settings/roles");
            const data = await res.json();
            return Array.isArray(data) ? data : (data.roles || []);
        }
    });

    const { data: ips, isLoading: ipsLoading } = useQuery<AllowedIp[]>({
        queryKey: ["/api/settings/allowed-ips"],
        queryFn: async () => {
            const res = await apiRequest("GET", "/api/settings/allowed-ips");
            const data = await res.json();
            return Array.isArray(data) ? data : (data.ips || []);
        }
    });

    const { data: policies, isLoading: policiesLoading } = useQuery<Policy[]>({
        queryKey: ["/api/settings/policies"],
        queryFn: async () => {
            const res = await apiRequest("GET", "/api/settings/policies");
            const data = await res.json();
            return Array.isArray(data) ? data : (data.policies || []);
        }
    });

    const filteredUsers = (Array.isArray(users) ? users : []).filter(user => {
        const query = searchQuery.toLowerCase();
        return (
            user.fullName.toLowerCase().includes(query) ||
            user.email.toLowerCase().includes(query) ||
            user.role.toLowerCase().includes(query) ||
            user.roles?.some(r => r.toLowerCase().includes(query))
        );
    });

    // Mutations
    const createMutation = useMutation({
        mutationFn: async (newUser: any) => {
            const res = await apiRequest("POST", "/api/users", newUser);
            const data = await res.json();
            if (!res.ok) throw new Error(extractApiError(data, res.status));
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/users"] });
            setIsAddDialogOpen(false);
            toast({ title: "User created successfully" });
        },
        onError: (error: any) => {
            toast({ title: "Failed to create user", description: error.message, variant: "destructive" });
        },
    });

    const updateMutation = useMutation({
        mutationFn: async ({ id, data }: { id: string; data: any }) => {
            const cleanData: any = { ...data };
            if (!cleanData.password) delete cleanData.password;
            if (cleanData.isActive !== undefined) {
                cleanData.isActive = cleanData.isActive === "on" || cleanData.isActive === true;
            }
            const res = await apiRequest("PATCH", `/api/users/${id}`, cleanData);
            const json = await res.json();
            if (!res.ok) throw new Error(json.error || "Update failed");
            return json;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/users"] });
            setEditingUser(null);
            toast({ title: "User updated successfully" });
        },
        onError: (error: any) => {
            toast({ title: "Update failed", description: error.message, variant: "destructive" });
        }
    });

    const deleteMutation = useMutation({
        mutationFn: async (id: string) => {
            await apiRequest("DELETE", `/api/users/${id}`);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/users"] });
            toast({ title: "User deleted successfully" });
        },
        onError: (error: any) => {
            toast({ title: "Delete failed", description: error.message, variant: "destructive" });
        }
    });

    // Settings Mutations
    const roleMutation = useMutation({
        mutationFn: async ({ id, data }: { id?: string; data: any }) => {
            const method = id ? "PATCH" : "POST";
            const url = id ? `/api/settings/roles/${id}` : "/api/settings/roles";
            const res = await apiRequest(method, url, data);
            const json = await res.json();
            if (!res.ok) throw new Error(json.error || "Operation failed");
            return json;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/settings/roles"] });
            setIsAddRoleDialogOpen(false);
            setEditingRole(null);
            toast({ title: "Role saved successfully" });
        }
    });

    const ipMutation = useMutation({
        mutationFn: async (data: any) => {
            const res = await apiRequest("POST", "/api/settings/allowed-ips", data);
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/settings/allowed-ips"] });
            setIsAddIpDialogOpen(false);
            toast({ title: "IP added successfully" });
        }
    });

    const toggleIpMutation = useMutation({
        mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
            await apiRequest("PATCH", `/api/settings/allowed-ips/${id}`, { is_active });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/settings/allowed-ips"] });
            toast({ title: "IP Status updated" });
        }
    });

    const policyMutation = useMutation({
        mutationFn: async ({ key, value }: { key: string; value: any }) => {
            const res = await apiRequest("PATCH", `/api/settings/policies/${key}`, { value_json: value });
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/settings/policies"] });
            setEditingPolicy(null);
            toast({ title: "Policy updated" });
        }
    });

    // Handlers
    const handleAddUser = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const form = e.currentTarget;
        const formData = new FormData(form);
        const data: any = Object.fromEntries(formData);

        // Collect roles from checked boxes - be more robust with checking for "on" or any truthy string
        const getCheck = (name: string) => {
            const val = formData.get(name);
            return val === "on" || val === "true" || val === "";
        };

        const selectedRoles = roles?.filter(r =>
            getCheck(`role_${r.name}`) ||
            getCheck(`create_role_${r.name}`)
        ).map(r => r.name);

        data.roles = selectedRoles && selectedRoles.length > 0 ? selectedRoles : [];
        
        if (data.roles.length === 0) {
            toast({ title: "Error", description: "Please select at least one role", variant: "destructive" });
            return;
        }
        
        data.role = data.roles[0];

        // Ensure we have required data
        if (!data.email || !data.password) {
            toast({ title: "Error", description: "Email and password are required", variant: "destructive" });
            return;
        }

        createMutation.mutate(data);
    };

    const handleUpdateUser = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!editingUser) return;
        const formData = new FormData(e.currentTarget);
        const data: any = Object.fromEntries(formData);

        // Collect roles from checked boxes
        const selectedRoles = roles?.filter(r => formData.get(`role_${r.name}`) === "on").map(r => r.name);
        data.roles = selectedRoles && selectedRoles.length > 0 ? selectedRoles : [data.role];
        // Sync legacy role field with first selected role
        data.role = data.roles[0];

        updateMutation.mutate({ id: editingUser.id, data });
    };

    const handleRoleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        const data = Object.fromEntries(formData);
        roleMutation.mutate({ id: editingRole?.id, data });
    };

    const handleIpSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        ipMutation.mutate(Object.fromEntries(formData));
    };

    const handlePolicySubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!editingPolicy) return;
        const formData = new FormData(e.currentTarget);
        const { value } = Object.fromEntries(formData);
        // Try parsing json if it looks like one, otherwise treat as string
        let val: any = value;
        try { val = JSON.parse(value as string); } catch { }
        policyMutation.mutate({ key: editingPolicy.key, value: val });
    };

    const locationBranches =
        policies?.find((p) => p.key === "system_locations")?.value_json?.branches ||
        ["Lahore Gulburg", "Lahore Raya", "Sialkot Welc", "Sialkot webexcels", "Gugrawala webexcels", "Faislabad webexcels"];
    const locationCountries =
        policies?.find((p) => p.key === "system_locations")?.value_json?.countries || ["UAE", "USA", "Pakistan"];

    const userColumns: DataTableColumn<User>[] = [
        {
            id: "name",
            header: "Name",
            cell: (row) => <span className="font-medium text-zinc-900 dark:text-zinc-100">{row.fullName}</span>,
        },
        { id: "email", header: "Email", cell: (row) => <span className="text-zinc-600 dark:text-zinc-400">{row.email}</span> },
        {
            id: "roles",
            header: "Roles",
            cell: (row) => (
                <div className="flex flex-wrap gap-1">
                    {(row.roles?.length ? row.roles : row.role ? [row.role] : []).slice(0, 3).map((r) => (
                        <Badge key={r} variant="brand" className="normal-case">
                            {formatRoleLabel(r)}
                        </Badge>
                    ))}
                </div>
            ),
        },
        {
            id: "status",
            header: "Status",
            cell: (row) => (
                <Badge variant={row.isActive ? "success" : "neutral"}>{row.isActive ? "Active" : "Inactive"}</Badge>
            ),
        },
        {
            id: "actions",
            header: "",
            headerClassName: "w-28 text-right",
            className: "text-right",
            cell: (row) => (
                <div className="flex justify-end gap-1">
                    <Button type="button" variant="ghost" size="sm" className="h-8 w-8 p-0" aria-label="Edit user" onClick={() => setEditingUser(row)}>
                        <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40"
                        aria-label="Delete user"
                        onClick={() => deleteMutation.mutate(row.id)}
                    >
                        <Trash2 className="h-4 w-4" />
                    </Button>
                </div>
            ),
        },
    ];

    const settingsTiles = [
        { id: "roles" as const, title: "Roles", description: "System roles and descriptions.", icon: Shield },
        { id: "ips" as const, title: "IP allowlist", description: "Authorized IP ranges.", icon: Globe },
        { id: "policies" as const, title: "Global policies", description: "System-wide configuration.", icon: Settings },
        { id: "locations" as const, title: "Locations", description: "Branches and countries.", icon: MapPin },
    ];

    const roleManageColumns: DataTableColumn<Role>[] = [
        {
            id: "name",
            header: "System name",
            cell: (row) => (
                <code className="rounded bg-zinc-100 px-1.5 py-0.5 text-xs dark:bg-zinc-800">{row.name}</code>
            ),
        },
        {
            id: "desc",
            header: "Description",
            cell: (row) => <span className="text-sm text-zinc-600 dark:text-zinc-400">{row.description || "—"}</span>,
        },
        {
            id: "actions",
            header: "",
            headerClassName: "w-14 text-right",
            className: "text-right",
            cell: (row) => (
                <Button type="button" variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => setEditingRole(row)}>
                    <Pencil className="h-4 w-4" />
                </Button>
            ),
        },
    ];

    const ipColumns: DataTableColumn<AllowedIp>[] = [
        { id: "cidr", header: "IP CIDR", cell: (row) => <span className="font-mono text-sm">{row.ip_cidr}</span> },
        {
            id: "status",
            header: "Status",
            cell: (row) => <Badge variant={row.is_active ? "success" : "neutral"}>{row.is_active ? "Allowed" : "Blocked"}</Badge>,
        },
        {
            id: "actions",
            header: "",
            headerClassName: "w-14 text-right",
            className: "text-right",
            cell: (row) => (
                <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0"
                    onClick={() => toggleIpMutation.mutate({ id: row.id, is_active: !row.is_active })}
                >
                    {row.is_active ? <XCircle className="h-4 w-4 text-red-500" /> : <CheckCircle2 className="h-4 w-4 text-emerald-500" />}
                </Button>
            ),
        },
    ];

    return (
        <div className="space-y-4">
            <PageHeader
                eyebrow="DRM Setting"
                title="Super Admin"
                description="User management, roles, policies, and system settings."
                actions={
                    <Button type="button" variant="primary" size="sm" onClick={() => setIsAddDialogOpen(true)}>
                        <UserPlus className="mr-2 h-4 w-4" /> Add user
                    </Button>
                }
            />

            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
                <TabsList className="grid h-10 w-full max-w-xl grid-cols-3 rounded-lg border border-zinc-200 bg-zinc-50 p-1 dark:border-zinc-800 dark:bg-zinc-950">
                    <TabsTrigger value="overview" className="rounded-md data-[state=active]:bg-emerald-600 data-[state=active]:text-white">
                        Overview
                    </TabsTrigger>
                    <TabsTrigger value="users" className="rounded-md data-[state=active]:bg-emerald-600 data-[state=active]:text-white">
                        User management
                    </TabsTrigger>
                    <TabsTrigger value="settings" className="rounded-md data-[state=active]:bg-emerald-600 data-[state=active]:text-white">
                        System settings
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="overview" className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                        {[
                            { label: "Total users", value: users?.length || 0, icon: Users },
                            { label: "Active roles", value: roles?.length || 0, icon: Shield },
                            { label: "System health", value: "Stable", icon: Activity, accent: true },
                            { label: "Data storage", value: "Cloud", icon: Settings },
                        ].map((stat) => (
                            <Card key={stat.label} className="!p-4">
                                <div className="flex items-start justify-between">
                                    <div>
                                        <p className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">{stat.label}</p>
                                        <p className={cn("mt-1 text-2xl font-bold tabular-nums", stat.accent && "text-emerald-600")}>{stat.value}</p>
                                    </div>
                                    <stat.icon className={cn("h-5 w-5", stat.accent ? "text-emerald-500" : "text-zinc-400")} />
                                </div>
                            </Card>
                        ))}
                    </div>
                </TabsContent>

                <TabsContent value="users" className="space-y-4">
                    <DrmSection
                        title="Administrator accounts"
                        description="Search, edit, or remove admin users. Use Add user to create a new account."
                        actions={
                            <div className="relative w-full sm:w-64">
                                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                                <Input
                                    placeholder="Search name, email, role…"
                                    className={cn(drmFieldClass, "pl-9")}
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                />
                            </div>
                        }
                    >
                        <DataTable
                            columns={userColumns}
                            rows={filteredUsers ?? []}
                            rowKey={(row) => row.id}
                            loading={usersLoading}
                            emptyMessage={searchQuery ? `No users match “${searchQuery}”.` : "No administrator accounts yet."}
                        />
                    </DrmSection>
                </TabsContent>

                <TabsContent value="settings" className="space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                        {settingsTiles.map((tile) => (
                            <button
                                key={tile.id}
                                type="button"
                                onClick={() => setSettingsView(tile.id)}
                                className={cn(
                                    drmPanelClass,
                                    "flex flex-col gap-2 p-4 text-left transition-colors hover:border-emerald-500/50 hover:shadow-sm",
                                )}
                            >
                                <tile.icon className="h-5 w-5 text-emerald-600" />
                                <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{tile.title}</span>
                                <span className="text-xs text-zinc-500 dark:text-zinc-400">{tile.description}</span>
                            </button>
                        ))}
                    </div>

                </TabsContent>
            </Tabs>

            <DrmFormModal
                open={isAddDialogOpen}
                title="Add user"
                size="lg"
                onClose={() => setIsAddDialogOpen(false)}
                footer={
                    <>
                        <Button type="button" variant="secondary" onClick={() => setIsAddDialogOpen(false)}>
                            Cancel
                        </Button>
                        <Button type="submit" form="super-admin-add-user" variant="primary" disabled={createMutation.isPending}>
                            {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Create user
                        </Button>
                    </>
                }
            >
                <form id="super-admin-add-user" onSubmit={handleAddUser} className="space-y-4">
                    <Field id="add-fullName" label="Full name">
                        <Input id="add-fullName" name="fullName" required placeholder="John Doe" autoComplete="off" className={drmFieldClass} />
                    </Field>
                    <Field id="add-email" label="Email">
                        <Input id="add-email" name="email" type="email" required placeholder="john@example.com" autoComplete="off" className={drmFieldClass} />
                    </Field>
                    <Field id="add-password" label="Password">
                        <div className="relative">
                            <Input
                                id="add-password"
                                name="password"
                                type={showPassword ? "text" : "password"}
                                required
                                minLength={6}
                                autoComplete="new-password"
                                className={cn(drmFieldClass, "pr-10")}
                            />
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="absolute right-0 top-0 h-full px-3"
                                onClick={() => setShowPassword(!showPassword)}
                            >
                                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </Button>
                        </div>
                    </Field>
                    <div className="space-y-1">
                        <Label>Roles</Label>
                        <RoleCheckboxGrid roles={roles || []} loading={rolesLoading} idPrefix="add" />
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                        <Field id="add-branch" label="Branch">
                            <Select name="branch" defaultValue="Lahore Gulburg">
                                <SelectTrigger className={drmFieldClass}><SelectValue placeholder="Branch" /></SelectTrigger>
                                <SelectContent>
                                    {locationBranches.map((b: string) => (
                                        <SelectItem key={b} value={b}>{b}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </Field>
                        <Field id="add-country" label="Country">
                            <Select name="country" defaultValue="Pakistan">
                                <SelectTrigger className={drmFieldClass}><SelectValue placeholder="Country" /></SelectTrigger>
                                <SelectContent>
                                    {locationCountries.map((c: string) => (
                                        <SelectItem key={c} value={c}>{c}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </Field>
                    </div>
                </form>
            </DrmFormModal>

            <DrmFormModal
                open={!!editingUser}
                title={editingUser ? `Edit — ${editingUser.fullName}` : "Edit user"}
                size="lg"
                onClose={() => setEditingUser(null)}
                footer={
                    editingUser ? (
                        <>
                            <Button type="button" variant="secondary" onClick={() => setEditingUser(null)}>
                                Cancel
                            </Button>
                            <Button type="submit" form="super-admin-edit-user" variant="primary" disabled={updateMutation.isPending}>
                                {updateMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Save changes
                            </Button>
                        </>
                    ) : null
                }
            >
                {editingUser ? (
                    <form key={editingUser.id} id="super-admin-edit-user" onSubmit={handleUpdateUser} className="space-y-4">
                        <Field id="edit-fullName" label="Full name">
                            <Input id="edit-fullName" name="fullName" defaultValue={editingUser.fullName} className={drmFieldClass} />
                        </Field>
                        <div className="space-y-1">
                            <Label>Roles</Label>
                            <RoleCheckboxGrid
                                roles={roles || []}
                                idPrefix="edit"
                                defaultChecked={(name) =>
                                    editingUser.roles?.includes(name) || editingUser.role === name
                                }
                            />
                            <input type="hidden" name="role" defaultValue={editingUser.role} />
                        </div>
                        <div className="grid gap-4 sm:grid-cols-2">
                            <Field id="edit-branch" label="Branch">
                                <Select name="branch" defaultValue={editingUser.branch || "Lahore Gulburg"}>
                                    <SelectTrigger className={drmFieldClass}><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        {locationBranches.map((b: string) => (
                                            <SelectItem key={b} value={b}>{b}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </Field>
                            <Field id="edit-country" label="Country">
                                <Select name="country" defaultValue={editingUser.country || "Pakistan"}>
                                    <SelectTrigger className={drmFieldClass}><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        {locationCountries.map((c: string) => (
                                            <SelectItem key={c} value={c}>{c}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </Field>
                        </div>
                        <Field id="edit-password" label="New password" hint="Leave blank to keep the current password.">
                            <Input id="edit-password" name="password" type="password" className={drmFieldClass} />
                        </Field>
                        <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
                            <Checkbox id="edit-isActive" name="isActive" defaultChecked={editingUser.isActive} />
                            Account active
                        </label>
                    </form>
                ) : null}
            </DrmFormModal>

            <DrmFormModal
                open={settingsView === "roles"}
                title="Manage roles"
                size="xl"
                onClose={() => setSettingsView("none")}
                footer={
                    <Button type="button" variant="secondary" onClick={() => setSettingsView("none")}>
                        Close
                    </Button>
                }
            >
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm text-zinc-500 dark:text-zinc-400">Define roles and system identifiers.</p>
                    <Button type="button" size="sm" variant="primary" onClick={() => setIsAddRoleDialogOpen(true)}>
                        <Plus className="mr-2 h-4 w-4" /> Create role
                    </Button>
                </div>
                <DataTable columns={roleManageColumns} rows={roles || []} rowKey={(r) => r.id} loading={rolesLoading} emptyMessage="No roles defined." />
            </DrmFormModal>

            <DrmFormModal
                open={settingsView === "ips"}
                title="IP allowlist"
                size="lg"
                onClose={() => setSettingsView("none")}
                footer={
                    <Button type="button" variant="secondary" onClick={() => setSettingsView("none")}>
                        Close
                    </Button>
                }
            >
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm text-zinc-500 dark:text-zinc-400">Authorized IP ranges for access control.</p>
                    <Button type="button" size="sm" variant="primary" onClick={() => setIsAddIpDialogOpen(true)}>
                        <Plus className="mr-2 h-4 w-4" /> Add IP
                    </Button>
                </div>
                <DataTable columns={ipColumns} rows={ips || []} rowKey={(r) => r.id} loading={ipsLoading} emptyMessage="No IPs configured." />
            </DrmFormModal>

            <DrmFormModal
                open={settingsView === "policies"}
                title="Global policies"
                size="lg"
                onClose={() => setSettingsView("none")}
                footer={
                    <Button type="button" variant="secondary" onClick={() => setSettingsView("none")}>
                        Close
                    </Button>
                }
            >
                <div className="max-h-[min(60vh,24rem)] space-y-2 overflow-y-auto">
                    {policies?.map((p) => (
                        <div key={p.id} className={cn(drmPanelClass, "p-3")}>
                            <div className="flex items-start justify-between gap-2">
                                <span className="text-sm font-semibold capitalize text-zinc-900 dark:text-zinc-100">
                                    {p.key.replace(/_/g, " ")}
                                </span>
                                <Button type="button" variant="ghost" size="sm" onClick={() => setEditingPolicy(p)}>
                                    Edit
                                </Button>
                            </div>
                            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{p.description || "Configuration"}</p>
                            <code className="mt-2 block truncate rounded bg-zinc-100 px-2 py-1 text-xs dark:bg-zinc-800">
                                {JSON.stringify(p.value_json)}
                            </code>
                        </div>
                    ))}
                </div>
            </DrmFormModal>

            <DrmFormModal
                open={settingsView === "locations"}
                title="Locations"
                size="lg"
                onClose={() => setSettingsView("none")}
                footer={
                    <Button type="button" variant="secondary" onClick={() => setSettingsView("none")}>
                        Close
                    </Button>
                }
            >
                <div className="space-y-4">
                    <div className={cn(drmPanelClass, "p-4")}>
                        <form
                            onSubmit={(e) => {
                                e.preventDefault();
                                const locPolicy = policies?.find((p) => p.key === "system_locations");
                                const formData = new FormData(e.currentTarget);
                                const branches = (formData.get("branches") as string).split(",").map((s) => s.trim()).filter(Boolean);
                                const currentJson = locPolicy?.value_json || { countries: [] };
                                policyMutation.mutate({ key: "system_locations", value: { ...currentJson, branches } });
                            }}
                            className="space-y-2"
                        >
                            <Field id="loc-branches" label="Branches" hint="Comma-separated list">
                                <Input
                                    id="loc-branches"
                                    name="branches"
                                    className={drmFieldClass}
                                    defaultValue={policies?.find((p) => p.key === "system_locations")?.value_json?.branches?.join(", ") || locationBranches.join(", ")}
                                />
                            </Field>
                            <DrmFormActions>
                                <Button type="submit" size="sm" variant="primary">
                                    Save branches
                                </Button>
                            </DrmFormActions>
                        </form>
                    </div>
                    <div className={cn(drmPanelClass, "p-4")}>
                        <form
                            onSubmit={(e) => {
                                e.preventDefault();
                                const locPolicy = policies?.find((p) => p.key === "system_locations");
                                const formData = new FormData(e.currentTarget);
                                const countries = (formData.get("countries") as string).split(",").map((s) => s.trim()).filter(Boolean);
                                const currentJson = locPolicy?.value_json || { branches: [] };
                                policyMutation.mutate({ key: "system_locations", value: { ...currentJson, countries } });
                            }}
                            className="space-y-2"
                        >
                            <Field id="loc-countries" label="Countries" hint="Comma-separated list">
                                <Input
                                    id="loc-countries"
                                    name="countries"
                                    className={drmFieldClass}
                                    defaultValue={policies?.find((p) => p.key === "system_locations")?.value_json?.countries?.join(", ") || locationCountries.join(", ")}
                                />
                            </Field>
                            <DrmFormActions>
                                <Button type="submit" size="sm" variant="primary">
                                    Save countries
                                </Button>
                            </DrmFormActions>
                        </form>
                    </div>
                </div>
            </DrmFormModal>

            <DrmFormModal
                open={isAddRoleDialogOpen || !!editingRole}
                title={editingRole ? "Edit role" : "Create role"}
                onClose={() => {
                    setIsAddRoleDialogOpen(false);
                    setEditingRole(null);
                }}
                footer={
                    <>
                        <Button
                            type="button"
                            variant="secondary"
                            onClick={() => {
                                setIsAddRoleDialogOpen(false);
                                setEditingRole(null);
                            }}
                        >
                            Cancel
                        </Button>
                        <Button type="submit" form="super-admin-role-form" variant="primary" disabled={roleMutation.isPending}>
                            {roleMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Save role
                        </Button>
                    </>
                }
            >
                <form id="super-admin-role-form" onSubmit={handleRoleSubmit} className="space-y-4">
                    <Field id="role-name" label="System name">
                        <Input id="role-name" name="name" defaultValue={editingRole?.name} required placeholder="branch_manager" readOnly={!!editingRole} className={drmFieldClass} />
                    </Field>
                    <Field id="role-desc" label="Description">
                        <Input id="role-desc" name="description" defaultValue={editingRole?.description} placeholder="Describe permissions" className={drmFieldClass} />
                    </Field>
                </form>
            </DrmFormModal>

            <DrmFormModal
                open={isAddIpDialogOpen}
                title="Add IP CIDR"
                onClose={() => setIsAddIpDialogOpen(false)}
                footer={
                    <>
                        <Button type="button" variant="secondary" onClick={() => setIsAddIpDialogOpen(false)}>
                            Cancel
                        </Button>
                        <Button type="submit" form="super-admin-ip-form" variant="primary" disabled={ipMutation.isPending}>
                            {ipMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Add IP
                        </Button>
                    </>
                }
            >
                <form id="super-admin-ip-form" onSubmit={handleIpSubmit} className="space-y-4">
                    <Field id="ip-cidr" label="IP range (CIDR)">
                        <Input id="ip-cidr" name="ip_cidr" required placeholder="192.168.1.1/32" className={drmFieldClass} />
                    </Field>
                    <Field id="ip-desc" label="Description">
                        <Input id="ip-desc" name="description" placeholder="Office HQ" className={drmFieldClass} />
                    </Field>
                </form>
            </DrmFormModal>

            <DrmFormModal
                open={!!editingPolicy}
                title={editingPolicy ? `Edit policy — ${editingPolicy.key}` : "Edit policy"}
                onClose={() => setEditingPolicy(null)}
                footer={
                    <>
                        <Button type="button" variant="secondary" onClick={() => setEditingPolicy(null)}>
                            Cancel
                        </Button>
                        <Button type="submit" form="super-admin-policy-form" variant="primary" disabled={policyMutation.isPending}>
                            Save changes
                        </Button>
                    </>
                }
            >
                <form id="super-admin-policy-form" onSubmit={handlePolicySubmit}>
                    <Field id="policy-value" label="Value (JSON or text)">
                        <Input id="policy-value" name="value" defaultValue={JSON.stringify(editingPolicy?.value_json)} className={drmFieldClass} />
                    </Field>
                </form>
            </DrmFormModal>
        </div>
    );
}
