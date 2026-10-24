"use client";

import { useState, useEffect, useRef } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/query/query-client";
import { useToast } from "@/lib/hooks/use-legacy-toast";
import { useRouter } from "next/navigation";
import { USERS_LIST } from "@/lib/navigation/users-routes";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { userFormSchema, type UserFormData } from "@/modules/users/add-user-schema";
import { createUserRequest } from "@/modules/users/users-api";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";
import { DrmFormActions, DrmSection, drmFieldClass, drmPanelClass } from "@/modules/users/users-ui";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/legacy/form";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/legacy/select";
import {
    ChevronLeft,
    ChevronDown,
    Loader2,
    Save,
    X,
} from "lucide-react";

const ROLE_TYPES = [
    { value: "admin", label: "Administrator", group: "Admin" },
    { value: "super_hod", label: "Super HOD", group: "Admin" },
    { value: "service_manager", label: "Service Manager", group: "Admin" },
    { value: "service_assistant_manager", label: "Service Assistant Manager", group: "Service Department" },
    { value: "service_executive", label: "Service Executive", group: "Service Department" },
    { value: "sales_manager", label: "Sales Manager", group: "Sales Department" },
    { value: "sales_assistant_manager", label: "Sales Assistant Manager", group: "Sales Department" },
    { value: "sales_executive", label: "Sales Executive", group: "Sales Department" },
    { value: "account_manager", label: "Account Manager", group: "Sales Department" },
    { value: "developer", label: "Developer", group: "IT" },
    { value: "qa_manager", label: "QA Manager", group: "QA Department" },
    { value: "verification_manager", label: "Verification Manager", group: "Verification Department" },
    { value: "product_posting_manager", label: "Product Posting Manager", group: "Product Posting" },
    { value: "product_posting_executive", label: "Product Posting Executive", group: "Product Posting" },
    { value: "dd_manager", label: "D&D Manager", group: "D&D Department" },
    { value: "dd_executive", label: "D&D Executive", group: "D&D Department" },
    { value: "lead_manager", label: "Lead Manager", group: "Lead Management" },
    { value: "lead_executive", label: "Lead Executive", group: "Lead Management" },
    { value: "marketing_manager", label: "Marketing Manager", group: "Marketing Department" },
];

// Group roles by department for dropdown display
const ROLE_GROUPS = ROLE_TYPES.reduce((acc, role) => {
    if (!acc[role.group]) acc[role.group] = [];
    acc[role.group].push(role);
    return acc;
}, {} as Record<string, typeof ROLE_TYPES>);

// Under Works options will be fetched dynamically from API
const STATIC_UNDER_WORKS = [
    { value: "main", label: "Main", group: "" },
    { value: "deactive", label: "Deactive", group: "" },
];

const INCREMENT_OPTIONS = [
    { value: "none", label: "Select..." },
    { value: "5", label: "5%" },
    { value: "10", label: "10%" },
    { value: "15", label: "15%" },
    { value: "20", label: "20%" },
    { value: "custom", label: "Custom" },
];

const GENDER_OPTIONS = [
    { value: "male", label: "Male" },
    { value: "female", label: "Female" },
    { value: "other", label: "Other" },
];

