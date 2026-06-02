import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { format } from "date-fns";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    DialogDescription,
} from "@/components/ui/dialog";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
    DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
    Search,
    UserPlus,
    MoreHorizontal,
    Edit,
    Trash2,
    Users,
    Shield,
    AlertCircle,
    UserMinus,
    UserCog,
    X,
    Plus,
    CheckCircle2,
    ChevronDown,
} from "lucide-react";

type User = {
    id: string;
    fullName: string;
    email: string;
    role: string;
    department?: string;
    designation?: string;
    phone?: string;
    status: string;
    createdAt: string;
};

const ROLES = [
    { value: "all", label: "All Roles" },
    { value: "admin", label: "Admin" },
    { value: "super_hod", label: "Super HOD" },
    { value: "sales_manager", label: "Sales Manager" },
    { value: "sales_assistant_manager", label: "Sales Assistant Manager" },
    { value: "service_manager", label: "Service Manager" },
    { value: "sales_executive", label: "Sales Executive" },
    { value: "account_manager", label: "Account Manager" },
    { value: "developer", label: "Developer" },
    { value: "marketing_manager", label: "Marketing Manager" },
];

const STATUS_COLORS: Record<string, string> = {
    active: "bg-green-500 text-white",
    inactive: "bg-gray-400 text-white",
};

const ROLE_TYPES = [
    { value: "admin", label: "Admin", group: "Admin" },
    { value: "super_hod", label: "Super HOD", group: "Admin" },
    { value: "service_manager", label: "Service Manager", group: "Admin" },
    { value: "sales_manager", label: "Sales Manager", group: "Sales Department" },
    { value: "sales_assistant_manager", label: "Sales Assistant Manager", group: "Sales Department" },
    { value: "sales_executive", label: "Sales Executive", group: "Sales Department" },
    { value: "account_manager", label: "Account Manager", group: "Sales Department" },
    { value: "developer", label: "Developer", group: "IT" },
    { value: "marketing_manager", label: "Marketing Manager", group: "Marketing Department" },
];

const INCREMENT_OPTIONS = [
    { value: "none", label: "Select..." },
    { value: "5", label: "5%" },
    { value: "10", label: "10%" },
    { value: "15", label: "15%" },
    { value: "20", label: "20%" },
    { value: "custom", label: "Custom" },
];

const ROLE_GROUPS = ROLE_TYPES.reduce((acc, role) => {
    if (!acc[role.group]) acc[role.group] = [];
    acc[role.group].push(role);
    return acc;
}, {} as Record<string, typeof ROLE_TYPES>);

const GENDER_OPTIONS = [
    { value: "male", label: "Male" },
    { value: "female", label: "Female" },
    { value: "other", label: "Other" },
];

