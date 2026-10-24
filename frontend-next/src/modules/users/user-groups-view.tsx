"use client";

import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/query/query-client";
import { useToast } from "@/lib/hooks/use-legacy-toast";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Field } from "@/components/ui/field";
import { DrmSection, drmFieldClass, drmPanelClass } from "@/modules/users/users-ui";
import { cn } from "@/lib/utils/cn";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/legacy/checkbox";
import { ScrollArea } from "@/components/ui/legacy/scroll-area";
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
    Users,
    Plus,
    MoreHorizontal,
    Edit,
    Trash2,
    UserPlus,
} from "lucide-react";

type UserGroup = {
    id: string;
    name: string;
    description?: string;
    memberCount: number;
    memberIds: string[];
    createdAt: string;
};

type User = {
    id: string;
    fullName: string;
    email: string;
    role: string;
};

export function UserGroupsPage() {
    const { toast } = useToast();
    const [createDialogOpen, setCreateDialogOpen] = useState(false);
    const [editDialogOpen, setEditDialogOpen] = useState(false);
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [selectedGroup, setSelectedGroup] = useState<UserGroup | null>(null);
    const [groupName, setGroupName] = useState("");
    const [groupDescription, setGroupDescription] = useState("");
    const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
    const [memberSearch, setMemberSearch] = useState("");

    // Fetch groups
    const { data: groups, isLoading } = useQuery<UserGroup[]>({
        queryKey: ["/api/users/groups"],
        queryFn: async () => {
            const res = await apiRequest("GET", "/api/users/groups");
            const json = await res.json();
            return json.data || json.groups || [];
        },
    });

    // Fetch users for selection
    const { data: usersData } = useQuery<{ users: User[] }>({
        queryKey: ["/api/users"],
        queryFn: async () => {
            const res = await apiRequest("GET", "/api/users");
            return res.json();
        },
    });

    const users = usersData?.users || [];

    const filteredUsers = useMemo(() => {
        if (!memberSearch) return users;
        const lower = memberSearch.toLowerCase();
        return users.filter(u =>
            (u.fullName || "").toLowerCase().includes(lower) ||
            (u.email || "").toLowerCase().includes(lower)
        );
    }, [users, memberSearch]);

    // Create mutation
    const createMutation = useMutation({
        mutationFn: async (data: { name: string; description?: string; members: string[] }) => {
            return apiRequest("POST", "/api/users/groups", data);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/users/groups"] });
            toast({ title: "Group created successfully" });
            setCreateDialogOpen(false);
            setGroupName("");
            setGroupDescription("");
            setSelectedMembers([]);
        },
        onError: () => {
            toast({ title: "Failed to create group", variant: "destructive" });
        },
    });

    // Update mutation
    const updateMutation = useMutation({
        mutationFn: async (data: { id: string; name: string; description?: string; members: string[] }) => {
            return apiRequest("PATCH", `/api/users/groups/${data.id}`, {
                name: data.name,
                description: data.description,
                members: data.members,
            });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/users/groups"] });
            toast({ title: "Group updated successfully" });
            setEditDialogOpen(false);
            setSelectedGroup(null);
            setGroupName("");
            setGroupDescription("");
            setSelectedMembers([]);
        },
        onError: () => {
            toast({ title: "Failed to update group", variant: "destructive" });
        },
    });

    // Delete mutation
    const deleteMutation = useMutation({
        mutationFn: async (groupId: string) => {
            return apiRequest("DELETE", `/api/users/groups/${groupId}`);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/users/groups"] });
            toast({ title: "Group deleted successfully" });
            setDeleteDialogOpen(false);
            setSelectedGroup(null);
        },
        onError: () => {
            toast({ title: "Failed to delete group", variant: "destructive" });
        },
    });

    const handleCreateClick = () => {
        setGroupName("");
        setGroupDescription("");
        setSelectedMembers([]);
        setMemberSearch("");
        setCreateDialogOpen(true);
    };

    const handleEditClick = (group: UserGroup) => {
        setSelectedGroup(group);
        setGroupName(group.name);
        setGroupDescription(group.description || "");
        setSelectedMembers(group.memberIds || []);
        setMemberSearch("");
        setEditDialogOpen(true);
    };

    const handleDeleteClick = (group: UserGroup) => {
        setSelectedGroup(group);
        setDeleteDialogOpen(true);
    };

    const handleCreateSubmit = () => {
        if (!groupName.trim()) {
            toast({ title: "Group name is required", variant: "destructive" });
            return;
        }
        createMutation.mutate({
            name: groupName.trim(),
            description: groupDescription.trim() || undefined,
            members: selectedMembers,
        });
    };

    const handleUpdateSubmit = () => {
        if (!selectedGroup || !groupName.trim()) {
            toast({ title: "Group name is required", variant: "destructive" });
            return;
        }
        updateMutation.mutate({
            id: selectedGroup.id,
            name: groupName.trim(),
            description: groupDescription.trim() || undefined,
            members: selectedMembers,
        });
    };

    const handleDeleteConfirm = () => {
        if (selectedGroup) {
            deleteMutation.mutate(selectedGroup.id);
        }
    };

    const toggleMember = (userId: string) => {
        setSelectedMembers(prev =>
            prev.includes(userId)
                ? prev.filter(id => id !== userId)
                : [...prev, userId]
        );
    };

    const MemberSelectionList = () => (
        <div className={cn(drmPanelClass, "overflow-hidden")}>
            <div className="border-b border-zinc-200 p-2 dark:border-zinc-800">
                <Input
                    placeholder="Search users…"
                    className={cn(drmFieldClass, "h-9")}
                    value={memberSearch}
                    onChange={(e) => setMemberSearch(e.target.value)}
                />
            </div>
            <ScrollArea className="h-[200px] p-2">
                <div className="space-y-1">
                    {filteredUsers.length === 0 ? (
                        <p className="py-4 text-center text-sm text-zinc-500 dark:text-zinc-400">No users found</p>
                    ) : (
                        filteredUsers.map(user => (
                            <div key={user.id} className="flex items-center space-x-2 rounded-md p-1.5 hover:bg-zinc-50 dark:hover:bg-zinc-800/60">
                                <Checkbox
                                    id={`member-${user.id}`}
                                    checked={selectedMembers.includes(user.id)}
                                    onCheckedChange={() => toggleMember(user.id)}
                                />
                                <label
                                    htmlFor={`member-${user.id}`}
                                    className="text-sm flex-1 cursor-pointer flex justify-between"
                                >
                                    <span>{user.fullName}</span>
                                    <span className="text-xs text-zinc-500 dark:text-zinc-400">{user.role}</span>
                                </label>
                            </div>
                        ))
                    )}
                </div>
            </ScrollArea>
            <div className="border-t border-zinc-200 bg-zinc-50 p-2 text-center text-xs text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/80 dark:text-zinc-400">
                {selectedMembers.length} member{selectedMembers.length === 1 ? "" : "s"} selected
            </div>
        </div>
    );

    const groupList = groups || [];

    return (
        <div className="space-y-4">
            <PageHeader
                eyebrow="Users"
                title="User groups"
                description={`Create groups and assign members (${groupList.length} groups).`}
                actions={
                    <Button type="button" variant="primary" size="sm" onClick={handleCreateClick} data-testid="button-create-group">
                        <Plus className="mr-2 h-4 w-4" />
                        Create group
                    </Button>
                }
            />

            <DrmSection title="Groups" description="Organize employees into teams for assignments and reporting.">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {isLoading ? (
                        <div className="col-span-full py-12 text-center">
                            <Users className="mx-auto mb-3 h-10 w-10 animate-pulse text-zinc-400" />
                            <p className="text-sm text-zinc-500 dark:text-zinc-400">Loading groups…</p>
                        </div>
                    ) : groupList.length === 0 ? (
                        <div className="col-span-full py-12 text-center">
                            <Users className="mx-auto mb-3 h-10 w-10 text-zinc-400" />
                            <p className="mb-4 text-sm text-zinc-500 dark:text-zinc-400">No groups yet</p>
                            <Button type="button" onClick={handleCreateClick} variant="primary" size="sm">
                                <Plus className="mr-2 h-4 w-4" />
                                Create first group
                            </Button>
                        </div>
                    ) : (
                        groupList.map((group) => (
                            <Card
                                key={group.id}
                                className="!p-0 transition-colors hover:border-emerald-500/35 dark:hover:border-emerald-500/25"
                            >
                                <div className="flex items-start justify-between gap-2 border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
                                    <div className="min-w-0 flex-1">
                                        <h3 className="flex items-center gap-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                                            <Users className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                                            <span className="truncate">{group.name}</span>
                                        </h3>
                                        <p className="mt-1 line-clamp-2 text-xs text-zinc-500 dark:text-zinc-400">
                                            {group.description || "No description"}
                                        </p>
                                    </div>
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="sm"
                                                className="h-8 w-8 shrink-0 p-0"
                                                data-testid={`button-actions-${group.id}`}
                                                aria-label="Group actions"
                                            >
                                                <MoreHorizontal className="h-4 w-4" />
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end">
                                            <DropdownMenuItem onClick={() => handleEditClick(group)}>
                                                <Edit className="mr-2 h-4 w-4" />
                                                Edit
                                            </DropdownMenuItem>
                                            <DropdownMenuItem onClick={() => handleEditClick(group)}>
                                                <UserPlus className="mr-2 h-4 w-4" />
                                                Manage members
                                            </DropdownMenuItem>
                                            <DropdownMenuSeparator />
                                            <DropdownMenuItem
                                                onClick={() => handleDeleteClick(group)}
                                                className="text-red-600 focus:text-red-600 dark:text-red-400"
                                            >
                                                <Trash2 className="mr-2 h-4 w-4" />
                                                Delete
                                            </DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </div>
                                <div className="flex items-center justify-between px-4 py-3">
                                    <Badge variant="brand" className="normal-case tracking-normal">
                                        <Users className="mr-1 h-3 w-3" />
                                        {group.memberCount || 0} members
                                    </Badge>
                                    <span className="text-xs text-zinc-500 dark:text-zinc-400">
                                        Created {new Date(group.createdAt).toLocaleDateString()}
                                    </span>
                                </div>
                            </Card>
                        ))
                    )}
                </div>
            </DrmSection>

            {/* Create Group Dialog */}
            <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
                <DialogContent className="max-w-lg">
                    <DialogHeader>
                        <DialogTitle>Create New Group</DialogTitle>
                        <DialogDescription>
                            Create a new user group to organize your team members.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <Field id="create-group-name" label="Group name *">
                            <Input
                                id="create-group-name"
                                className={drmFieldClass}
                                placeholder="e.g. Sales team"
                                value={groupName}
                                onChange={(e) => setGroupName(e.target.value)}
                                data-testid="input-group-name"
                            />
                        </Field>
                        <Field id="create-group-desc" label="Description">
                            <Textarea
                                id="create-group-desc"
                                className={drmFieldClass}
                                placeholder="Brief description…"
                                value={groupDescription}
                                onChange={(e) => setGroupDescription(e.target.value)}
                                rows={3}
                                data-testid="input-group-description"
                            />
                        </Field>
                        <Field id="create-group-members" label="Members">
                            <MemberSelectionList />
                        </Field>
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="secondary" onClick={() => setCreateDialogOpen(false)}>
                            Cancel
                        </Button>
                        <Button
                            type="button"
                            variant="primary"
                            onClick={handleCreateSubmit}
                            disabled={createMutation.isPending}
                        >
                            {createMutation.isPending ? "Creating…" : "Create group"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Edit Group Dialog */}
            <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
                <DialogContent className="max-w-lg">
                    <DialogHeader>
                        <DialogTitle>Edit Group</DialogTitle>
                        <DialogDescription>
                            Update the group name, description and members.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <Field id="edit-group-name" label="Group name *">
                            <Input
                                id="edit-group-name"
                                className={drmFieldClass}
                                placeholder="e.g. Sales team"
                                value={groupName}
                                onChange={(e) => setGroupName(e.target.value)}
                                data-testid="input-edit-group-name"
                            />
                        </Field>
                        <Field id="edit-group-desc" label="Description">
                            <Textarea
                                id="edit-group-desc"
                                className={drmFieldClass}
                                placeholder="Brief description…"
                                value={groupDescription}
                                onChange={(e) => setGroupDescription(e.target.value)}
                                rows={3}
                                data-testid="input-edit-group-description"
                            />
                        </Field>
                        <Field id="edit-group-members" label="Members">
                            <MemberSelectionList />
                        </Field>
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="secondary" onClick={() => setEditDialogOpen(false)}>
                            Cancel
                        </Button>
                        <Button
                            type="button"
                            variant="primary"
                            onClick={handleUpdateSubmit}
                            disabled={updateMutation.isPending}
                        >
                            {updateMutation.isPending ? "Updating…" : "Save changes"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete Confirmation Dialog */}
            <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Delete Group</DialogTitle>
                        <DialogDescription>
                            Are you sure you want to delete this group? This action cannot be undone.
                        </DialogDescription>
                    </DialogHeader>
                    {selectedGroup && (
                        <div className="py-4">
                            <div className="p-3 bg-muted rounded-md">
                                <p className="font-medium">{selectedGroup.name}</p>
                                <p className="text-sm text-muted-foreground mt-1">
                                    {selectedGroup.memberCount || 0} members will be unassigned
                                </p>
                            </div>
                        </div>
                    )}
                    <DialogFooter>
                        <Button variant="secondary" onClick={() => setDeleteDialogOpen(false)}>
                            Cancel
                        </Button>
                        <Button
                            variant="danger"
                            onClick={handleDeleteConfirm}
                            disabled={deleteMutation.isPending}
                        >
                            {deleteMutation.isPending ? "Deleting..." : "Delete"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
