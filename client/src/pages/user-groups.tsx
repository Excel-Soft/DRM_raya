import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
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

export default function UserGroups() {
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
        <div className="border rounded-md">
            <div className="p-2 border-b">
                <Input
                    placeholder="Search users..."
                    className="h-8"
                    value={memberSearch}
                    onChange={(e) => setMemberSearch(e.target.value)}
                />
            </div>
            <ScrollArea className="h-[200px] p-2">
                <div className="space-y-2">
                    {filteredUsers.length === 0 ? (
                        <p className="text-sm text-center text-muted-foreground py-4">No users found</p>
                    ) : (
                        filteredUsers.map(user => (
                            <div key={user.id} className="flex items-center space-x-2 p-1 hover:bg-muted/50 rounded-sm">
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
                                    <span className="text-xs text-muted-foreground">{user.role}</span>
                                </label>
                            </div>
                        ))
                    )}
                </div>
            </ScrollArea>
            <div className="p-2 border-t bg-muted/20 text-xs text-muted-foreground text-center">
                {selectedMembers.length} members selected
            </div>
        </div>
    );

    const groupList = groups || [];

    return (
        <div className="p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-semibold" data-testid="text-page-title">
                        User Groups
                    </h1>
                    <p className="text-muted-foreground mt-1">
                        Manage user groups and team assignments ({groupList.length} groups)
                    </p>
                </div>
                <Button onClick={handleCreateClick} data-testid="button-create-group">
                    <Plus className="w-4 h-4 mr-2" />
                    Create Group
                </Button>
            </div>

            {/* Groups Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {isLoading ? (
                    <Card className="col-span-full">
                        <CardContent className="py-12 text-center">
                            <Users className="h-12 w-12 mx-auto text-muted-foreground mb-3 animate-pulse" />
                            <p className="text-muted-foreground">Loading groups...</p>
                        </CardContent>
                    </Card>
                ) : groupList.length === 0 ? (
                    <Card className="col-span-full">
                        <CardContent className="py-12 text-center">
                            <Users className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                            <p className="text-muted-foreground mb-4">No groups found</p>
                            <Button onClick={handleCreateClick} variant="outline">
                                <Plus className="w-4 h-4 mr-2" />
                                Create Your First Group
                            </Button>
                        </CardContent>
                    </Card>
                ) : (
                    groupList.map((group) => (
                        <Card key={group.id} className="hover:shadow-md transition-shadow">
                            <CardHeader>
                                <div className="flex items-start justify-between">
                                    <div className="flex-1">
                                        <CardTitle className="text-lg flex items-center gap-2">
                                            <Users className="h-5 w-5 text-primary" />
                                            {group.name}
                                        </CardTitle>
                                        <CardDescription className="mt-2">
                                            {group.description || "No description"}
                                        </CardDescription>
                                    </div>
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8"
                                                data-testid={`button-actions-${group.id}`}
                                            >
                                                <MoreHorizontal className="h-4 w-4" />
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end">
                                            <DropdownMenuItem onClick={() => handleEditClick(group)}>
                                                <Edit className="h-4 w-4 mr-2" />
                                                Edit
                                            </DropdownMenuItem>
                                            <DropdownMenuItem onClick={() => handleEditClick(group)}>
                                                <UserPlus className="h-4 w-4 mr-2" />
                                                Manage Members
                                            </DropdownMenuItem>
                                            <DropdownMenuSeparator />
                                            <DropdownMenuItem
                                                onClick={() => handleDeleteClick(group)}
                                                className="text-destructive"
                                            >
                                                <Trash2 className="h-4 w-4 mr-2" />
                                                Delete
                                            </DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <div className="flex items-center justify-between">
                                    <Badge variant="secondary" className="flex items-center gap-1">
                                        <Users className="h-3 w-3" />
                                        {group.memberCount || 0} members
                                    </Badge>
                                    <span className="text-xs text-muted-foreground">
                                        Created {new Date(group.createdAt).toLocaleDateString()}
                                    </span>
                                </div>
                            </CardContent>
                        </Card>
                    ))
                )}
            </div>

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
                        <div>
                            <label className="text-sm font-medium mb-2 block">Group Name *</label>
                            <Input
                                placeholder="e.g., Sales Team, Developers"
                                value={groupName}
                                onChange={(e) => setGroupName(e.target.value)}
                                data-testid="input-group-name"
                            />
                        </div>
                        <div>
                            <label className="text-sm font-medium mb-2 block">Description</label>
                            <Textarea
                                placeholder="Brief description of the group..."
                                value={groupDescription}
                                onChange={(e) => setGroupDescription(e.target.value)}
                                rows={3}
                                data-testid="input-group-description"
                            />
                        </div>
                        <div>
                            <label className="text-sm font-medium mb-2 block">Members</label>
                            <MemberSelectionList />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
                            Cancel
                        </Button>
                        <Button
                            onClick={handleCreateSubmit}
                            disabled={createMutation.isPending}
                        >
                            {createMutation.isPending ? "Creating..." : "Create Group"}
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
                        <div>
                            <label className="text-sm font-medium mb-2 block">Group Name *</label>
                            <Input
                                placeholder="e.g., Sales Team, Developers"
                                value={groupName}
                                onChange={(e) => setGroupName(e.target.value)}
                                data-testid="input-edit-group-name"
                            />
                        </div>
                        <div>
                            <label className="text-sm font-medium mb-2 block">Description</label>
                            <Textarea
                                placeholder="Brief description of the group..."
                                value={groupDescription}
                                onChange={(e) => setGroupDescription(e.target.value)}
                                rows={3}
                                data-testid="input-edit-group-description"
                            />
                        </div>
                        <div>
                            <label className="text-sm font-medium mb-2 block">Members</label>
                            <MemberSelectionList />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
                            Cancel
                        </Button>
                        <Button
                            onClick={handleUpdateSubmit}
                            disabled={updateMutation.isPending}
                        >
                            {updateMutation.isPending ? "Updating..." : "Update Group"}
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
                        <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
                            Cancel
                        </Button>
                        <Button
                            variant="destructive"
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
