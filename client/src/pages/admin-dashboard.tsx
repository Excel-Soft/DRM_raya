import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
    Loader2,
    UserPlus,
    Pencil,
    Trash2,
    Shield,
    Settings,
    Users,
    Activity,
    Globe,
    MapPin,
    BookOpen,
    CheckCircle2,
    Clock,
    MessageSquare,
    LayoutDashboard,
    BarChart3,
    ClipboardList,
    FileText
} from "lucide-react";
import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";

interface User {
    id: string;
    fullName: string;
    email: string;
    role: string;
    roles?: string[];
    branch: string;
    country: string;
    isActive: boolean;
    createdAt: string;
}

interface AdminSummary {
    assignedLeads: number;
    trainingProgress: number;
    activeTasks: number;
    supportReplies: number;
    engagementRate: number;
    dataEntryCompletion: number;
}

export default function AdminDashboard() {
    const { toast } = useToast();
    const [activeTab, setActiveTab] = useState("workspace");
    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
    const [editingUser, setEditingUser] = useState<User | null>(null);
    const [reportType, setReportType] = useState<"shift_summary" | "admin_report" | "contact_supervisor" | null>(null);

    const { data: users, isLoading: usersLoading } = useQuery<User[]>({
        queryKey: ["/api/users"],
        queryFn: async () => {
            const res = await apiRequest("GET", "/api/users");
            const data = await res.json();
            return data.users || [];
        }
    });

    const { data: summary, isLoading: summaryLoading } = useQuery<AdminSummary>({
        queryKey: ["/api/admin/activities/summary"],
    });

    const { data: roles, isLoading: rolesLoading } = useQuery<any[]>({
        queryKey: ["/api/settings/roles"],
    });

    const createMutation = useMutation({
        mutationFn: async (newUser: any) => {
            const res = await apiRequest("POST", "/api/users", newUser);
            return res.json();
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
            const res = await apiRequest("PATCH", `/api/users/${id}`, data);
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/users"] });
            setEditingUser(null);
            toast({ title: "User updated successfully" });
        },
    });

    const submitReportMutation = useMutation({
        mutationFn: async (data: any) => {
            const endpoint = reportType === "contact_supervisor"
                ? "/api/admin/activities/contact-supervisor"
                : "/api/admin/activities/reports";
            const res = await apiRequest("POST", endpoint, data);
            return res.json();
        },
        onSuccess: () => {
            setReportType(null);
            toast({
                title: "Success",
                description: reportType === "contact_supervisor" ? "Message sent to supervisor" : "Report submitted successfully"
            });
        },
        onError: (error: any) => {
            toast({ title: "Submission failed", description: error.message, variant: "destructive" });
        },
    });

    const impersonateMutation = useMutation({
        mutationFn: async (id: string) => {
            const res = await apiRequest("POST", `/api/users/${id}/impersonate`);
            return res.json();
        },
        onSuccess: (data) => {
            sessionStorage.setItem("token", data.token);
            toast({ title: "Switched user", description: `Acting as ${data.user.fullName}` });
            setTimeout(() => {
                window.location.href = "/";
            }, 1000);
        },
        onError: (error: any) => {
            toast({ title: "Failed to switch user", description: error.message, variant: "destructive" });
        },
    });

    const deleteMutation = useMutation({
        mutationFn: async (id: string) => {
            await apiRequest("DELETE", `/api/users/${id}`);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/users"] });
            toast({ title: "User deleted successfully" });
        },
    });

    const handleAddUser = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        const data: any = Object.fromEntries(formData);
        
        // Collect multiple roles
        const selectedRoles = [];
        for (const [key, value] of Array.from(formData.entries())) {
            if (key.startsWith('role_') && (value === 'on' || value === 'true')) {
                selectedRoles.push(key.replace('role_', ''));
            }
        }
        
        if (selectedRoles.length > 0) {
            data.roles = selectedRoles;
            data.role = selectedRoles[0]; // Set first selected as primary
        } else {
            toast({ title: "Error", description: "Please select at least one role", variant: "destructive" });
            return;
        }
        
        createMutation.mutate(data);
    };

    const handleUpdateUser = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!editingUser) return;
        const formData = new FormData(e.currentTarget);
        const data: any = Object.fromEntries(formData);
        
        // Collect multiple roles for update
        const selectedRoles = [];
        for (const [key, value] of Array.from(formData.entries())) {
            if (key.startsWith('role_') && (value === 'on' || value === 'true')) {
                selectedRoles.push(key.replace('role_', ''));
            }
        }
        
        if (selectedRoles.length > 0) {
            data.roles = selectedRoles;
            data.role = selectedRoles[0];
        }
        
        updateMutation.mutate({ id: editingUser.id, data });
    };

    const handleReportSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        let data: any;

        if (reportType === "contact_supervisor") {
            data = {
                subject: formData.get("title"),
                message: formData.get("summary")
            };
        } else {
            data = {
                title: formData.get("title"),
                summary: formData.get("summary"),
                type: reportType
            };
        }
        submitReportMutation.mutate(data);
    };

    return (
        <div className="flex-1 space-y-1 p-1 overflow-auto bg-background wide-page text-[12px]">
            <div className="flex items-center justify-between">
                <h2 className="text-[14px] font-bold tracking-tight uppercase">Admin Control Panel</h2>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
                <TabsList className="bg-card shadow-sm">
                    <TabsTrigger value="workspace">Service Manager Workspace</TabsTrigger>
                    <TabsTrigger value="users">Role Management</TabsTrigger>
                </TabsList>

                <TabsContent value="workspace" className="space-y-4">
                    <div className="flex items-center justify-between">
                        <h3 className="text-xl font-semibold">Service Manager Activities</h3>
                        <div className="flex items-center space-x-2">
                            <Button variant="outline" size="sm" onClick={() => setReportType("shift_summary")}>
                                <Clock className="mr-2 h-4 w-4" /> Shift Summary
                            </Button>
                            <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" onClick={() => setReportType("admin_report")}>
                                <CheckCircle2 className="mr-2 h-4 w-4" /> Submit Report
                            </Button>
                        </div>
                    </div>

                    {summaryLoading ? (
                        <div className="flex justify-center p-8">
                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        </div>
                    ) : (
                        <>
                            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                                <Card className="shadow-sm">
                                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                        <CardTitle className="text-sm font-medium">Assigned Leads</CardTitle>
                                        <Users className="h-4 w-4 text-muted-foreground" />
                                    </CardHeader>
                                    <CardContent>
                                        <div className="text-2xl font-bold">{summary?.assignedLeads ?? 0}</div>
                                        <p className="text-xs text-muted-foreground">+2 from yesterday</p>
                                    </CardContent>
                                </Card>
                                <Card className="shadow-sm">
                                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                        <CardTitle className="text-sm font-medium">Training Progress</CardTitle>
                                        <BookOpen className="h-4 w-4 text-muted-foreground" />
                                    </CardHeader>
                                    <CardContent>
                                        <div className="text-2xl font-bold">{summary?.trainingProgress ?? 0}%</div>
                                        <p className="text-xs text-muted-foreground">Completion rate</p>
                                    </CardContent>
                                </Card>
                                <Card className="shadow-sm">
                                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                        <CardTitle className="text-sm font-medium">Active Tasks</CardTitle>
                                        <Clock className="h-4 w-4 text-muted-foreground" />
                                    </CardHeader>
                                    <CardContent>
                                        <div className="text-2xl font-bold">{summary?.activeTasks ?? 0}</div>
                                        <p className="text-xs text-muted-foreground">3 pending review</p>
                                    </CardContent>
                                </Card>
                                <Card className="shadow-sm">
                                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                        <CardTitle className="text-sm font-medium">Support Replies</CardTitle>
                                        <MessageSquare className="h-4 w-4 text-muted-foreground" />
                                    </CardHeader>
                                    <CardContent>
                                        <div className="text-2xl font-bold">{summary?.supportReplies ?? 0}</div>
                                        <p className="text-xs text-muted-foreground">Average response: 12m</p>
                                    </CardContent>
                                </Card>
                            </div>

                            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
                                <Card className="col-span-4 shadow-md bg-card">
                                    <CardHeader>
                                        <CardTitle className="text-lg flex items-center">
                                            <LayoutDashboard className="mr-2 h-5 w-5 text-primary" />
                                            Operational Overview
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="space-y-4">
                                        <div className="rounded-lg border p-4 space-y-3">
                                            <div className="flex items-center justify-between">
                                                <span className="text-sm font-medium">Customer Engagement</span>
                                                <Badge variant="secondary">In Progress</Badge>
                                            </div>
                                            <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                                                <div className="h-full bg-blue-500" style={{ width: `${summary?.engagementRate ?? 0}%` }} />
                                            </div>
                                        </div>
                                        <div className="rounded-lg border p-4 space-y-3">
                                            <div className="flex items-center justify-between">
                                                <span className="text-sm font-medium">Data Entry Completion</span>
                                                <Badge variant="secondary">Review Needed</Badge>
                                            </div>
                                            <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                                                <div className="h-full bg-amber-500" style={{ width: `${summary?.dataEntryCompletion ?? 0}%` }} />
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>

                                <Card className="col-span-3 shadow-md bg-card border-border">
                                    <CardHeader>
                                        <CardTitle className="text-lg flex items-center">
                                            <ClipboardList className="mr-2 h-5 w-5 text-primary" />
                                            Quick Actions
                                        </CardTitle>
                                    </CardHeader>
                                    <CardContent className="grid gap-2">
                                        <Button
                                            variant="outline"
                                            className="justify-start text-sm hover:bg-primary/5 hover:text-primary transition-colors"
                                            onClick={() => setActiveTab("users")}
                                        >
                                            <Users className="mr-2 h-4 w-4" /> View My Team
                                        </Button>
                                        <Button
                                            variant="outline"
                                            className="justify-start text-sm hover:bg-primary/5 hover:text-primary transition-colors"
                                            onClick={() => window.location.href = '/sales/lead-pools'}
                                        >
                                            <BarChart3 className="mr-2 h-4 w-4" /> Lead Performance
                                        </Button>
                                        <Button
                                            variant="outline"
                                            className="justify-start text-sm hover:bg-primary/5 hover:text-primary transition-colors"
                                            onClick={() => setReportType("contact_supervisor")}
                                        >
                                            <MessageSquare className="mr-2 h-4 w-4" /> Contact Supervisor
                                        </Button>
                                    </CardContent>
                                </Card>
                            </div>
                        </>
                    )}
                </TabsContent>

                <TabsContent value="users" className="space-y-4">
                    <div className="flex items-center justify-between">
                        <h3 className="text-xl font-semibold">User & Role Management</h3>
                        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                            <DialogTrigger asChild>
                                <Button className="bg-primary hover:bg-primary/90">
                                    <UserPlus className="mr-2 h-4 w-4" /> Add New User
                                </Button>
                            </DialogTrigger>
                            <DialogContent className="sm:max-w-[500px]">
                                <form onSubmit={handleAddUser}>
                                    <DialogHeader>
                                        <DialogTitle className="text-[14px] font-bold">Add New User</DialogTitle>
                                    </DialogHeader>
                                    <div className="grid gap-3 py-4">
                                        <div className="grid gap-1.5">
                                            <Label htmlFor="fullName" className="text-[12px] font-bold">Full Name</Label>
                                            <Input id="fullName" name="fullName" required placeholder="e.g. John Doe" className="text-[12px] h-9" />
                                        </div>
                                        <div className="grid gap-1.5">
                                            <Label htmlFor="email" className="text-[12px] font-bold">Email address</Label>
                                            <Input id="email" name="email" type="email" required placeholder="e.g. john@example.com" className="text-[12px] h-9" />
                                        </div>
                                        <div className="grid gap-1.5">
                                            <Label htmlFor="password" className="text-[12px] font-bold">Password</Label>
                                            <Input id="password" name="password" type="password" required minLength={6} placeholder="Min. 6 characters" className="text-[12px] h-9" />
                                        </div>
                                        <div className="grid gap-1.5">
                                            <Label className="text-[12px] font-bold">Roles</Label>
                                            <div className="grid grid-cols-2 gap-2 border rounded-md p-3 bg-muted/50 max-h-[160px] overflow-y-auto">
                                                {rolesLoading ? <Loader2 className="h-4 w-4 animate-spin text-[12px]" /> :
                                                    roles?.map((r: any) => (
                                                        <div key={r.id} className="flex items-center space-x-2">
                                                            <Checkbox 
                                                                id={`create_role_${r.name}`} 
                                                                name={`role_${r.name}`} 
                                                                value="on"
                                                            />
                                                            <Label htmlFor={`create_role_${r.name}`} className="text-[11px] font-normal cursor-pointer uppercase">{r.name === 'seo_smm_manager' ? 'SEO/SMM MANAGER' : r.name.replace(/_/g, ' ')}</Label>
                                                        </div>
                                                    ))}
                                            </div>
                                        </div>
                                    </div>
                                    <DialogFooter>
                                        <Button type="submit" disabled={createMutation.isPending} className="w-full text-[12px] font-bold h-10">
                                            {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                            Create User
                                        </Button>
                                    </DialogFooter>
                                </form>
                            </DialogContent>
                        </Dialog>
                    </div>

                    <Card className="shadow-md bg-card border-border">
                        <CardHeader className="py-4 flex flex-row items-center justify-between space-y-0">
                            <CardTitle className="text-lg">System Users</CardTitle>
                            {users && (
                                <Badge variant="outline" className="ml-2 font-mono">
                                    Total Users: {users.length}
                                </Badge>
                            )}
                        </CardHeader>
                        <CardContent>
                            {usersLoading ? (
                                <div className="flex justify-center p-8">
                                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                                </div>
                            ) : (
                                <div className="rounded-md border overflow-hidden">
                                    <div className="max-h-[600px] overflow-y-auto">
                                        <Table>
                                            <TableHeader className="bg-muted/50">
                                                <TableRow>
                                                    <TableHead className="font-semibold">User Details</TableHead>
                                                    <TableHead className="font-semibold">Role</TableHead>
                                                    <TableHead className="font-semibold text-right">Actions</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {users?.map((user) => (
                                                    <TableRow key={user.id} className="hover:bg-muted/30">
                                                        <TableCell>
                                                            <div className="flex flex-col">
                                                                <span className="font-medium text-foreground">{user.fullName}</span>
                                                                <span className="text-xs text-muted-foreground">{user.email}</span>
                                                            </div>
                                                        </TableCell>
                                                        <TableCell>
                                                            <Badge variant="secondary" className="capitalize">
                                                                {user.role.replace("_", " ")}
                                                            </Badge>
                                                        </TableCell>
                                                        <TableCell className="text-right space-x-2">
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                className="h-8 text-xs text-primary hover:text-primary hover:bg-primary/5"
                                                                title="Login as user"
                                                                disabled={impersonateMutation.isPending}
                                                                onClick={() => impersonateMutation.mutate(user.id)}
                                                            >
                                                                {impersonateMutation.isPending ? "Switching..." : "Login As"}
                                                            </Button>
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                className="h-8 w-8 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                                                onClick={() => setEditingUser(user)}
                                                            >
                                                                <Pencil className="h-4 w-4" />
                                                            </Button>
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                                                                onClick={() => deleteMutation.mutate(user.id)}
                                                            >
                                                                <Trash2 className="h-4 w-4" />
                                                            </Button>
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>

            {/* Shift/Report/Contact Submission Dialog */}
            <Dialog open={!!reportType} onOpenChange={(open) => !open && setReportType(null)}>
                <DialogContent className="sm:max-w-[500px]">
                    <DialogHeader>
                        <DialogTitle className="flex items-center">
                            {reportType === "shift_summary" ? (
                                <><Clock className="mr-2 h-5 w-5 text-blue-500" /> End Selection & Shift Summary</>
                            ) : reportType === "contact_supervisor" ? (
                                <><MessageSquare className="mr-2 h-5 w-5 text-amber-500" /> Contact Admin Supervisor</>
                            ) : (
                                <><FileText className="mr-2 h-5 w-5 text-emerald-500" /> Submit Activity Report</>
                            )}
                        </DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleReportSubmit}>
                        <div className="grid gap-4 py-4">
                            <div className="grid gap-2">
                                <Label htmlFor="report-title">{reportType === "contact_supervisor" ? "Subject" : "Report Title"}</Label>
                                <Input id="report-title" name="title" required placeholder={
                                    reportType === "shift_summary" ? "e.g. Night Shift Summary - 26 Jan" :
                                        reportType === "contact_supervisor" ? "e.g. Question about Lead #123" :
                                            "e.g. Client Performance Update"
                                } />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="report-summary">{reportType === "contact_supervisor" ? "Your Message" : "Detailed Summary"}</Label>
                                <Textarea id="report-summary" name="summary" required className="min-h-[150px]" placeholder={
                                    reportType === "contact_supervisor" ? "Type your message to the supervisor here..." :
                                        "Provide full details of activities, achievements, and pending tasks..."
                                } />
                            </div>
                        </div>
                        <DialogFooter>
                            <Button type="submit" disabled={submitReportMutation.isPending} className={
                                reportType === "shift_summary" ? "bg-blue-600 hover:bg-blue-700" :
                                    reportType === "contact_supervisor" ? "bg-amber-600 hover:bg-amber-700" :
                                        "bg-emerald-600 hover:bg-emerald-700"
                            }>
                                {submitReportMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                {reportType === "contact_supervisor" ? "Send Message" : "Submit " + (reportType === "shift_summary" ? "Summary" : "Report")}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Edit User Dialog */}
            <Dialog open={!!editingUser} onOpenChange={(open) => !open && setEditingUser(null)}>
                <DialogContent className="sm:max-w-[500px]">
                    {editingUser && (
                        <form onSubmit={handleUpdateUser}>
                            <DialogHeader>
                                <DialogTitle className="font-bold">Edit User: {editingUser.fullName}</DialogTitle>
                            </DialogHeader>
                            <div className="grid gap-3 py-4">
                                <div className="grid gap-1.5">
                                    <Label htmlFor="edit-fullName" className="font-bold">Full Name</Label>
                                    <Input id="edit-fullName" name="fullName" defaultValue={editingUser.fullName} className="h-9" />
                                </div>
                                <div className="grid gap-1.5">
                                    <Label className="font-bold">Roles</Label>
                                    <div className="grid grid-cols-2 gap-2 border rounded-md p-3 bg-muted/50 max-h-[160px] overflow-y-auto">
                                        {rolesLoading ? <Loader2 className="h-4 w-4 animate-spin" /> :
                                            roles?.map((r: any) => (
                                                <div key={r.id} className="flex items-center space-x-2">
                                                    <Checkbox 
                                                        id={`edit_role_${r.name}`} 
                                                        name={`role_${r.name}`} 
                                                        value="on"
                                                        defaultChecked={editingUser.roles?.includes(r.name) || editingUser.role === r.name} 
                                                    />
                                                    <Label htmlFor={`edit_role_${r.name}`} className="text-[11px] font-normal cursor-pointer uppercase">{r.name === 'seo_smm_manager' ? 'SEO/SMM MANAGER' : r.name.replace(/_/g, ' ')}</Label>
                                                </div>
                                            ))}
                                    </div>
                                </div>
                            </div>
                            <DialogFooter>
                                <Button type="submit" disabled={updateMutation.isPending} className="w-full font-bold h-10">
                                    {updateMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    Save Changes
                                </Button>
                            </DialogFooter>
                        </form>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}
