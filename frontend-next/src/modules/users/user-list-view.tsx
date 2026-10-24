"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/query/query-client";
import { useToast } from "@/lib/hooks/use-legacy-toast";
import { useRouter } from "next/navigation";
import { USERS_ADD } from "@/lib/navigation/users-routes";
import { format } from "date-fns";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { Field } from "@/components/ui/field";
import {
    DrmSection,
    drmFieldClass,
    drmPanelClass,
    UsersFormSection,
    usersDialogShellClass,
    usersDialogHeaderClass,
    usersDialogBodyClass,
    usersDialogFooterClass,
    usersDropdownReserveClass,
} from "@/modules/users/users-ui";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils/cn";
import { Textarea } from "@/components/ui/textarea";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/legacy/select";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    DialogDescription,
} from "@/components/ui/legacy/dialog";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
    DropdownMenuSeparator,
} from "@/components/ui/legacy/dropdown-menu";
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

export function UserListPage() {
    const { toast } = useToast();
    const router = useRouter();
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

    const columns = useMemo((): DataTableColumn<User>[] => {
        const statusVariant = (status: string): "success" | "neutral" =>
            status === "active" ? "success" : "neutral";

        return [
            {
                id: "name",
                header: "Name",
                cell: (user) => (
                    <div className="flex items-center gap-2">
                        <Shield className="h-4 w-4 shrink-0 text-zinc-400" />
                        <span className="font-medium text-zinc-900 dark:text-zinc-100">{user.fullName}</span>
                    </div>
                ),
            },
            {
                id: "email",
                header: "Email",
                cell: (user) => <span className="text-sm text-zinc-600 dark:text-zinc-400">{user.email}</span>,
            },
            {
                id: "role",
                header: "Role",
                cell: (user) => (
                    <Badge variant="brand" className="normal-case tracking-normal">
                        {getRoleLabel(user.role)}
                    </Badge>
                ),
            },
            {
                id: "department",
                header: "Department",
                cell: (user) => (
                    <span className="text-sm text-zinc-500 dark:text-zinc-400">{user.department || "—"}</span>
                ),
            },
            {
                id: "designation",
                header: "Designation",
                cell: (user) => (
                    <span className="text-sm text-zinc-500 dark:text-zinc-400">{user.designation || "—"}</span>
                ),
            },
            {
                id: "phone",
                header: "Phone",
                cell: (user) => (
                    <span className="font-mono text-sm text-zinc-600 dark:text-zinc-400">{user.phone || "—"}</span>
                ),
            },
            {
                id: "status",
                header: "Status",
                cell: (user) => (
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <button
                                type="button"
                                className="inline-flex cursor-pointer rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                            >
                                <Badge variant={statusVariant(user.status)} className="normal-case tracking-normal">
                                    {user.status}
                                </Badge>
                            </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start">
                            <DropdownMenuItem
                                onClick={() =>
                                    updateStatusMutation.mutate({ userId: user.id, status: "active" })
                                }
                            >
                                Set active
                            </DropdownMenuItem>
                            <DropdownMenuItem
                                onClick={() =>
                                    updateStatusMutation.mutate({ userId: user.id, status: "inactive" })
                                }
                            >
                                Set inactive
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                ),
            },
            {
                id: "created",
                header: "Created",
                cell: (user) => (
                    <span className="text-sm text-zinc-500 dark:text-zinc-400">
                        {user.createdAt ? format(new Date(user.createdAt), "MMM dd, yyyy") : "—"}
                    </span>
                ),
            },
            {
                id: "actions",
                header: "",
                headerClassName: "w-32 text-right",
                className: "text-right",
                cell: (user) => (
                    <div className="flex items-center justify-end gap-1">
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
                            onClick={() => handleTeamClick(user)}
                            title="Manage team members"
                            data-testid={`button-team-${user.id}`}
                        >
                            <UserCog className="h-4 w-4" />
                        </Button>
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0"
                            onClick={() => handleEditClick(user)}
                            data-testid={`button-edit-${user.id}`}
                            aria-label="Edit user"
                        >
                            <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40"
                            onClick={() => handleDeleteClick(user)}
                            data-testid={`button-delete-${user.id}`}
                            aria-label="Delete user"
                        >
                            <Trash2 className="h-4 w-4" />
                        </Button>
                    </div>
                ),
            },
        ];
    }, [getRoleLabel, handleDeleteClick, handleEditClick, handleTeamClick, updateStatusMutation]);

    return (
        <div className="space-y-4">
            <PageHeader
                eyebrow="Users"
                title="User list"
                description={`Search, edit, activate, or remove employee accounts (${filteredUsers.length} shown).`}
                actions={
                    <Button type="button" variant="primary" size="sm" onClick={() => router.push(USERS_ADD)} data-testid="button-add-user">
                        <UserPlus className="mr-2 h-4 w-4" />
                        Add user
                    </Button>
                }
            />

            <DrmSection
                title="Employees"
                description="Row actions: team, edit, status, and delete."
                actions={
                    <div className="relative z-30 flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-end">
                        <Field id="user-search" label="Search" className="min-w-[220px] flex-1 sm:min-w-[280px]">
                            <div className="relative">
                                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                                <Input
                                    id="user-search"
                                    placeholder="Name, email, or phone…"
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    className={cn(drmFieldClass, "pl-9")}
                                    data-testid="input-search"
                                />
                            </div>
                        </Field>
                        <Field id="user-role-filter" label="Role" className="w-full sm:w-44">
                            <Select value={roleFilter} onValueChange={setRoleFilter}>
                                <SelectTrigger id="user-role-filter" className={drmFieldClass} data-testid="select-role">
                                    <SelectValue placeholder="All roles" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All roles</SelectItem>
                                    {allRoles.map((role) => (
                                        <SelectItem key={role.value} value={role.value}>
                                            {role.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </Field>
                    </div>
                }
            >
                <DataTable
                    columns={columns}
                    rows={filteredUsers}
                    rowKey={(row) => row.id}
                    loading={isLoading}
                    emptyMessage="No users match your filters."
                />
            </DrmSection>

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
                        <Button variant="secondary" onClick={() => setDeleteDialogOpen(false)}>
                            Cancel
                        </Button>
                        <Button
                            variant="danger"
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
                <DialogContent className={cn(usersDialogShellClass, "max-w-4xl")}>
                    <DialogHeader className={usersDialogHeaderClass}>
                        <DialogTitle className="text-zinc-900 dark:text-zinc-100">Edit user</DialogTitle>
                        <DialogDescription className="text-zinc-500 dark:text-zinc-400">
                            Update account details, roles, and payroll fields.
                        </DialogDescription>
                    </DialogHeader>
                    <div className={usersDialogBodyClass}>
                    {userToEdit && (
                        <div className="space-y-4">
                            <UsersFormSection title="Personal information">
                                {/* Row 1 */}
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">First Name <span className="text-red-500">*</span></label>
                                        <Input className={drmFieldClass} value={editForm.firstName} onChange={(e) => setEditForm({ ...editForm, firstName: e.target.value })} placeholder="First name" />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">Father / Husband Name <span className="text-red-500">*</span></label>
                                        <Input className={drmFieldClass} value={editForm.fatherHusbandName} onChange={(e) => setEditForm({ ...editForm, fatherHusbandName: e.target.value })} placeholder="Father/Husband name" />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">Attendance ID</label>
                                        <Input className={drmFieldClass} value={editForm.attendanceId} onChange={(e) => setEditForm({ ...editForm, attendanceId: e.target.value })} placeholder="Attendance ID" />
                                    </div>
                                </div>
                                {/* Row 2 */}
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">Email <span className="text-red-500">*</span></label>
                                        <Input className={drmFieldClass} type="email" value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} placeholder="Email" />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">Mobile <span className="text-red-500">*</span></label>
                                        <Input className={drmFieldClass} value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} placeholder="03XXXXXXXXX" maxLength={11} />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">Guardian's Mobile</label>
                                        <Input className={drmFieldClass} value={editForm.guardianMobile} onChange={(e) => setEditForm({ ...editForm, guardianMobile: e.target.value })} placeholder="03XXXXXXXXX" maxLength={11} />
                                    </div>
                                </div>
                                {/* Row 3 */}
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">Passport / CNIC <span className="text-red-500">*</span></label>
                                        <Input className={drmFieldClass} value={editForm.passportCnic} onChange={(e) => setEditForm({ ...editForm, passportCnic: e.target.value })} placeholder="CNIC or Passport" />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">Facebook ID</label>
                                        <Input className={drmFieldClass} value={editForm.facebookId} onChange={(e) => setEditForm({ ...editForm, facebookId: e.target.value })} placeholder="Facebook ID" />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">Date of Birth <span className="text-red-500">*</span></label>
                                        <Input className={drmFieldClass} type="date" value={editForm.dateOfBirth} onChange={(e) => setEditForm({ ...editForm, dateOfBirth: e.target.value })} />
                                    </div>
                                </div>
                            </UsersFormSection>

                            <UsersFormSection title="Employment">
                                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Join date <span className="text-red-500">*</span></label>
                                        <Input className={drmFieldClass} type="date" value={editForm.joinDate} onChange={(e) => setEditForm({ ...editForm, joinDate: e.target.value })} />
                                    </div>
                                </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Role type <span className="text-red-500">*</span></label>
                                        <div
                                            ref={editRoleDropdownRef}
                                            className={cn("relative z-20", editRoleDropdownOpen && usersDropdownReserveClass)}
                                        >
                                            {/* Tags input area */}
                                            <div
                                                className={cn(
                                                    drmFieldClass,
                                                    "flex min-h-9 cursor-pointer flex-wrap items-center gap-1.5 px-2 py-1.5 hover:border-emerald-500/50",
                                                )}
                                                onClick={() => {
                                                    setEditUwOpen(false);
                                                    setEditRoleDropdownOpen(!editRoleDropdownOpen);
                                                }}
                                            >
                                                {editForm.roleType.map((val) => {
                                                    const roleInfo = allRoles.find(r => r.value === val);
                                                    return (
                                                        <span
                                                            key={val}
                                                            className="inline-flex items-center gap-1 rounded border border-emerald-500/25 bg-emerald-500/10 px-2 py-0.5 text-sm font-medium text-emerald-800 dark:text-emerald-200"
                                                        >
                                                            <button
                                                                type="button"
                                                                className="rounded-sm p-0.5 transition-colors hover:bg-emerald-500/20"
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
                                                    <div className={cn(drmPanelClass, "absolute z-[100] mt-1 max-h-[220px] w-full overflow-y-auto shadow-lg")}>
                                                        {Object.keys(availableGroups).length === 0 ? (
                                                            <div className="px-3 py-2 text-sm text-muted-foreground">All roles selected</div>
                                                        ) : (
                                                            Object.entries(availableGroups).map(([groupName, roles]) => (
                                                                <div key={groupName}>
                                                                    <div className="border-b border-zinc-200 bg-zinc-50 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-zinc-500 dark:border-zinc-800 dark:bg-zinc-950/80 dark:text-zinc-400">
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
                                        <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Under works <span className="text-red-500">*</span></label>
                                        <div
                                            ref={editUwRef}
                                            className={cn("relative z-10", editUwOpen && usersDropdownReserveClass)}
                                        >
                                            {/* Trigger */}
                                            <div
                                                className={cn(
                                                    drmFieldClass,
                                                    "flex min-h-9 cursor-pointer items-center justify-between hover:border-emerald-500/50",
                                                )}
                                                onClick={() => {
                                                    setEditRoleDropdownOpen(false);
                                                    setEditUwOpen(!editUwOpen);
                                                    setEditUwSearch("");
                                                }}
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
                                                    <div className={cn(drmPanelClass, "absolute z-[100] mt-1 w-full shadow-lg")}>
                                                        {/* Search box */}
                                                        <div className="border-b border-zinc-200 p-2 dark:border-zinc-800">
                                                            <Input
                                                                placeholder="Search..."
                                                                value={editUwSearch}
                                                                onChange={(e) => setEditUwSearch(e.target.value)}
                                                                className={cn(drmFieldClass, "h-9 text-sm")}
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
                                                                            <div className="bg-zinc-50 px-3 py-1.5 text-xs font-semibold text-zinc-600 dark:bg-zinc-950/80 dark:text-zinc-400">
                                                                                {group.groupLabel}
                                                                            </div>
                                                                        )}
                                                                        {group.items.map((item) => (
                                                                            <div
                                                                                key={item.value}
                                                                                className={cn(
                                                                                    "cursor-pointer px-4 py-2 text-sm transition-colors",
                                                                                    editForm.underWorks === item.value
                                                                                        ? "bg-emerald-600 text-white"
                                                                                        : "hover:bg-emerald-600/10 dark:hover:bg-emerald-500/15",
                                                                                )}
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
                                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Department</label>
                                        <Input className={drmFieldClass} value={editForm.department} onChange={(e) => setEditForm({ ...editForm, department: e.target.value })} placeholder="Department" />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Designation</label>
                                        <Input className={drmFieldClass} value={editForm.designation} onChange={(e) => setEditForm({ ...editForm, designation: e.target.value })} placeholder="Designation" />
                                    </div>
                                </div>
                            </UsersFormSection>

                            <UsersFormSection title="Salary & allowances">
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">Basic Salary <span className="text-red-500">*</span></label>
                                        <Input className={drmFieldClass} type="number" value={editForm.basicSalary} onChange={(e) => setEditForm({ ...editForm, basicSalary: e.target.value })} placeholder="0" />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">Daily Allowance</label>
                                        <Input className={drmFieldClass} type="number" value={editForm.dailyAllowance} onChange={(e) => setEditForm({ ...editForm, dailyAllowance: e.target.value })} placeholder="0" />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">Mobile Allowance</label>
                                        <Input className={drmFieldClass} type="number" value={editForm.mobileAllowance} onChange={(e) => setEditForm({ ...editForm, mobileAllowance: e.target.value })} placeholder="0" />
                                    </div>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">Admin Allowance</label>
                                        <Input className={drmFieldClass} type="number" value={editForm.adminAllowance} onChange={(e) => setEditForm({ ...editForm, adminAllowance: e.target.value })} placeholder="0" />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">Conveyance Allowance</label>
                                        <Input className={drmFieldClass} type="number" value={editForm.conveyanceAllowance} onChange={(e) => setEditForm({ ...editForm, conveyanceAllowance: e.target.value })} placeholder="0" />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">Relaxation Minutes</label>
                                        <Input className={drmFieldClass} type="number" value={editForm.relaxationMinutes} onChange={(e) => setEditForm({ ...editForm, relaxationMinutes: e.target.value })} placeholder="0" />
                                    </div>
                                </div>
                            </UsersFormSection>

                            <UsersFormSection title="Additional">
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">Increment</label>
                                        <Select value={editForm.increment} onValueChange={(val) => setEditForm({ ...editForm, increment: val })}>
                                            <SelectTrigger className={drmFieldClass}>
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
                                            <SelectTrigger className={drmFieldClass}>
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
                                    <Textarea className={drmFieldClass} value={editForm.address} onChange={(e) => setEditForm({ ...editForm, address: e.target.value })} placeholder="Enter address" />
                                </div>
                            </UsersFormSection>
                        </div>
                    )}
                    </div>
                    <DialogFooter className={usersDialogFooterClass}>
                        <Button type="button" variant="secondary" onClick={() => setEditDialogOpen(false)}>
                            Cancel
                        </Button>
                        <Button
                            type="button"
                            variant="primary"
                            onClick={handleUpdateUser}
                            disabled={updateMutation.isPending}
                        >
                            {updateMutation.isPending ? "Saving…" : "Save changes"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
            {/* ─── Team Members Dialog ─────────────────────────────── */}
            <Dialog open={teamDialogOpen} onOpenChange={(open) => { setTeamDialogOpen(open); if (!open) setTeamManager(null); }}>
                <DialogContent className={cn(usersDialogShellClass, "max-w-2xl")}>
                    <DialogHeader className={usersDialogHeaderClass}>
                        <DialogTitle className="flex items-center gap-2 text-zinc-900 dark:text-zinc-100">
                            <UserCog className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                            Team members
                        </DialogTitle>
                        <DialogDescription className="text-zinc-500 dark:text-zinc-400">
                            Managing team for{" "}
                            <span className="font-semibold text-zinc-800 dark:text-zinc-200">{teamManager?.fullName}</span>
                            <span className="text-xs"> ({teamManager?.role})</span>
                        </DialogDescription>
                    </DialogHeader>

                    <div className={cn(usersDialogBodyClass, "space-y-4")}>
                        <UsersFormSection title="Current team">
                            <div className="mb-3 flex items-center gap-2">
                                <Badge variant="brand" className="normal-case tracking-normal">
                                    {teamMembers.length} member{teamMembers.length === 1 ? "" : "s"}
                                </Badge>
                            </div>
                            {teamMembers.length === 0 ? (
                                <p className={cn(drmPanelClass, "py-8 text-center text-sm text-zinc-500 dark:text-zinc-400")}>
                                    No team members yet. Add people below.
                                </p>
                            ) : (
                                <div className="max-h-48 space-y-2 overflow-y-auto pr-1">
                                    {teamMembers.map((m: any) => (
                                        <div
                                            key={m.id}
                                            className="flex items-center justify-between rounded-lg border border-zinc-200 px-3 py-2 transition-colors hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-800/50"
                                        >
                                            <div className="flex min-w-0 items-center gap-2">
                                                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-sm font-semibold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">
                                                    {(m.fullName || m.name || "?")[0].toUpperCase()}
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">{m.fullName || m.name}</p>
                                                    <p className="truncate text-xs text-zinc-500 dark:text-zinc-400">{m.email} · {m.role}</p>
                                                </div>
                                            </div>
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="sm"
                                                className="h-8 w-8 shrink-0 p-0 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40"
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
                        </UsersFormSection>

                        <UsersFormSection title="Add member">
                            <div className="relative mb-3">
                                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                                <Input
                                    className={cn(drmFieldClass, "pl-9")}
                                    placeholder="Search by name or email…"
                                    value={memberSearch}
                                    onChange={(e) => setMemberSearch(e.target.value)}
                                />
                            </div>
                            <div className="max-h-56 space-y-1.5 overflow-y-auto pr-1">
                                {filteredAvailable.length === 0 ? (
                                    <p className="py-6 text-center text-sm text-zinc-500 dark:text-zinc-400">
                                        {memberSearch ? "No matching users" : "Everyone is already on this team"}
                                    </p>
                                ) : (
                                    filteredAvailable.map((u) => (
                                        <div
                                            key={u.id}
                                            className="flex items-center justify-between rounded-lg border border-zinc-200 px-3 py-2 transition-colors hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-800/50"
                                        >
                                            <div className="flex min-w-0 items-center gap-2">
                                                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-sm font-semibold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">
                                                    {(u.fullName || "?")[0].toUpperCase()}
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">{u.fullName}</p>
                                                    <p className="truncate text-xs text-zinc-500 dark:text-zinc-400">{u.email} · {u.role}</p>
                                                </div>
                                            </div>
                                            <Button
                                                type="button"
                                                size="sm"
                                                variant="primary"
                                                className="ml-2 shrink-0"
                                                onClick={() => teamManager && addMemberMutation.mutate({ managerId: teamManager.id, memberId: u.id })}
                                                disabled={addMemberMutation.isPending}
                                            >
                                                <Plus className="mr-1 h-3 w-3" /> Add
                                            </Button>
                                        </div>
                                    ))
                                )}
                            </div>
                        </UsersFormSection>
                    </div>

                    <DialogFooter className={usersDialogFooterClass}>
                        <Button type="button" variant="secondary" onClick={() => setTeamDialogOpen(false)}>Close</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
