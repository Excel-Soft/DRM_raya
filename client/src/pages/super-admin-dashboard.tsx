import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Loader2, UserPlus, Pencil, Trash2, Shield, Settings, Users, Activity, Globe, MapPin, CheckCircle2, XCircle, Plus, Info, Eye, EyeOff } from "lucide-react";
import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";

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

export default function SuperAdminDashboard() {
    const { toast } = useToast();
    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
    const [editingUser, setEditingUser] = useState<User | null>(null);
    const [searchQuery, setSearchQuery] = useState("");
    const [settingsView, setSettingsView] = useState<"none" | "roles" | "ips" | "policies" | "locations">("none");
    const [showPassword, setShowPassword] = useState(false);
    const [showCreatePassword, setShowCreatePassword] = useState(false);

    // Dialog states for settings
    const [isAddRoleDialogOpen, setIsAddRoleDialogOpen] = useState(false);
    const [editingRole, setEditingRole] = useState<Role | null>(null);
    const [isAddIpDialogOpen, setIsAddIpDialogOpen] = useState(false);
    const [editingPolicy, setEditingPolicy] = useState<Policy | null>(null);

    // Queries
    const { data: users, isLoading: usersLoading } = useQuery<User[]>({
        queryKey: ["/api/users"],
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

    const filteredUsers = users?.filter(user => {
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
            if (!res.ok) throw new Error(data.error || "Failed to create user");
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

    return (
        <div className="flex-1 space-y-6 p-8 pt-6 overflow-auto">
            <div className="flex items-center justify-between">
                <h2 className="text-[14px] font-bold tracking-tight uppercase">Super Admin Dashboard</h2>
                <div className="flex items-center space-x-2">
                    <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                        <DialogTrigger asChild>
                            <Button className="bg-emerald-600 hover:bg-emerald-700">
                                <UserPlus className="mr-2 h-4 w-4" /> Add New User
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-[500px]">
                            <form onSubmit={handleAddUser}>
                                <DialogHeader><DialogTitle className="text-[14px] font-bold">Add New User</DialogTitle></DialogHeader>
                                <div className="grid gap-4 py-4">
                                    <div className="grid gap-1.5"><Label className="font-bold text-muted-foreground mr-1">Full Name</Label><Input name="fullName" required placeholder="John Doe" autoComplete="off" className="h-9" /></div>
                                    <div className="grid gap-1.5"><Label className="font-bold text-muted-foreground mr-1">Email</Label><Input name="email" type="email" required placeholder="john@example.com" autoComplete="off" className="h-9" /></div>
                                    <div className="grid gap-1.5"><Label className="font-bold text-muted-foreground mr-1">Password</Label>
                                        <div className="relative">
                                            <Input name="password" type={showPassword ? "text" : "password"} required autoComplete="new-password" className="h-9" />
                                            <Button type="button" variant="ghost" size="icon" className="absolute right-0 top-0 h-full px-3 hover:bg-transparent" onClick={() => setShowPassword(!showPassword)}>
                                                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                            </Button>
                                        </div>
                                    </div>
                                    <div className="grid gap-1.5">
                                        <Label className="font-bold text-muted-foreground mr-1">Roles</Label>
                                        <div className="grid grid-cols-2 gap-2 border rounded-md p-3 bg-slate-50/50 max-h-[160px] overflow-y-auto">
                                            {rolesLoading ? <Loader2 className="h-4 w-4 animate-spin" /> :
                                                roles?.map(r => (
                                                    <div key={r.id} className="flex items-center space-x-2">
                                                        <Checkbox id={`add_role_${r.name}`} name={`role_${r.name}`} value="on" />
                                                        <Label htmlFor={`add_role_${r.name}`} className="text-[11px] font-normal cursor-pointer uppercase">{r.name.replace(/_/g, ' ')}</Label>
                                                    </div>
                                                ))}
                                        </div>

                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="grid gap-1.5"><Label className="font-bold text-muted-foreground mr-1">Branch</Label>
                                            <Select name="branch" defaultValue="Lahore Gulburg">
                                                <SelectTrigger className="h-9"><SelectValue placeholder="Select Branch" /></SelectTrigger>
                                                <SelectContent>
                                                    {(policies?.find(p => p.key === "system_locations")?.value_json?.branches || ["Lahore Gulburg", "Lahore Raya", "Sialkot Welc", "Sialkot webexcels", "Gugrawala webexcels", "Faislabad webexcels"]).map((b: string) => (
                                                        <SelectItem key={b} value={b}>{b}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="grid gap-1.5"><Label className="font-bold text-muted-foreground mr-1">Country</Label>
                                            <Select name="country" defaultValue="Pakistan">
                                                <SelectTrigger className="h-9"><SelectValue placeholder="Select Country" /></SelectTrigger>
                                                <SelectContent>
                                                    {(policies?.find(p => p.key === "system_locations")?.value_json?.countries || ["UAE", "USA", "Pakistan"]).map((c: string) => (
                                                        <SelectItem key={c} value={c}>{c}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>
                                </div>
                                <DialogFooter><Button type="submit" disabled={createMutation.isPending} className="w-full font-bold h-10">{createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Create User</Button></DialogFooter>
                            </form>
                        </DialogContent>
                    </Dialog>
                </div>
            </div>

            <Tabs defaultValue="overview" className="space-y-4">
                <TabsList className="bg-card border shadow-sm">
                    <TabsTrigger value="overview">Overview</TabsTrigger>
                    <TabsTrigger value="users">User Management</TabsTrigger>
                    <TabsTrigger value="settings">System Settings</TabsTrigger>
                </TabsList>

                <TabsContent value="overview" className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                        <Card className="shadow-sm border-slate-200 dark:border-zinc-800">
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Total Users</CardTitle><Users className="h-4 w-4 text-muted-foreground" /></CardHeader>
                            <CardContent><div className="text-2xl font-bold">{users?.length || 0}</div></CardContent>
                        </Card>
                        <Card className="shadow-sm border-slate-200 dark:border-zinc-800">
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Active Roles</CardTitle><Shield className="h-4 w-4 text-muted-foreground" /></CardHeader>
                            <CardContent><div className="text-2xl font-bold">{roles?.length || 0}</div></CardContent>
                        </Card>
                        <Card className="shadow-sm border-slate-200 dark:border-zinc-800">
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">System Health</CardTitle><Activity className="h-4 w-4 text-emerald-500" /></CardHeader>
                            <CardContent><div className="text-2xl font-bold text-emerald-600">Stable</div></CardContent>
                        </Card>
                        <Card className="shadow-sm border-slate-200 dark:border-zinc-800">
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Data Storage</CardTitle><Settings className="h-4 w-4 text-muted-foreground" /></CardHeader>
                            <CardContent><div className="text-2xl font-bold">Cloud</div></CardContent>
                        </Card>
                    </div>
                </TabsContent>

                <TabsContent value="users" className="space-y-4">
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                        {/* LEFT COLUMN: Create Admin */}
                        <div className="lg:col-span-5 space-y-6">
                            <div>
                                <h3 className="text-xl font-semibold tracking-tight mb-1">Create admin</h3>
                                <p className="text-sm text-slate-500 dark:text-zinc-400">Add a new administrator account.</p>
                            </div>

                            <Card className="border-border shadow-sm">
                                <CardContent className="p-6">
                                    <form onSubmit={handleAddUser} className="space-y-4">
                                        <div className="grid gap-2">
                                            <Label>Name</Label>
                                            <Input name="fullName" required placeholder="Admin name" />
                                        </div>
                                        <div className="grid gap-2">
                                            <Label>Email</Label>
                                            <Input name="email" type="email" required placeholder="admin@example.com" />
                                        </div>
                                        <div className="grid gap-2">
                                            <Label>Password</Label>
                                            <div className="relative">
                                                <Input
                                                    name="password"
                                                    type={showCreatePassword ? "text" : "password"}
                                                    required
                                                    placeholder="At least 6 characters"
                                                    minLength={6}
                                                    className="pr-10"
                                                />
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="icon"
                                                    className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                                                    onClick={() => setShowCreatePassword(v => !v)}
                                                >
                                                    {showCreatePassword
                                                        ? <EyeOff className="h-4 w-4 text-muted-foreground" />
                                                        : <Eye className="h-4 w-4 text-muted-foreground" />}
                                                </Button>
                                            </div>
                                        </div>
                                        <div className="grid gap-2">
                                            <Label className="uppercase text-xs font-semibold">Roles</Label>
                                            <div className="grid grid-cols-2 gap-2 border rounded-md p-3 bg-slate-50/50">
                                                {rolesLoading ? <Loader2 className="h-4 w-4 animate-spin" /> :
                                                    roles?.map(r => (
                                                        <div key={r.id} className="flex items-center space-x-2">
                                                            <Checkbox id={`create_role_${r.name}`} name={`role_${r.name}`} />
                                                            <Label htmlFor={`create_role_${r.name}`} className="text-[10px] font-normal cursor-pointer uppercase">{r.name.replace(/_/g, ' ')}</Label>
                                                        </div>
                                                    ))}
                                            </div>
                                        </div>
                                        {/* Hidden defaults for required fields in schema */}

                                        <input type="hidden" name="branch" value="Lahore Gulburg" />
                                        <input type="hidden" name="country" value="Pakistan" />

                                        <Button type="submit" disabled={createMutation.isPending} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white">
                                            {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                            Create admin
                                        </Button>
                                    </form>
                                </CardContent>
                            </Card>
                        </div>

                        <div className="lg:col-span-7 space-y-6">
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                <div>
                                    <h3 className="text-xl font-semibold tracking-tight mb-1">Existing admins</h3>
                                    <p className="text-sm text-muted-foreground">Manage existing accounts.</p>
                                </div>
                                <div className="w-full md:w-64">
                                    <div className="relative">
                                        <Users className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                        <Input
                                            placeholder="Search name, email or role..."
                                            className="pl-9 bg-white dark:bg-zinc-900"
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-4">
                                {usersLoading ? <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin text-indigo-600" /></div> : (
                                    filteredUsers?.length === 0 ? (
                                        <div className="text-center p-12 border-2 border-dashed rounded-lg bg-slate-50/50">
                                            <p className="text-muted-foreground">No users found matching "{searchQuery}"</p>
                                            <Button variant="ghost" onClick={() => setSearchQuery("")} className="mt-2 text-indigo-600 hover:text-indigo-700">Clear search</Button>
                                        </div>
                                    ) : (
                                        filteredUsers?.map((user) => (
                                            <UserCard
                                                key={user.id}
                                                user={user}
                                                roles={roles || []}
                                                onUpdate={(id, data) => updateMutation.mutate({ id, data })}
                                                onDelete={(id) => deleteMutation.mutate(id)}
                                                isUpdating={updateMutation.isPending && editingUser?.id === user.id}
                                            />
                                        ))
                                    )
                                )}
                            </div>
                        </div>
                    </div>
                </TabsContent>

                <TabsContent value="settings">
                    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                        <Card className="hover:border-primary cursor-pointer transition-all shadow-sm" onClick={() => setSettingsView("roles")}><CardHeader><CardTitle className="flex items-center gap-2"><Shield className="h-5 w-5 text-primary" /> Roles</CardTitle></CardHeader><CardContent><p className="text-sm text-muted-foreground">Manage system roles and descriptions.</p></CardContent></Card>
                        {/* ... existing settings cards ... */}
                        <Card className="hover:border-primary cursor-pointer transition-all shadow-sm" onClick={() => setSettingsView("ips")}><CardHeader><CardTitle className="flex items-center gap-2"><Globe className="h-5 w-5 text-primary" /> IP Allowlist</CardTitle></CardHeader><CardContent><p className="text-sm text-muted-foreground">Control global IP restrictions.</p></CardContent></Card>
                        <Card className="hover:border-primary cursor-pointer transition-all shadow-sm" onClick={() => setSettingsView("policies")}><CardHeader><CardTitle className="flex items-center gap-2"><Settings className="h-5 w-5 text-primary" /> Global Policies</CardTitle></CardHeader><CardContent><p className="text-sm text-muted-foreground">Configure system-wide settings.</p></CardContent></Card>
                        <Card className="hover:border-primary cursor-pointer transition-all shadow-sm" onClick={() => setSettingsView("locations")}><CardHeader><CardTitle className="flex items-center gap-2"><MapPin className="h-5 w-5 text-primary" /> Locations</CardTitle></CardHeader><CardContent><p className="text-sm text-muted-foreground">Manage Branches & Countries.</p></CardContent></Card>
                    </div>

                    {/* Roles View */}
                    <Dialog open={settingsView === "roles"} onOpenChange={(o) => !o && setSettingsView("none")}>
                        {/* ... same ... */}
                        <DialogContent className="sm:max-w-[700px]">
                            <DialogHeader><DialogTitle className="flex items-center"><Shield className="mr-2 h-5 w-5 text-primary" /> Manage Roles</DialogTitle></DialogHeader>
                            <div className="space-y-4">
                                <div className="flex justify-between items-center"><span className="text-sm text-muted-foreground">Define roles and system identifiers.</span><Button size="sm" variant="outline" onClick={() => setIsAddRoleDialogOpen(true)}><Plus className="mr-2 h-4 w-4" /> Create Role</Button></div>
                                <div className="border rounded-md max-h-[400px] overflow-auto">
                                    <Table>
                                        <TableHeader className="bg-muted/50"><TableRow><TableHead>System Name</TableHead><TableHead>Description</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
                                        <TableBody>
                                            {roles?.map(role => (
                                                <TableRow key={role.id}><TableCell><code className="text-xs bg-muted px-1 rounded">{role.name}</code></TableCell><TableCell className="text-sm text-muted-foreground">{role.description || "N/A"}</TableCell><TableCell className="text-right"><Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setEditingRole(role)}><Pencil className="h-4 w-4" /></Button></TableCell></TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>
                            </div>
                        </DialogContent>
                    </Dialog>

                    {/* IP View and others remain largely same unless they had hardcoded bg */}
                    <Dialog open={settingsView === "ips"} onOpenChange={(o) => !o && setSettingsView("none")}>
                        <DialogContent className="sm:max-w-[600px]">
                            <DialogHeader><DialogTitle className="flex items-center"><Globe className="mr-2 h-5 w-5 text-primary" /> IP Allowlist</DialogTitle></DialogHeader>
                            <div className="space-y-4">
                                <div className="flex justify-between items-center"><span className="text-sm text-muted-foreground">Authorized IP ranges.</span><Button size="sm" variant="outline" onClick={() => setIsAddIpDialogOpen(true)}><Plus className="mr-2 h-4 w-4" /> Add IP</Button></div>
                                <div className="border rounded-md">
                                    <Table>
                                        <TableHeader className="bg-muted/50"><TableRow><TableHead>IP CIDR</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
                                        <TableBody>
                                            {ips?.map(ip => (
                                                <TableRow key={ip.id}><TableCell className="font-mono">{ip.ip_cidr}</TableCell><TableCell><Badge variant={ip.is_active ? "default" : "secondary"}>{ip.is_active ? "Allowed" : "Blocked"}</Badge></TableCell><TableCell className="text-right"><Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => toggleIpMutation.mutate({ id: ip.id, is_active: !ip.is_active })}>{ip.is_active ? <XCircle className="h-4 w-4 text-red-500" /> : <CheckCircle2 className="h-4 w-4 text-emerald-500" />}</Button></TableCell></TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>
                            </div>
                        </DialogContent>
                    </Dialog>

                    {/* Policies View */}
                    <Dialog open={settingsView === "policies"} onOpenChange={(o) => !o && setSettingsView("none")}>
                        <DialogContent className="sm:max-w-[600px]">
                            <DialogHeader><DialogTitle className="flex items-center"><Settings className="mr-2 h-5 w-5 text-primary" /> Policies</DialogTitle></DialogHeader>
                            <div className="space-y-4">
                                {policies?.map(p => (
                                    <div key={p.id} className="flex flex-col p-3 border rounded-md hover:bg-muted/30">
                                        <div className="flex justify-between items-start"><span className="font-semibold text-sm">{p.key.replace(/_/g, ' ').toUpperCase()}</span><Button variant="ghost" size="sm" className="h-7 text-primary" onClick={() => setEditingPolicy(p)}>Edit</Button></div>
                                        <p className="text-xs text-muted-foreground mb-2">{p.description || "Configuration"}</p>
                                        <code className="text-xs bg-muted border p-1 rounded font-mono truncate">{JSON.stringify(p.value_json)}</code>
                                    </div>
                                ))}
                            </div>
                        </DialogContent>
                    </Dialog>

                    {/* Locations View */}
                    <Dialog open={settingsView === "locations"} onOpenChange={(o) => !o && setSettingsView("none")}>
                        {/* ... same ... */}
                        <DialogContent className="sm:max-w-[700px]">
                            <DialogHeader><DialogTitle className="flex items-center"><MapPin className="mr-2 h-5 w-5 text-primary" /> Manage Locations</DialogTitle></DialogHeader>
                            <div className="space-y-6">
                                <div className="p-4 border rounded-md bg-muted/20">
                                    <div className="flex justify-between items-center mb-2"><h4 className="font-medium">Branches</h4><span className="text-xs text-muted-foreground">Comma-separated list</span></div>
                                    <form onSubmit={(e) => {
                                        e.preventDefault();
                                        const locPolicy = policies?.find(p => p.key === "system_locations");
                                        const formData = new FormData(e.currentTarget);
                                        const branches = (formData.get("branches") as string).split(",").map(s => s.trim()).filter(Boolean);
                                        const currentJson = locPolicy?.value_json || { countries: [] };
                                        policyMutation.mutate({ key: "system_locations", value: { ...currentJson, branches } });
                                    }}>
                                        <div className="flex gap-2">
                                            <Input name="branches" defaultValue={policies?.find(p => p.key === "system_locations")?.value_json?.branches?.join(", ") || "Lahore Gulburg, Lahore Raya, Sialkot Welc, Sialkot webexcels, Gugrawala webexcels, Faislabad webexcels"} />
                                            <Button type="submit" size="sm">Save</Button>
                                        </div>
                                    </form>
                                </div>
                                <div className="p-4 border rounded-md bg-muted/20">
                                    <div className="flex justify-between items-center mb-2"><h4 className="font-medium">Countries</h4><span className="text-xs text-muted-foreground">Comma-separated list</span></div>
                                    <form onSubmit={(e) => {
                                        e.preventDefault();
                                        const locPolicy = policies?.find(p => p.key === "system_locations");
                                        const formData = new FormData(e.currentTarget);
                                        const countries = (formData.get("countries") as string).split(",").map(s => s.trim()).filter(Boolean);
                                        const currentJson = locPolicy?.value_json || { branches: [] };
                                        policyMutation.mutate({ key: "system_locations", value: { ...currentJson, countries } });
                                    }}>
                                        <div className="flex gap-2">
                                            <Input name="countries" defaultValue={policies?.find(p => p.key === "system_locations")?.value_json?.countries?.join(", ") || "UAE, USA, Pakistan"} />
                                            <Button type="submit" size="sm">Save</Button>
                                        </div>
                                    </form>
                                </div>
                            </div>
                        </DialogContent>
                    </Dialog>
                </TabsContent>
            </Tabs>

            {/* Sub-Dialogs for Settings */}
            <Dialog open={isAddRoleDialogOpen || !!editingRole} onOpenChange={(o) => { if (!o) { setIsAddRoleDialogOpen(false); setEditingRole(null); } }}>
                <DialogContent>
                    <form onSubmit={handleRoleSubmit}>
                        <DialogHeader><DialogTitle>{editingRole ? "Edit Role" : "Create New Role"}</DialogTitle></DialogHeader>
                        <div className="grid gap-4 py-4">
                            <div className="grid gap-2"><Label>System Name (No spaces)</Label><Input name="name" defaultValue={editingRole?.name} required placeholder="e.g. branch_manager" readOnly={!!editingRole} /></div>
                            <div className="grid gap-2"><Label>Description</Label><Input name="description" defaultValue={editingRole?.description} placeholder="Describe permissions" /></div>
                        </div>
                        <DialogFooter><Button type="submit" disabled={roleMutation.isPending}>{roleMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save Role</Button></DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            <Dialog open={isAddIpDialogOpen} onOpenChange={setIsAddIpDialogOpen}>
                <DialogContent>
                    <form onSubmit={handleIpSubmit}>
                        <DialogHeader><DialogTitle>Add IP CIDR</DialogTitle></DialogHeader>
                        <div className="grid gap-4 py-4">
                            <div className="grid gap-2"><Label>IP Range (CIDR)</Label><Input name="ip_cidr" required placeholder="e.g. 192.168.1.1/32" /></div>
                            <div className="grid gap-2"><Label>Description</Label><Input name="description" placeholder="e.g. Office HQ" /></div>
                        </div>
                        <DialogFooter><Button type="submit" disabled={ipMutation.isPending}>{ipMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Add IP</Button></DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            <Dialog open={!!editingPolicy} onOpenChange={(o) => !o && setEditingPolicy(null)}>
                <DialogContent>
                    <form onSubmit={handlePolicySubmit}>
                        <DialogHeader><DialogTitle>Edit Policy: {editingPolicy?.key}</DialogTitle></DialogHeader>
                        <div className="py-4">
                            <Label>Value (JSON or Text)</Label>
                            <Input name="value" defaultValue={JSON.stringify(editingPolicy?.value_json)} className="mt-2" />
                        </div>
                        <DialogFooter><Button type="submit" disabled={policyMutation.isPending}>Save changes</Button></DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Edit User Dialog */}
            <Dialog open={!!editingUser} onOpenChange={(o) => { if (!o) setEditingUser(null); }}>
                <DialogContent className="sm:max-w-[500px]">
                    {editingUser && (
                        <form onSubmit={handleUpdateUser}>
                            <DialogHeader><DialogTitle className="text-[14px] font-bold">Edit User: {editingUser.fullName}</DialogTitle></DialogHeader>
                            <div className="grid gap-4 py-4">
                                <div className="grid gap-1.5"><Label className="text-[12px] font-bold text-muted-foreground mr-1">Full Name</Label><Input name="fullName" defaultValue={editingUser.fullName} className="text-[12px] h-9" /></div>
                                <div className="grid gap-1.5">
                                    <Label className="text-[12px] font-bold text-muted-foreground mr-1">Roles</Label>
                                    <div className="grid grid-cols-2 gap-2 border rounded-md p-3 bg-slate-50/50 max-h-[160px] overflow-y-auto">
                                        {roles?.map(r => (
                                            <div key={r.id} className="flex items-center space-x-2">
                                                <Checkbox
                                                    id={`edit_role_${r.name}`}
                                                    name={`role_${r.name}`}
                                                    defaultChecked={editingUser.roles?.includes(r.name) || editingUser.role === r.name}
                                                />
                                                <Label htmlFor={`edit_role_${r.name}`} className="text-[11px] font-normal cursor-pointer uppercase">{r.name.replace(/_/g, ' ')}</Label>
                                            </div>
                                        ))}
                                    </div>
                                    <input type="hidden" name="role" defaultValue={editingUser.role} />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="grid gap-1.5"><Label className="text-[12px] font-bold text-muted-foreground mr-1">Branch</Label>
                                        <Select name="branch" defaultValue={editingUser.branch || "Lahore Gulburg"}>
                                            <SelectTrigger className="text-[12px] h-9"><SelectValue placeholder="Select Branch" /></SelectTrigger>
                                            <SelectContent>
                                                {(policies?.find(p => p.key === "system_locations")?.value_json?.branches || ["Lahore Gulburg", "Lahore Raya", "Sialkot Welc", "Sialkot webexcels", "Gugrawala webexcels", "Faislabad webexcels"]).map((b: string) => (
                                                    <SelectItem key={b} value={b} className="text-[12px]">{b}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="grid gap-1.5"><Label className="text-[12px] font-bold text-muted-foreground mr-1">Country</Label>
                                        <Select name="country" defaultValue={editingUser.country || "Pakistan"}>
                                            <SelectTrigger className="text-[12px] h-9"><SelectValue placeholder="Select Country" /></SelectTrigger>
                                            <SelectContent>
                                                {(policies?.find(p => p.key === "system_locations")?.value_json?.countries || ["UAE", "USA", "Pakistan"]).map((c: string) => (
                                                    <SelectItem key={c} value={c} className="text-[12px]">{c}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                                <div className="grid gap-1.5"><Label className="text-[12px] font-bold text-muted-foreground mr-1">New Password (Opt)</Label><Input name="password" type="password" placeholder="Leave blank to keep" className="text-[12px] h-9" /></div>
                                <div className="flex items-center space-x-2 py-2 border-t"><Checkbox id="edit-isActive" name="isActive" defaultChecked={editingUser.isActive} /><Label htmlFor="edit-isActive" className="text-[12px] font-bold text-emerald-600">Account Active</Label></div>
                            </div>
                            <DialogFooter><Button type="submit" disabled={updateMutation.isPending} className="w-full text-[12px] font-bold h-10">Save Changes</Button></DialogFooter>
                        </form>
                    )}
                </DialogContent>
            </Dialog>
        </div >
    );
}

const UserCard = ({ user, roles, onUpdate, onDelete, isUpdating }: { user: User & { password?: string }, roles: Role[], onUpdate: (id: string, data: any) => void, onDelete: (id: string) => void, isUpdating: boolean }) => {
    const [formData, setFormData] = useState({
        fullName: user.fullName || "",
        email: user.email || "",
        role: user.role || "",
        roles: (user.roles && user.roles.length > 0) ? user.roles : (user.role ? [user.role] : []),
        password: user.password || ""
    });
    const [showPassword, setShowPassword] = useState(false);

    const handleChange = (field: string, value: string) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    const handleSave = () => {
        // Sync the legacy role field with the first selected role
        const dataToSend = {
            ...formData,
            role: formData.roles.length > 0 ? formData.roles[0] : formData.role,
        };
        onUpdate(user.id, dataToSend);
    };

    return (
        <Card className="border-border shadow-sm overflow-hidden">
            <CardContent className="p-4 space-y-4 bg-muted/40 text-foreground">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Name</Label>
                        <Input
                            value={formData.fullName}
                            onChange={e => handleChange("fullName", e.target.value)}
                            className="h-9"
                            autoComplete="off"
                        />
                    </div>
                    <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Email</Label>
                        <Input
                            value={formData.email}
                            onChange={e => handleChange("email", e.target.value)}
                            className="h-9"
                            autoComplete="off"
                        />
                    </div>
                </div>

                <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground uppercase">Roles</Label>
                    <div className="grid grid-cols-2 gap-2 border rounded-md p-2 bg-slate-50/50">
                        {roles.map(r => (
                            <div key={r.id} className="flex items-center space-x-2">
                                <Checkbox
                                    id={`card_role_${user.id}_${r.name}`}
                                    checked={formData.roles.includes(r.name)}
                                    onCheckedChange={(checked) => {
                                        const newRoles = checked
                                            ? [...formData.roles, r.name]
                                            : formData.roles.filter(role => role !== r.name);
                                        setFormData(prev => ({ ...prev, roles: newRoles }));
                                    }}
                                />
                                <Label htmlFor={`card_role_${user.id}_${r.name}`} className="text-[10px] font-normal cursor-pointer uppercase">{r.name.replace(/_/g, ' ')}</Label>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Password</Label>
                    <div className="relative">
                        <Input
                            type={showPassword ? "text" : "password"}
                            placeholder={user.password ? "Enter new password" : "Set password"}
                            value={formData.password}
                            onChange={e => handleChange("password", e.target.value)}
                            className="h-9 pr-10"
                            autoComplete="new-password"
                        />
                        <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                            onClick={() => setShowPassword(!showPassword)}
                        >
                            {showPassword ? <EyeOff className="h-4 w-4 text-muted-foreground hover:text-foreground" /> : <Eye className="h-4 w-4 text-muted-foreground hover:text-foreground" />}
                        </Button>
                    </div>
                </div>

                <div className="flex justify-between items-center pt-2">
                    <div className="text-xs text-muted-foreground">
                        {user.isActive ? <span className="text-emerald-600 flex items-center gap-1"><CheckCircle2 className="h-3 w-3" /> Active</span> : <span className="text-red-500 flex items-center gap-1"><XCircle className="h-3 w-3" /> Inactive</span>}
                    </div>
                    <div className="flex gap-2">
                        <Button
                            size="sm"
                            variant="default"
                            onClick={handleSave}
                            disabled={isUpdating}
                            className=""
                        >
                            {isUpdating ? <Loader2 className="h-3 w-3 animate-spin" /> : "Save"}
                        </Button>
                        <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => onDelete(user.id)}
                            className="bg-red-50 text-red-600 hover:bg-red-100 border border-red-200 shadow-none"
                        >
                            Delete
                        </Button>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
};