export function AddUserPage() {
    const { toast } = useToast();
    const router = useRouter();
    const [isSubmitting, setIsSubmitting] = useState(false);

    const { data: usersData } = useQuery({
        queryKey: ["/api/users"],
        queryFn: async () => {
            const res = await apiRequest("GET", "/api/users");
            return res.json();
        },
    });

    const { data: dynamicRoles, isLoading: rolesLoading } = useQuery({
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

    // Build Under Works grouped data from fetched users
    const underWorksGrouped = (() => {
        const groups: Array<{ groupLabel: string; items: Array<{ value: string; name: string }> }> = [];
        // Add static "Main" option as its own group
        groups.push({ groupLabel: "", items: [{ value: "main", name: "Main" }] });

        if (usersData?.users) {
            // Group users by their role
            const usersByRole: Record<string, Array<{ id: string; fullName: string }>> = {};
            const roleOrder: string[] = [];
            for (const user of usersData.users) {
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

            // Add each role group
            for (const roleLabel of roleOrder) {
                groups.push({
                    groupLabel: roleLabel,
                    items: usersByRole[roleLabel].map(u => ({ value: u.id, name: u.fullName })),
                });
            }
        }
        return groups;
    })();

    const form = useForm<UserFormData>({
        resolver: zodResolver(userFormSchema),
        defaultValues: {
            firstName: "",
            fatherHusbandName: "",
            attendanceId: "",
            email: "",
            mobile: "",
            guardianMobile: "",
            passportCnic: "",
            facebookId: "",
            dateOfBirth: "",
            joinDate: "",
            roleType: [],
            underWorks: "",
            basicSalary: "",
            dailyAllowance: "",
            mobileAllowance: "",
            adminAllowance: "",
            conveyanceAllowance: "",
            relaxationMinutes: "",
            increment: "",
            gender: "",
            address: "",
        },
    });

    const createMutation = useMutation({
        mutationFn: createUserRequest,
        onSuccess: () => {
            toast({
                title: "User Added",
                description: "The user has been successfully added to the system.",
            });
            queryClient.invalidateQueries({ queryKey: ["/api/users"] });
            router.push(USERS_LIST);
        },
        onError: (error: Error) => {
            toast({
                title: "Error",
                description: error.message || "Failed to add user. Please try again.",
                variant: "destructive",
            });
        },
    });

    const onSubmit = async (data: UserFormData) => {
        if (createMutation.isPending || isSubmitting) return;
        setIsSubmitting(true);
        try {
            await createMutation.mutateAsync(data);
        } finally {
            setIsSubmitting(false);
        }
    };

    const submitting = isSubmitting || createMutation.isPending;

    return (
        <div className="space-y-4">
            <PageHeader
                eyebrow="Users"
                title="Add user"
                description="Create an employee account with roles, salary, and reporting line."
                actions={
                    <Button type="button" variant="secondary" size="sm" onClick={() => router.push(USERS_LIST)} data-testid="button-back">
                        <ChevronLeft className="mr-1 h-4 w-4" />
                        Back to list
                    </Button>
                }
            />

            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                    <DrmSection title="Personal & contact" description="Identity, contact details, and date of birth.">
                        {/* Row 1: First name, Father/Husband Name, Attendance ID */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                            <FormField
                                control={form.control}
                                name="firstName"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>First name*</FormLabel>
                                        <FormControl>
                                            <Input className={drmFieldClass} {...field} data-testid="input-first-name" />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="fatherHusbandName"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Father / Husband Name *</FormLabel>
                                        <FormControl>
                                            <Input className={drmFieldClass} {...field} data-testid="input-father-husband" />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="attendanceId"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Attendance ID ~</FormLabel>
                                        <FormControl>
                                            <Input className={drmFieldClass} {...field} data-testid="input-attendance-id" />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        {/* Row 2: Email, Mobile, Guardian's Mobile */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                            <FormField
                                control={form.control}
                                name="email"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Email*</FormLabel>
                                        <FormControl>
                                            <Input className={drmFieldClass} type="email" {...field} data-testid="input-email" />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="mobile"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Mobile*</FormLabel>
                                        <FormControl>
                                            <Input className={drmFieldClass} placeholder="03XXXXXXXXX" maxLength={11} {...field} data-testid="input-mobile" />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="guardianMobile"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Guardian's Mobile</FormLabel>
                                        <FormControl>
                                            <Input className={drmFieldClass} placeholder="03XXXXXXXXX" maxLength={11} {...field} data-testid="input-guardian-mobile" />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        {/* Row 3: Passport/CNIC, Facebook ID, Date of Birth */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                            <FormField
                                control={form.control}
                                name="passportCnic"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Passport / CNIC *</FormLabel>
                                        <FormControl>
                                            <Input className={drmFieldClass} {...field} data-testid="input-passport-cnic" />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="facebookId"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Facebook ID</FormLabel>
                                        <FormControl>
                                            <Input className={drmFieldClass} {...field} data-testid="input-facebook-id" />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="dateOfBirth"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Date of Birth*</FormLabel>
                                        <FormControl>
                                            <Input className={drmFieldClass} type="date" {...field} data-testid="input-dob" />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>
                    </DrmSection>

                    <DrmSection title="Employment" description="Join date, roles, and reporting line (Under Works).">
                        {/* Row 4: Join Date, Role type, Under Works */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <FormField
                                control={form.control}
                                name="joinDate"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Join Date*</FormLabel>
                                        <FormControl>
                                            <Input className={drmFieldClass} type="date" {...field} data-testid="input-join-date" />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="roleType"
                                render={({ field }) => {
                                    const [roleDropdownOpen, setRoleDropdownOpen] = useState(false);
                                    const roleDropdownRef = useRef<HTMLDivElement>(null);

                                    // Close dropdown when clicking outside
                                    useEffect(() => {
                                        const handleClickOutside = (event: MouseEvent) => {
                                            if (roleDropdownRef.current && !roleDropdownRef.current.contains(event.target as Node)) {
                                                setRoleDropdownOpen(false);
                                            }
                                        };
                                        document.addEventListener('mousedown', handleClickOutside);
                                        return () => document.removeEventListener('mousedown', handleClickOutside);
                                    }, []);

                                    const selectedValues = field.value || [];
                                    const availableRoles = allRoles.filter((r: any) => !selectedValues.includes(r.value));
                                    const availableGroups = availableRoles.reduce((acc: any, role: any) => {
                                        if (!acc[role.group]) acc[role.group] = [];
                                        acc[role.group].push(role);
                                        return acc;
                                    }, {} as Record<string, any[]>);

                                    return (
                                        <FormItem>
                                            <FormLabel>Role type*</FormLabel>
                                            <div ref={roleDropdownRef} className="relative" data-testid="select-role-type">
                                                {/* Tags input area */}
                                                <div
                                                    className={cn(
                                                        drmFieldClass,
                                                        "flex min-h-9 cursor-pointer flex-wrap items-center gap-1.5 px-2 py-1.5 hover:border-emerald-500/50",
                                                    )}
                                                    onClick={() => setRoleDropdownOpen(!roleDropdownOpen)}
                                                >
                                                    {selectedValues.map((val: string) => {
                                                        const roleInfo = allRoles.find((r: any) => r.value === val);
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
                                                                        field.onChange(selectedValues.filter((v: string) => v !== val));
                                                                    }}
                                                                >
                                                                    <X className="w-3 h-3" />
                                                                </button>
                                                                {roleInfo?.label || val.replace(/_/g, ' ')}
                                                            </span>
                                                        );
                                                    })}
                                                    {selectedValues.length === 0 && (
                                                        <span className="text-muted-foreground text-sm">Choose roles...</span>
                                                    )}
                                                    <ChevronDown className={`w-4 h-4 ml-auto text-muted-foreground shrink-0 transition-transform ${roleDropdownOpen ? 'rotate-180' : ''}`} />
                                                </div>

                                                {/* Dropdown */}
                                                {roleDropdownOpen && (
                                                    <div className={cn(drmPanelClass, "absolute z-50 mt-1 max-h-[220px] w-full overflow-y-auto shadow-lg")}>
                                                        {Object.keys(availableGroups).length === 0 ? (
                                                            <div className="px-3 py-2 text-sm text-muted-foreground">All roles selected</div>
                                                        ) : (
                                                            Object.entries(availableGroups).map(([groupName, roles]: [string, any]) => (
                                                                <div key={groupName}>
                                                                    <div className="px-3 py-1.5 text-xs font-bold text-foreground/70 bg-muted/50 uppercase tracking-wide border-b">
                                                                        {groupName}
                                                                    </div>
                                                                    {roles.map((role: any) => (
                                                                        <div
                                                                            key={role.value}
                                                                            className="px-4 py-2 text-sm cursor-pointer hover:bg-emerald-600 hover:text-white transition-colors"
                                                                            onClick={() => {
                                                                                field.onChange([...selectedValues, role.value]);
                                                                            }}
                                                                            data-testid={`role-option-${role.value}`}
                                                                        >
                                                                            {role.label}
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            ))
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                            <FormMessage />
                                        </FormItem>
                                    );
                                }}
                            />

                            <FormField
                                control={form.control}
                                name="underWorks"
                                render={({ field }) => {
                                    const [uwOpen, setUwOpen] = useState(false);
                                    const [uwSearch, setUwSearch] = useState("");
                                    const uwRef = useRef<HTMLDivElement>(null);

                                    useEffect(() => {
                                        const handleClickOutside = (event: MouseEvent) => {
                                            if (uwRef.current && !uwRef.current.contains(event.target as Node)) {
                                                setUwOpen(false);
                                            }
                                        };
                                        document.addEventListener('mousedown', handleClickOutside);
                                        return () => document.removeEventListener('mousedown', handleClickOutside);
                                    }, []);

                                    // Find selected user's display name
                                    const selectedLabel = (() => {
                                        if (!field.value) return "";
                                        for (const group of underWorksGrouped) {
                                            const item = group.items.find(i => i.value === field.value);
                                            if (item) return item.name;
                                        }
                                        return field.value;
                                    })();

                                    // Filter by search
                                    const filteredGroups = underWorksGrouped
                                        .map(group => ({
                                            ...group,
                                            items: group.items.filter(item =>
                                                item.name.toLowerCase().includes(uwSearch.toLowerCase()) ||
                                                group.groupLabel.toLowerCase().includes(uwSearch.toLowerCase())
                                            ),
                                        }))
                                        .filter(group => group.items.length > 0);

                                    return (
                                        <FormItem>
                                            <FormLabel>Under Works*</FormLabel>
                                            <div ref={uwRef} className="relative" data-testid="select-under-works">
                                                {/* Trigger */}
                                                <div
                                                    className={cn(
                                                        drmFieldClass,
                                                        "flex min-h-9 cursor-pointer items-center justify-between hover:border-emerald-500/50",
                                                    )}
                                                    onClick={() => { setUwOpen(!uwOpen); setUwSearch(""); }}
                                                >
                                                    <span className={selectedLabel ? "text-sm" : "text-sm text-muted-foreground"}>
                                                        {selectedLabel || "Main"}
                                                    </span>
                                                    <ChevronDown className={`w-4 h-4 text-muted-foreground shrink-0 transition-transform ${uwOpen ? 'rotate-180' : ''}`} />
                                                </div>

                                                {/* Dropdown */}
                                                {uwOpen && (
                                                    <div className={cn(drmPanelClass, "absolute z-50 mt-1 w-full shadow-lg")}>
                                                        {/* Search box */}
                                                        <div className="p-2 border-b">
                                                            <Input
                                                                placeholder="Search..."
                                                                value={uwSearch}
                                                                onChange={(e) => setUwSearch(e.target.value)}
                                                                className={cn(drmFieldClass, "h-8 text-sm")}
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
                                                                                className={`px-4 py-2 text-sm cursor-pointer transition-colors ${field.value === item.value
                                                                                    ? 'bg-emerald-600 text-white'
                                                                                    : 'hover:bg-accent'
                                                                                    }`}
                                                                                onClick={() => {
                                                                                    field.onChange(item.value);
                                                                                    setUwOpen(false);
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
                                                )}
                                            </div>
                                            <FormMessage />
                                        </FormItem>
                                    );
                                }}
                            />
                        </div>
                    </DrmSection>

                    <DrmSection title="Compensation" description="Salary and allowances (legacy payroll fields).">
                        {/* Row 5: Basic Salary, Daily Allowance, Mobile Allowance */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                            <FormField
                                control={form.control}
                                name="basicSalary"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Basic Salary*</FormLabel>
                                        <FormControl>
                                            <Input className={drmFieldClass} type="number" placeholder="0" {...field} data-testid="input-basic-salary" />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="dailyAllowance"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Daily Allowance*</FormLabel>
                                        <FormControl>
                                            <Input className={drmFieldClass} type="number" placeholder="0" {...field} data-testid="input-daily-allowance" />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="mobileAllowance"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Mobile Allowance</FormLabel>
                                        <FormControl>
                                            <Input className={drmFieldClass} type="number" placeholder="0" {...field} data-testid="input-mobile-allowance" />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        {/* Row 6: Admin Allowance, Conveyance Allowance, Relaxation Minutes */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                            <FormField
                                control={form.control}
                                name="adminAllowance"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Admin Allowance</FormLabel>
                                        <FormControl>
                                            <Input className={drmFieldClass} type="number" placeholder="0" {...field} data-testid="input-admin-allowance" />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="conveyanceAllowance"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Conveyance Allowance</FormLabel>
                                        <FormControl>
                                            <Input className={drmFieldClass} type="number" placeholder="0" {...field} data-testid="input-conveyance-allowance" />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="relaxationMinutes"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Relaxation Minutes</FormLabel>
                                        <FormControl>
                                            <Input className={drmFieldClass} type="number" placeholder="0" {...field} data-testid="input-relaxation-minutes" />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>
                    </DrmSection>

                    <DrmSection title="Additional" description="Photo, increment, gender, and address.">
                        {/* Row 7: Picture upload, Increment, Gender */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                            <FormItem>
                                <FormLabel>Picture upload</FormLabel>
                                <FormControl>
                                    <Input className={drmFieldClass} type="file" accept="image/*" data-testid="input-picture" />
                                </FormControl>
                                <FormMessage />
                            </FormItem>

                            <FormField
                                control={form.control}
                                name="increment"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Increment*</FormLabel>
                                        <Select onValueChange={field.onChange} value={field.value}>
                                            <FormControl>
                                                <SelectTrigger className={drmFieldClass} data-testid="select-increment">
                                                    <SelectValue placeholder="Select..." />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                {INCREMENT_OPTIONS.map((option) => (
                                                    <SelectItem key={option.value} value={option.value}>
                                                        {option.label}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="gender"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Gender*</FormLabel>
                                        <Select onValueChange={field.onChange} value={field.value}>
                                            <FormControl>
                                                <SelectTrigger className={drmFieldClass} data-testid="select-gender">
                                                    <SelectValue placeholder="Choose..." />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                {GENDER_OPTIONS.map((option) => (
                                                    <SelectItem key={option.value} value={option.value}>
                                                        {option.label}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        {/* Row 8: Address */}
                        <div className="mb-4">
                            <FormField
                                control={form.control}
                                name="address"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Address</FormLabel>
                                        <FormControl>
                                            <Textarea className={drmFieldClass} {...field} data-testid="textarea-address" />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>
                    </DrmSection>

                    <DrmFormActions>
                        <Button
                            type="button"
                            variant="secondary"
                            onClick={() => router.push(USERS_LIST)}
                            disabled={submitting}
                        >
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            variant="primary"
                            disabled={submitting}
                            data-testid="button-submit"
                        >
                            {submitting ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Adding user…
                                </>
                            ) : (
                                <>
                                    <Save className="mr-2 h-4 w-4" />
                                    Add user
                                </>
                            )}
                        </Button>
                    </DrmFormActions>
                </form>
            </Form>
        </div>
    );
}