export default function UserList() {
    const { toast } = useToast();
    const [, setLocation] = useLocation();
    const [search, setSearch] = useState("");
    const [roleFilter, setRoleFilter] = useState("all");
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [userToDelete, setUserToDelete] = useState<User | null>(null);
    const [editDialogOpen, setEditDialogOpen] = useState(false);
    const [userToEdit, setUserToEdit] = useState<User | null>(null);
    const [editForm, setEditForm] = useState({
        fullName: "",
        firstName: "",
        fatherHusbandName: "",
        attendanceId: "",
        email: "",
        phone: "",
        guardianMobile: "",
        passportCnic: "",
        facebookId: "",
        dateOfBirth: "",
        joinDate: "",
        role: "",
        roleType: [] as string[],
        underWorks: "",
        department: "",
        designation: "",
        basicSalary: "",
        dailyAllowance: "",
        mobileAllowance: "",
        adminAllowance: "",
        conveyanceAllowance: "",
        relaxationMinutes: "",
        increment: "",
        gender: "",
        address: "",
    });

    // Team members dialog state
    const [editRoleDropdownOpen, setEditRoleDropdownOpen] = useState(false);
    const editRoleDropdownRef = useRef<HTMLDivElement>(null);
    const [editUwOpen, setEditUwOpen] = useState(false);
    const [editUwSearch, setEditUwSearch] = useState("");
    const editUwRef = useRef<HTMLDivElement>(null);

    // Close edit role dropdown and UW dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (editRoleDropdownRef.current && !editRoleDropdownRef.current.contains(event.target as Node)) {
                setEditRoleDropdownOpen(false);
            }
            if (editUwRef.current && !editUwRef.current.contains(event.target as Node)) {
                setEditUwOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const [teamDialogOpen, setTeamDialogOpen] = useState(false);
    const [teamManager, setTeamManager] = useState<User | null>(null);
    const [memberSearch, setMemberSearch] = useState("");

    // Fetch dynamic roles
    const { data: dynamicRoles } = useQuery({
        queryKey: ["/api/settings/roles"],
        queryFn: async () => {
            const res = await apiRequest("GET", "/api/settings/roles");
            return res.json();
        },
    });

    // Merge static ROLE_TYPES with dynamically fetched roles
    const allRoles = (() => {
        const merged = new Map(ROLE_TYPES.map(r => [r.value, r]));
        if (dynamicRoles && Array.isArray(dynamicRoles)) {
            dynamicRoles.forEach((role: any) => {
                if (!merged.has(role.name)) {
                    merged.set(role.name, {
                        value: role.name,
                        label: role.name.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()),
                        group: "Custom Roles"
                    });
                }
            });
        }
        return Array.from(merged.values());
    })();

    // Fetch users
    const { data: users, isLoading } = useQuery<User[]>({
        queryKey: ["/api/users", search, roleFilter],
        queryFn: async () => {
            const params = new URLSearchParams();
            if (search) params.append("search", search);
            if (roleFilter && roleFilter !== "all") params.append("role", roleFilter);

            const res = await apiRequest("GET", `/api/users?${params.toString()}`);
            const json = await res.json();
            return json.data || json.users || [];
        },
    });

    // Fetch all users for dropdowns (Under Works shouldn't be affected by table filters)
    const { data: allUsers } = useQuery<User[]>({
        queryKey: ["/api/users", "all-for-dropdowns"],
        queryFn: async () => {
            const res = await apiRequest("GET", `/api/users`);
            const json = await res.json();
            return json.data || json.users || [];
        },
    });

    // Fetch team members for a specific manager
    const { data: teamMembersData, refetch: refetchTeam } = useQuery({
        queryKey: ["/api/users", teamManager?.id, "team-members"],
        queryFn: async () => {
            if (!teamManager) return { members: [] };
            const res = await apiRequest("GET", `/api/users/${teamManager.id}/team-members`);
            return res.json();
        },
        enabled: !!teamManager,
    });
    const teamMembers: any[] = teamMembersData?.members || [];

    // Add team member mutation
    const addMemberMutation = useMutation({
        mutationFn: async ({ managerId, memberId }: { managerId: string; memberId: string }) => {
            const res = await apiRequest("POST", `/api/users/${managerId}/team-members`, { memberId });
            return res.json();
        },
        onSuccess: () => {
            refetchTeam();
            toast({ title: "Team member added" });
        },
        onError: () => toast({ title: "Failed to add member", variant: "destructive" }),
    });

    // Remove team member mutation
    const removeMemberMutation = useMutation({
        mutationFn: async ({ managerId, memberId }: { managerId: string; memberId: string }) => {
            const res = await apiRequest("DELETE", `/api/users/${managerId}/team-members/${memberId}`);
            return res.json();
        },
        onSuccess: () => {
            refetchTeam();
            toast({ title: "Team member removed" });
        },
        onError: () => toast({ title: "Failed to remove member", variant: "destructive" }),
    });

    const handleTeamClick = (user: User) => {
        setTeamManager(user);
        setMemberSearch("");
        setTeamDialogOpen(true);
    };

    // Users available to add (not already in team, not the manager themselves)
    const teamMemberIds = new Set(teamMembers.map((m: any) => m.id));
    const availableToAdd = (users || []).filter(
        (u) => u.id !== teamManager?.id && !teamMemberIds.has(u.id)
    );
    const filteredAvailable = availableToAdd.filter((u) =>
        memberSearch === "" ||
        (u.fullName || "").toLowerCase().includes(memberSearch.toLowerCase()) ||
        u.email.toLowerCase().includes(memberSearch.toLowerCase())
    );

    // Delete mutation
    const deleteMutation = useMutation({
        mutationFn: async (userId: string) => {
            return apiRequest("DELETE", `/api/users/${userId}`);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/users"] });
            toast({ title: "User deleted successfully" });
            setDeleteDialogOpen(false);
            setUserToDelete(null);
        },
        onError: () => {
            toast({ title: "Failed to delete user", variant: "destructive" });
        },
    });

    // Update status mutation
    const updateStatusMutation = useMutation({
        mutationFn: async ({ userId, status }: { userId: string; status: string }) => {
            return apiRequest("PATCH", `/api/users/${userId}/status`, { status });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/users"] });
            toast({ title: "Status updated successfully" });
        },
        onError: () => {
            toast({ title: "Failed to update status", variant: "destructive" });
        },
    });

    const handleDeleteClick = (user: User) => {
        setUserToDelete(user);
        setDeleteDialogOpen(true);
    };

    const handleEditClick = async (user: User) => {
        setUserToEdit(user);
        // Fetch full user details for the edit form
        try {
            const res = await apiRequest("GET", `/api/users/${user.id}`);
            const fullUser = await res.json();
            const u = fullUser.user || fullUser.data || fullUser;
            setEditForm({
                fullName: u.fullName || u.full_name || "",
                firstName: u.firstName || u.first_name || u.fullName || "",
                fatherHusbandName: u.fatherHusbandName || u.father_husband_name || "",
                attendanceId: u.attendanceId || u.attendance_id || "",
                email: u.email || "",
                phone: u.phone || u.mobile || "",
                guardianMobile: u.guardianMobile || u.guardian_mobile || "",
                passportCnic: u.passportCnic || u.passport_cnic || "",
                facebookId: u.facebookId || u.facebook_id || "",
                dateOfBirth: u.dateOfBirth || u.date_of_birth || "",
                joinDate: u.joinDate || u.join_date || "",
                role: u.role || "",
                roleType: u.roles || (u.role ? [u.role] : []),
                underWorks: u.underWorks || u.under_works || "",
                department: u.department || "",
                designation: u.designation || "",
                basicSalary: u.basicSalary || u.basic_salary || "",
                dailyAllowance: u.dailyAllowance || u.daily_allowance || "",
                mobileAllowance: u.mobileAllowance || u.mobile_allowance || "",
                adminAllowance: u.adminAllowance || u.admin_allowance || "",
                conveyanceAllowance: u.conveyanceAllowance || u.conveyance_allowance || "",
                relaxationMinutes: u.relaxationMinutes || u.relaxation_minutes || "",
                increment: u.increment || "",
                gender: u.gender || "",
                address: u.address || "",
            });
        } catch {
            setEditForm({
                fullName: user.fullName || "",
                firstName: user.fullName || "",
                fatherHusbandName: "",
                attendanceId: "",
                email: user.email || "",
                phone: user.phone || "",
                guardianMobile: "",
                passportCnic: "",
                facebookId: "",
                dateOfBirth: "",
                joinDate: "",
                role: user.role || "",
                roleType: user.role ? [user.role] : [],
                underWorks: "",
                department: user.department || "",
                designation: user.designation || "",
                basicSalary: "",
                dailyAllowance: "",
                mobileAllowance: "",
                adminAllowance: "",
                conveyanceAllowance: "",
                relaxationMinutes: "",
                increment: "",
                gender: "",
                address: "",
            });
        }
        setEditDialogOpen(true);
    };

    const handleConfirmDelete = () => {
        if (userToDelete) {
            deleteMutation.mutate(userToDelete.id);
        }
    };

    // Update user mutation
    const updateMutation = useMutation({
        mutationFn: async (data: { userId: string; updates: any }) => {
            return apiRequest("PATCH", `/api/users/${data.userId}`, data.updates);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/users"] });
            toast({ title: "User updated successfully" });
            setEditDialogOpen(false);
            setUserToEdit(null);
        },
        onError: () => {
            toast({ title: "Failed to update user", variant: "destructive" });
        },
    });

    const handleUpdateUser = () => {
        if (userToEdit) {
            updateMutation.mutate({
                userId: userToEdit.id,
                updates: {
                    ...editForm,
                    roles: editForm.roleType,
                    roleType: editForm.roleType[0] || editForm.role,
                    mobile: editForm.phone,
                },
            });
        }
    };

    const getRoleLabel = (role: string) => {
        const found = allRoles.find((r) => r.value === role) || ROLES.find((r) => r.value === role);
        return found?.label || role.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase());
    };

    const filteredUsers = users || [];

    return (
        <div className="p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-semibold" data-testid="text-page-title">
                        User Management
                    </h1>
                    <p className="text-muted-foreground mt-1">
                        Manage system users and their roles ({filteredUsers.length} users)
                    </p>
                </div>
                <Button onClick={() => setLocation("/drm/users/add")} data-testid="button-add-user">
                    <UserPlus className="w-4 h-4 mr-2" />
                    Add User
                </Button>
            </div>

            {/* Filters */}
            <Card>
                <CardContent className="pt-4">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-end">
                        {/* Search */}
                        <div className="flex-1 min-w-[200px]">
                            <label className="text-xs font-medium text-muted-foreground mb-1 block">
                                Search
                            </label>
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input
                                    placeholder="Search by name, email, or phone..."
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    className="pl-9"
                                    data-testid="input-search"
                                />
                            </div>
                        </div>

                        {/* Role Filter */}
                        <div className="w-full lg:w-[200px]">
                            <label className="text-xs font-medium text-muted-foreground mb-1 block">
                                Role
                            </label>
                            <Select value={roleFilter} onValueChange={setRoleFilter}>
                                <SelectTrigger data-testid="select-role">
                                    <SelectValue placeholder="All Roles" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All Roles</SelectItem>
                                    {allRoles.map((role) => (
                                        <SelectItem key={role.value} value={role.value}>
                                            {role.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Users Table */}
            <Card>
                <CardContent className="p-0">
                    <div className="w-full overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Name</TableHead>
                                    <TableHead>Email</TableHead>
                                    <TableHead>Role</TableHead>
                                    <TableHead>Department</TableHead>
                                    <TableHead>Designation</TableHead>
                                    <TableHead>Phone</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Created</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading ? (
                                    <TableRow>
                                        <TableCell colSpan={8} className="text-center py-12">
                                            <Users className="h-12 w-12 mx-auto text-muted-foreground mb-3 animate-pulse" />
                                            <p className="text-muted-foreground">Loading users...</p>
                                        </TableCell>
                                    </TableRow>
                                ) : filteredUsers.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={8} className="text-center py-12">
                                            <Users className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                                            <p className="text-muted-foreground">No users found</p>
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    filteredUsers.map((user) => (
                                        <TableRow key={user.id} className="hover:bg-muted/30">
                                            <TableCell className="font-medium">
                                                <div className="flex items-center gap-2">
                                                    <Shield className="h-4 w-4 text-muted-foreground" />
                                                    {user.fullName}
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-sm">{user.email}</TableCell>
                                            <TableCell>
                                                <Badge variant="outline">{getRoleLabel(user.role)}</Badge>
                                            </TableCell>
                                            <TableCell className="text-sm text-muted-foreground">
                                                {user.department || "—"}
                                            </TableCell>
                                            <TableCell className="text-sm text-muted-foreground">
                                                {user.designation || "—"}
                                            </TableCell>
                                            <TableCell className="text-sm font-mono">
                                                {user.phone || "—"}
                                            </TableCell>
                                            <TableCell>
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Badge
                                                            className={`${STATUS_COLORS[user.status] || "bg-gray-400"} cursor-pointer hover:opacity-80`}
                                                        >
                                                            {user.status}
                                                        </Badge>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent>
                                                        <DropdownMenuItem
                                                            onClick={() =>
                                                                updateStatusMutation.mutate({
                                                                    userId: user.id,
                                                                    status: "active",
                                                                })
                                                            }
                                                        >
                                                            <Badge className="bg-green-500 text-white mr-2">Active</Badge>
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem
                                                            onClick={() =>
                                                                updateStatusMutation.mutate({
                                                                    userId: user.id,
                                                                    status: "inactive",
                                                                })
                                                            }
                                                        >
                                                            <Badge className="bg-gray-400 text-white mr-2">Inactive</Badge>
                                                        </DropdownMenuItem>
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            </TableCell>
                                            <TableCell className="text-sm text-muted-foreground">
                                                {user.createdAt
                                                    ? format(new Date(user.createdAt), "MMM dd, yyyy")
                                                    : "—"}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <div className="flex items-center justify-end gap-1">
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-8 w-8 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                                        onClick={() => handleTeamClick(user)}
                                                        title="Manage Team Members"
                                                        data-testid={`button-team-${user.id}`}
                                                    >
                                                        <UserCog className="h-4 w-4" />
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-8 w-8 text-green-600 hover:text-green-700 hover:bg-green-50"
                                                        onClick={() => handleEditClick(user)}
                                                        data-testid={`button-edit-${user.id}`}
                                                    >
                                                        <Edit className="h-4 w-4" />
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                                                        onClick={() => handleDeleteClick(user)}
                                                        data-testid={`button-delete-${user.id}`}
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>

            {/* Delete Confirmation Dialog */}
            <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Delete User</DialogTitle>
                        <DialogDescription>
                            Are you sure you want to delete this user? This action cannot be undone.
                        </DialogDescription>
                    </DialogHeader>
                    {userToDelete && (
                        <div className="py-4">
                            <div className="flex items-center gap-2 p-3 bg-muted rounded-md">
                                <AlertCircle className="h-5 w-5 text-destructive" />
                                <div>
                                    <p className="font-medium">{userToDelete.fullName}</p>
                                    <p className="text-sm text-muted-foreground">{userToDelete.email}</p>
                                </div>
                            </div>
                        </div>
                    )}
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
                            Cancel
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={handleConfirmDelete}
                            disabled={deleteMutation.isPending}
                        >
                            {deleteMutation.isPending ? "Deleting..." : "Delete"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Edit User Dialog - Full Form */}
            <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
                <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Edit User</DialogTitle>
                        <DialogDescription>
                            Update user information and settings
                        </DialogDescription>
                    </DialogHeader>
                    {userToEdit && (
                        <div className="space-y-6 py-4">
                            {/* Section: Personal Information */}
                            <div>
                                <h3 className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wide">Personal Information</h3>
                                {/* Row 1 */}
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">First Name <span className="text-red-500">*</span></label>
                                        <Input value={editForm.firstName} onChange={(e) => setEditForm({ ...editForm, firstName: e.target.value })} placeholder="First name" />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">Father / Husband Name <span className="text-red-500">*</span></label>
                                        <Input value={editForm.fatherHusbandName} onChange={(e) => setEditForm({ ...editForm, fatherHusbandName: e.target.value })} placeholder="Father/Husband name" />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">Attendance ID</label>
                                        <Input value={editForm.attendanceId} onChange={(e) => setEditForm({ ...editForm, attendanceId: e.target.value })} placeholder="Attendance ID" />
                                    </div>
                                </div>
                                {/* Row 2 */}
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">Email <span className="text-red-500">*</span></label>
                                        <Input type="email" value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} placeholder="Email" />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">Mobile <span className="text-red-500">*</span></label>
                                        <Input value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} placeholder="03XXXXXXXXX" maxLength={11} />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">Guardian's Mobile</label>
                                        <Input value={editForm.guardianMobile} onChange={(e) => setEditForm({ ...editForm, guardianMobile: e.target.value })} placeholder="03XXXXXXXXX" maxLength={11} />
                                    </div>
                                </div>
                                {/* Row 3 */}
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">Passport / CNIC <span className="text-red-500">*</span></label>
                                        <Input value={editForm.passportCnic} onChange={(e) => setEditForm({ ...editForm, passportCnic: e.target.value })} placeholder="CNIC or Passport" />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">Facebook ID</label>
                                        <Input value={editForm.facebookId} onChange={(e) => setEditForm({ ...editForm, facebookId: e.target.value })} placeholder="Facebook ID" />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">Date of Birth <span className="text-red-500">*</span></label>
                                        <Input type="date" value={editForm.dateOfBirth} onChange={(e) => setEditForm({ ...editForm, dateOfBirth: e.target.value })} />
                                    </div>
                                </div>
                            </div>

                            {/* Section: Employment */}
                            <div>
                                <h3 className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wide">Employment</h3>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">Join Date <span className="text-red-500">*</span></label>
                                        <Input type="date" value={editForm.joinDate} onChange={(e) => setEditForm({ ...editForm, joinDate: e.target.value })} />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">Role type <span className="text-red-500">*</span></label>
                                        <div ref={editRoleDropdownRef} className="relative">
                                            {/* Tags input area */}
                                            <div
                                                className="flex flex-wrap items-center gap-1.5 min-h-[40px] border rounded-md px-2 py-1.5 cursor-pointer bg-background hover:border-primary/50 transition-colors"
                                                onClick={() => setEditRoleDropdownOpen(!editRoleDropdownOpen)}
                                            >
                                                {editForm.roleType.map((val) => {
                                                    const roleInfo = allRoles.find(r => r.value === val);
                                                    return (
                                                        <span
                                                            key={val}
                                                            className="inline-flex items-center gap-1 bg-primary/10 text-primary border border-primary/20 rounded px-2 py-0.5 text-sm font-medium"
                                                        >
                                                            <button
                                                                type="button"
                                                                className="hover:bg-primary/20 rounded-sm p-0.5 transition-colors"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    const newRoles = editForm.roleType.filter(v => v !== val);
                                                                    setEditForm({ ...editForm, roleType: newRoles, role: newRoles[0] || "" });
                                                                }}
                                                            >
                                                                <X className="w-3 h-3" />
                                                            </button>
                                                            {roleInfo?.label || val.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())}
                                                        </span>
                                                    );
                                                })}
                                                {editForm.roleType.length === 0 && (
                                                    <span className="text-muted-foreground text-sm">Choose roles...</span>
                                                )}
                                                <ChevronDown className={`w-4 h-4 ml-auto text-muted-foreground shrink-0 transition-transform ${editRoleDropdownOpen ? 'rotate-180' : ''}`} />
                                            </div>

                                            {/* Dropdown */}
                                            {editRoleDropdownOpen && (() => {
                                                const selectedValues = editForm.roleType;
                                                const availableRoles = allRoles.filter(r => !selectedValues.includes(r.value));
                                                const availableGroups = availableRoles.reduce((acc, role) => {
                                                    if (!acc[role.group]) acc[role.group] = [];
                                                    acc[role.group].push(role);
                                                    return acc;
                                                }, {} as Record<string, any[]>);

                                                return (
                                                    <div className="absolute z-50 w-full mt-1 bg-popover border rounded-md shadow-lg max-h-[220px] overflow-y-auto">
                                                        {Object.keys(availableGroups).length === 0 ? (
                                                            <div className="px-3 py-2 text-sm text-muted-foreground">All roles selected</div>
                                                        ) : (
                                                            Object.entries(availableGroups).map(([groupName, roles]) => (
                                                                <div key={groupName}>
                                                                    <div className="px-3 py-1.5 text-xs font-bold text-foreground/70 bg-muted/50 uppercase tracking-wide border-b">
                                                                        {groupName}
                                                                    </div>
                                                                    {roles.map((role) => (
                                                                        <div
                                                                            key={role.value}
                                                                            className="px-4 py-2 text-sm cursor-pointer hover:bg-emerald-600 hover:text-white transition-colors"
                                                                            onClick={() => {
                                                                                const newRoles = [...editForm.roleType, role.value];
                                                                                setEditForm({ ...editForm, roleType: newRoles, role: newRoles[0] || role.value });
                                                                            }}
                                                                        >
                                                                            {role.label}
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            ))
                                                        )}
                                                    </div>
                                                );
                                            })()}
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">Under Works*</label>
                                        <div ref={editUwRef} className="relative">
                                            {/* Trigger */}
                                            <div
                                                className="flex items-center justify-between min-h-[40px] border rounded-md px-3 py-2 cursor-pointer bg-background hover:border-primary/50 transition-colors"
                                                onClick={() => { setEditUwOpen(!editUwOpen); setEditUwSearch(""); }}
                                            >
                                                <span className={(() => {
                                                    if (!editForm.underWorks) return "text-sm text-muted-foreground";
                                                    if (editForm.underWorks === "main") return "text-sm";
                                                    const foundUser = (allUsers || []).find(u => u.id === editForm.underWorks);
                                                    return foundUser ? "text-sm" : "text-sm";
                                                })()}>
                                                    {(() => {
                                                        if (!editForm.underWorks || editForm.underWorks === "main") return "Main";
                                                        const foundUser = (allUsers || []).find(u => u.id === editForm.underWorks);
                                                        return foundUser ? foundUser.fullName : editForm.underWorks;
                                                    })()}
                                                </span>
                                                <ChevronDown className={`w-4 h-4 text-muted-foreground shrink-0 transition-transform ${editUwOpen ? 'rotate-180' : ''}`} />
                                            </div>

                                            {/* Dropdown */}
                                            {editUwOpen && (() => {
                                                // Build grouped options from users
                                                const groups: Array<{ groupLabel: string; items: Array<{ value: string; name: string }> }> = [];
                                                groups.push({ groupLabel: "", items: [{ value: "main", name: "Main" }] });

                                                if (allUsers && allUsers.length > 0) {
                                                    const usersByRole: Record<string, Array<{ id: string; fullName: string }>> = {};
                                                    const roleOrder: string[] = [];
                                                    for (const user of allUsers) {
                                                        const role = user.role || "Unknown";
                                                        const roleLabel = role.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase());
                                                        if (!usersByRole[roleLabel]) {
                                                            usersByRole[roleLabel] = [];
                                                            roleOrder.push(roleLabel);
                                                        }
                                                        usersByRole[roleLabel].push(user);
                                                    }
                                                    // Sort roleOrder based on ROLE_TYPES array
                                                    roleOrder.sort((a, b) => {
                                                        const indexA = ROLE_TYPES.findIndex(rt => rt.label.toLowerCase() === a.toLowerCase() || rt.value.replace(/_/g, ' ').toLowerCase() === a.toLowerCase());
                                                        const indexB = ROLE_TYPES.findIndex(rt => rt.label.toLowerCase() === b.toLowerCase() || rt.value.replace(/_/g, ' ').toLowerCase() === b.toLowerCase());
                                                        
                                                        if (indexA !== -1 && indexB !== -1) return indexA - indexB;
                                                        if (indexA !== -1) return -1;
                                                        if (indexB !== -1) return 1;
                                                        return a.localeCompare(b);
                                                    });

                                                    for (const roleLabel of roleOrder) {
                                                        groups.push({
                                                            groupLabel: roleLabel,
                                                            items: usersByRole[roleLabel].map(u => ({ value: u.id, name: u.fullName })),
                                                        });
                                                    }
                                                }

                                                // Filter by search
                                                const filteredGroups = groups
                                                    .map(group => ({
                                                        ...group,
                                                        items: group.items.filter(item =>
                                                            item.name.toLowerCase().includes(editUwSearch.toLowerCase()) ||
                                                            group.groupLabel.toLowerCase().includes(editUwSearch.toLowerCase())
                                                        ),
                                                    }))
                                                    .filter(group => group.items.length > 0);

                                                return (
                                                    <div className="absolute z-50 w-full mt-1 bg-popover border rounded-md shadow-lg">
                                                        {/* Search box */}
                                                        <div className="p-2 border-b">
                                                            <Input
                                                                placeholder="Search..."
                                                                value={editUwSearch}
                                                                onChange={(e) => setEditUwSearch(e.target.value)}
                                                                className="h-8 text-sm"
                                                                autoFocus
                                                                onClick={(e) => e.stopPropagation()}
                                                            />
                                                        </div>
                                                        {/* Options list */}
                                                        <div className="max-h-[220px] overflow-y-auto">
                                                            {filteredGroups.length === 0 ? (
                                                                <div className="px-3 py-2 text-sm text-muted-foreground">No results found</div>
                                                            ) : (
                                                                filteredGroups.map((group, gi) => (
                                                                    <div key={gi}>
                                                                        {group.groupLabel && (
                                                                            <div className="px-3 py-1.5 text-sm font-bold text-foreground/80 bg-muted/30">
                                                                                {group.groupLabel}
                                                                            </div>
                                                                        )}
                                                                        {group.items.map((item) => (
                                                                            <div
                                                                                key={item.value}
                                                                                className={`px-4 py-2 text-sm cursor-pointer transition-colors ${editForm.underWorks === item.value
                                                                                    ? 'bg-emerald-600 text-white'
                                                                                    : 'hover:bg-accent'
                                                                                    }`}
                                                                                onClick={() => {
                                                                                    setEditForm({ ...editForm, underWorks: item.value });
                                                                                    setEditUwOpen(false);
                                                                                }}
                                                                            >
                                                                                {item.name}
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                ))
                                                            )}
                                                        </div>
                                                    </div>
                                                );
                                            })()}
                                        </div>
                                    </div>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">Department</label>
                                        <Input value={editForm.department} onChange={(e) => setEditForm({ ...editForm, department: e.target.value })} placeholder="Department" />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">Designation</label>
                                        <Input value={editForm.designation} onChange={(e) => setEditForm({ ...editForm, designation: e.target.value })} placeholder="Designation" />
                                    </div>
                                </div>
                            </div>

                            {/* Section: Salary & Allowances */}
                            <div>
                                <h3 className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wide">Salary & Allowances</h3>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">Basic Salary <span className="text-red-500">*</span></label>
                                        <Input type="number" value={editForm.basicSalary} onChange={(e) => setEditForm({ ...editForm, basicSalary: e.target.value })} placeholder="0" />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">Daily Allowance</label>
                                        <Input type="number" value={editForm.dailyAllowance} onChange={(e) => setEditForm({ ...editForm, dailyAllowance: e.target.value })} placeholder="0" />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">Mobile Allowance</label>
                                        <Input type="number" value={editForm.mobileAllowance} onChange={(e) => setEditForm({ ...editForm, mobileAllowance: e.target.value })} placeholder="0" />
                                    </div>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">Admin Allowance</label>
                                        <Input type="number" value={editForm.adminAllowance} onChange={(e) => setEditForm({ ...editForm, adminAllowance: e.target.value })} placeholder="0" />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">Conveyance Allowance</label>
                                        <Input type="number" value={editForm.conveyanceAllowance} onChange={(e) => setEditForm({ ...editForm, conveyanceAllowance: e.target.value })} placeholder="0" />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">Relaxation Minutes</label>
                                        <Input type="number" value={editForm.relaxationMinutes} onChange={(e) => setEditForm({ ...editForm, relaxationMinutes: e.target.value })} placeholder="0" />
                                    </div>
                                </div>
                            </div>

                            {/* Section: Additional */}
                            <div>
                                <h3 className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wide">Additional</h3>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">Increment</label>
                                        <Select value={editForm.increment} onValueChange={(val) => setEditForm({ ...editForm, increment: val })}>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select..." />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {INCREMENT_OPTIONS.map((opt) => (
                                                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">Gender <span className="text-red-500">*</span></label>
                                        <Select value={editForm.gender} onValueChange={(val) => setEditForm({ ...editForm, gender: val })}>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Choose..." />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {GENDER_OPTIONS.map((opt) => (
                                                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Address</label>
                                    <Textarea value={editForm.address} onChange={(e) => setEditForm({ ...editForm, address: e.target.value })} placeholder="Enter address" />
                                </div>
                            </div>
                        </div>
                    )}
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
                            Cancel
                        </Button>
                        <Button
                            onClick={handleUpdateUser}
                            disabled={updateMutation.isPending}
                        >
                            {updateMutation.isPending ? "Updating..." : "Update User"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
            {/* ─── Team Members Dialog ─────────────────────────────── */}
            <Dialog open={teamDialogOpen} onOpenChange={(open) => { setTeamDialogOpen(open); if (!open) setTeamManager(null); }}>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <UserCog className="h-5 w-5 text-blue-600" />
                            Team Members
                        </DialogTitle>
                        <DialogDescription>
                            Managing team for: <span className="font-semibold text-foreground">{teamManager?.fullName}</span>
                            {" "}<span className="text-muted-foreground text-xs">({teamManager?.role})</span>
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-5 py-2">
                        {/* Current team members */}
                        <div>
                            <h4 className="text-sm font-semibold mb-2 flex items-center gap-1">
                                <Users className="h-4 w-4" />
                                Current Team
                                <span className="ml-1 rounded-full bg-blue-100 text-blue-700 text-xs px-2 py-0.5">{teamMembers.length}</span>
                            </h4>
                            {teamMembers.length === 0 ? (
                                <p className="text-sm text-muted-foreground text-center py-6 border rounded-md bg-muted/30">
                                    No team members yet. Add members below.
                                </p>
                            ) : (
                                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                                    {teamMembers.map((m: any) => (
                                        <div key={m.id} className="flex items-center justify-between px-3 py-2 rounded-md border bg-card hover:bg-muted/40 transition-colors">
                                            <div className="flex items-center gap-2">
                                                <div className="h-8 w-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-sm font-semibold">
                                                    {(m.fullName || m.name || "?")[0].toUpperCase()}
                                                </div>
                                                <div>
                                                    <p className="text-sm font-medium leading-tight">{m.fullName || m.name}</p>
                                                    <p className="text-xs text-muted-foreground">{m.email} · {m.role}</p>
                                                </div>
                                            </div>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-7 w-7 text-red-500 hover:text-red-700 hover:bg-red-50 flex-shrink-0"
                                                onClick={() => teamManager && removeMemberMutation.mutate({ managerId: teamManager.id, memberId: m.id })}
                                                disabled={removeMemberMutation.isPending}
                                                title="Remove from team"
                                            >
                                                <X className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Divider */}
                        <div className="border-t" />

                        {/* Add new members */}
                        <div>
                            <h4 className="text-sm font-semibold mb-2 flex items-center gap-1">
                                <Plus className="h-4 w-4" />
                                Add Member
                            </h4>
                            <div className="relative mb-3">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <input
                                    className="w-full border rounded-md pl-9 pr-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    placeholder="Search users by name or email..."
                                    value={memberSearch}
                                    onChange={(e) => setMemberSearch(e.target.value)}
                                />
                            </div>
                            <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                                {filteredAvailable.length === 0 ? (
                                    <p className="text-sm text-muted-foreground text-center py-4">
                                        {memberSearch ? "No matching users" : "All users are already in the team"}
                                    </p>
                                ) : (
                                    filteredAvailable.map((u) => (
                                        <div key={u.id} className="flex items-center justify-between px-3 py-2 rounded-md border hover:bg-muted/40 transition-colors">
                                            <div className="flex items-center gap-2 min-w-0">
                                                <div className="h-8 w-8 rounded-full bg-green-100 text-green-700 flex items-center justify-center text-sm font-semibold flex-shrink-0">
                                                    {(u.fullName || "?")[0].toUpperCase()}
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="text-sm font-medium leading-tight truncate">{u.fullName}</p>
                                                    <p className="text-xs text-muted-foreground truncate">{u.email} · {u.role}</p>
                                                </div>
                                            </div>
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                className="ml-2 flex-shrink-0 text-blue-600 border-blue-300 hover:bg-blue-50"
                                                onClick={() => teamManager && addMemberMutation.mutate({ managerId: teamManager.id, memberId: u.id })}
                                                disabled={addMemberMutation.isPending}
                                            >
                                                <Plus className="h-3 w-3 mr-1" /> Add
                                            </Button>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setTeamDialogOpen(false)}>Close</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
