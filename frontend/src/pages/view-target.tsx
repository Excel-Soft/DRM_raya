import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Trash2, Check, ChevronDown } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { groupUsersByRoleTitle } from "@/lib/user-role-groups";
import { useToast } from "@/hooks/use-toast";

export default function ViewTarget() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedUser, setSelectedUser] = useState<string>("");
  const [showAllQuarters, setShowAllQuarters] = useState(false);
  const [userPickerOpen, setUserPickerOpen] = useState(false);

  // Base key is a separate array element (not baked into one query-string'd
  // URL) specifically so invalidateQueries({queryKey: ["/api/target-system/user-targets"]})
  // elsewhere (set-target.tsx's mutations) actually matches this query via
  // React Query's prefix matching — it didn't before, so saves on the Set
  // page never refreshed this page's cache even though they'd persisted
  // correctly (confirmed live: data was in the database, this page's cached
  // empty result just never got invalidated).
  const { data: allTargets = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/target-system/user-targets", { current: !showAllQuarters }],
    queryFn: async () => {
      const qs = showAllQuarters ? "" : "?current=true";
      const res = await apiRequest("GET", `/api/target-system/user-targets${qs}`);
      if (!res.ok) return [];
      return res.json();
    },
  });

  const { data: usersRes } = useQuery<any>({
    queryKey: ["/api/users"],
  });
  
  const usersList = usersRes?.data || usersRes?.users || usersRes || [];
  
  // One section per role title; multi-role users under each role; disabled (role 54) excluded.
  const groupedUsers = groupUsersByRoleTitle(usersList);

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/target-system/user-targets/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/target-system/user-targets"] });
      toast({ title: "Target removed successfully!" });
    },
    onError: () => {
      toast({ title: "Failed to delete target.", variant: "destructive" });
    }
  });

  const handleDelete = (id: number) => {
    deleteMutation.mutate(id);
  };

  // "All History": also show the user's older old-DRM assignments (read-only,
  // straight from legacy_archive — only current ones were copied over).
  const { data: legacyHistory = [], isLoading: isLoadingLegacy } = useQuery<any[]>({
    queryKey: ["/api/target-system/user-targets", "legacy-history", selectedUser],
    enabled: showAllQuarters && !!selectedUser,
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/target-system/user-targets/legacy-history?userId=${encodeURIComponent(selectedUser)}`);
      if (!res.ok) return [];
      return res.json();
    },
  });

  // Team Target: one section per direct report of the selected user (legacy
  // target-view "Team Terget"), so a manager's view also shows their team.
  const { data: teamSections = [], isLoading: isLoadingTeam } = useQuery<any[]>({
    queryKey: ["/api/target-system/user-targets", "team", selectedUser, { all: showAllQuarters }],
    enabled: !!selectedUser,
    queryFn: async () => {
      const res = await apiRequest(
        "GET",
        `/api/target-system/user-targets/team?userId=${encodeURIComponent(selectedUser)}${showAllQuarters ? "&all=true" : ""}`,
      );
      if (!res.ok) return [];
      return res.json();
    },
  });
  const fmtDate = (v: any) => (v ? new Date(v).toLocaleDateString() : "");
  const fmtDateTime = (v: any) =>
    v
      ? new Date(v)
          .toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: true })
          .replace(/,/g, "")
      : "";

  const displayedTargets = [
    ...allTargets.filter(t => t.userId === selectedUser),
    ...(showAllQuarters ? legacyHistory : []),
  ];
  const selectedUserLabel = usersList.find((u: any) => u.id === selectedUser)?.fullName
    || usersList.find((u: any) => u.id === selectedUser)?.username
    || selectedUser;


  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between font-bold text-lg uppercase flex-wrap gap-2">
        <span className="text-[#2b3553] dark:text-zinc-100">TARGET SYSTEM</span>
        <div className="flex items-center text-xs font-normal normal-case rounded-sm border overflow-hidden">
          <button
            type="button"
            className={`px-3 py-1.5 ${!showAllQuarters ? "bg-[#00a65a] text-white" : "bg-white dark:bg-zinc-900 text-gray-600 dark:text-zinc-400"}`}
            onClick={() => setShowAllQuarters(false)}
          >
            Current Quarter
          </button>
          <button
            type="button"
            className={`px-3 py-1.5 ${showAllQuarters ? "bg-[#00a65a] text-white" : "bg-white dark:bg-zinc-900 text-gray-600 dark:text-zinc-400"}`}
            onClick={() => setShowAllQuarters(true)}
          >
            All History
          </button>
        </div>
      </div>

      <div className="bg-white p-4 rounded-sm shadow-sm border mb-6 dark:bg-zinc-900">
        <label className="block text-sm mb-2 text-gray-700 dark:text-zinc-400">View Targets</label>
        {/* Searchable user picker (the old Select had a dummy search box that
            filtered nothing — Radix Select swallows typing). */}
        <Popover open={userPickerOpen} onOpenChange={setUserPickerOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              aria-expanded={userPickerOpen}
              className="w-full justify-between font-normal"
            >
              <span className={`truncate ${selectedUser ? "" : "text-muted-foreground"}`}>
                {selectedUser ? selectedUserLabel : "Choose..."}
              </span>
              <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
            <Command>
              <CommandInput placeholder="Search user..." />
              <CommandList className="max-h-80">
                <CommandEmpty>No user found.</CommandEmpty>
                {groupedUsers.map(({ roleId, role, users: usersInRole }) => (
                  <CommandGroup
                    key={`${roleId}-${role}`}
                    heading={<span className="font-bold text-[#00a65a] dark:text-zinc-400">{role}</span>}
                  >
                    {usersInRole.map((user: any) => (
                      <CommandItem
                        key={user.id}
                        // cmdk filters on this value: name + email + id (+ role, since a
                        // multi-role user appears once per role section) keeps it unique.
                        value={`${user.fullName || user.username || ""} ${user.email || ""} ${user.id} ${roleId}`}
                        onSelect={() => {
                          setSelectedUser(user.id);
                          setUserPickerOpen(false);
                        }}
                      >
                        <Check className={`mr-2 h-4 w-4 ${selectedUser === user.id ? "opacity-100" : "opacity-0"}`} />
                        {user.fullName || user.username}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                ))}
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </div>

      {selectedUser && (
        <Card className="border rounded-sm shadow-sm">
          <CardContent className="p-0">
            <div className="p-4 border-b">
              <h3 className="font-semibold text-gray-700 dark:text-zinc-400">Target Details</h3>
            </div>
            
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-[#dcfce7] dark:bg-zinc-900">
                  <TableRow className="hover:bg-[#dcfce7] dark:hover:bg-zinc-800">
                    <TableHead className="font-bold text-black dark:text-zinc-300">Target Name</TableHead>
                    <TableHead className="font-bold text-black dark:text-zinc-300 text-center">Category</TableHead>
                    <TableHead className="font-bold text-black dark:text-zinc-300 text-center">Target</TableHead>
                    <TableHead className="font-bold text-black dark:text-zinc-300 text-center">Price</TableHead>
                    <TableHead className="font-bold text-black dark:text-zinc-300 text-center">Bonns</TableHead>
                    <TableHead className="font-bold text-black dark:text-zinc-300 text-center">Vas</TableHead>
                    <TableHead className="font-bold text-black dark:text-zinc-300 text-center">Kwa</TableHead>
                    <TableHead className="font-bold text-black dark:text-zinc-300 text-center">Reward</TableHead>
                    <TableHead className="font-bold text-black dark:text-zinc-300 text-center">Total</TableHead>
                    <TableHead className="font-bold text-black dark:text-zinc-300 text-center">Start Date</TableHead>
                    <TableHead className="font-bold text-black dark:text-zinc-300 text-center">End Date</TableHead>
                    <TableHead className="font-bold text-black dark:text-zinc-300 text-center">Sign Date</TableHead>
                    <TableHead className="font-bold text-black dark:text-zinc-300 text-center">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading || (showAllQuarters && isLoadingLegacy) ? (
                    <TableRow>
                      <TableCell colSpan={13} className="text-center py-8 text-gray-500 dark:text-zinc-400">
                        Loading live data...
                      </TableCell>
                    </TableRow>
                  ) : displayedTargets.length > 0 ? (
                    displayedTargets.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell className="font-medium text-sm">{row.targetName}</TableCell>
                        <TableCell className="text-center text-sm">{row.category}</TableCell>
                        <TableCell className="text-center text-sm">{row.target}</TableCell>
                        <TableCell className="text-center text-sm">{row.price}</TableCell>
                        {/* func.php's own view handler (user_id_terget_view) shows the
                            conversion value here, not the bonus-type label. */}
                        <TableCell className="text-center text-sm">{row.conversion}</TableCell>
                        <TableCell className="text-center text-sm">{row.vas}</TableCell>
                        <TableCell className="text-center text-sm">{row.kwa}</TableCell>
                        <TableCell className="text-center text-sm">{row.reward}</TableCell>
                        <TableCell className="text-center text-sm">{row.total}</TableCell>
                        <TableCell className="text-center text-sm">{row.startDate ? new Date(row.startDate).toLocaleDateString() : ""}</TableCell>
                        <TableCell className="text-center text-sm">{row.endDate ? new Date(row.endDate).toLocaleDateString() : ""}</TableCell>
                        <TableCell className="text-center text-xs">{row.signDate ? new Date(row.signDate).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true }).replace(/,/g, '') : ""}</TableCell>
                        <TableCell className="text-center">
                          {row.isLegacy ? (
                            <span className="text-[11px] text-gray-400">Old DRM</span>
                          ) : (
                            <Trash2
                              className={`w-4 h-4 text-red-500 cursor-pointer mx-auto ${deleteMutation.isPending ? 'opacity-50' : ''}`}
                              onClick={() => !deleteMutation.isPending && handleDelete(row.id)}
                            />
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={13} className="text-center py-8 text-gray-500 dark:text-zinc-400">
                        No targets assigned to {selectedUserLabel}.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {selectedUser && isLoadingTeam && (
        <div className="mt-6 text-sm text-gray-500 dark:text-zinc-400">Loading team targets...</div>
      )}
      {selectedUser && teamSections.map((section: any) => (
        <Card key={section.userId} className="border rounded-sm shadow-sm mt-6">
          <CardContent className="p-0">
            <div className="p-4 border-b">
              <h3 className="font-semibold text-gray-700 dark:text-zinc-400">Team Target</h3>
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-red-50 dark:bg-zinc-900">
                  <TableRow className="hover:bg-red-50 dark:hover:bg-zinc-800">
                    <TableHead className="font-bold text-black dark:text-zinc-300">User Name</TableHead>
                    <TableHead className="font-bold text-black dark:text-zinc-300">Target Name</TableHead>
                    <TableHead className="font-bold text-black dark:text-zinc-300 text-center">Category</TableHead>
                    <TableHead className="font-bold text-black dark:text-zinc-300 text-center">Target</TableHead>
                    <TableHead className="font-bold text-black dark:text-zinc-300 text-center">Price</TableHead>
                    <TableHead className="font-bold text-black dark:text-zinc-300 text-center">Bonus</TableHead>
                    <TableHead className="font-bold text-black dark:text-zinc-300 text-center">Start Date</TableHead>
                    <TableHead className="font-bold text-black dark:text-zinc-300 text-center">End Date</TableHead>
                    <TableHead className="font-bold text-black dark:text-zinc-300 text-center">Sign Date</TableHead>
                    <TableHead className="font-bold text-black dark:text-zinc-300 text-center">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {section.targets.map((row: any) => (
                    <TableRow key={row.id}>
                      <TableCell className="font-medium text-sm">{section.userName}</TableCell>
                      <TableCell className="text-sm">{row.targetName}</TableCell>
                      <TableCell className="text-center text-sm">{row.category}</TableCell>
                      <TableCell className="text-center text-sm">{row.target}</TableCell>
                      <TableCell className="text-center text-sm">{Number(row.price) || 0}</TableCell>
                      <TableCell className="text-center text-sm">{Number(row.conversion) || 0}</TableCell>
                      <TableCell className="text-center text-sm">{fmtDate(row.startDate)}</TableCell>
                      <TableCell className="text-center text-sm">{fmtDate(row.endDate)}</TableCell>
                      <TableCell className="text-center text-xs">{fmtDateTime(row.signDate)}</TableCell>
                      <TableCell className="text-center">
                        {row.isLegacy ? (
                          <span className="text-[11px] text-gray-400">Old DRM</span>
                        ) : (
                          <Trash2
                            className={`w-4 h-4 text-red-500 cursor-pointer mx-auto ${deleteMutation.isPending ? "opacity-50" : ""}`}
                            onClick={() => !deleteMutation.isPending && handleDelete(row.id)}
                          />
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
