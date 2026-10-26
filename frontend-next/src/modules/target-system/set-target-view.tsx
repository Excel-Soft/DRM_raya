"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/legacy/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/legacy/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/legacy/dialog";
import { Pencil, Trash2, Loader2 } from "lucide-react";
import { Checkbox } from "@/components/ui/legacy/checkbox";

import { useToast } from "@/lib/hooks/use-legacy-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest, extractApiError } from "@/lib/query/query-client";
import {
  DrmInlineActions,
  DrmSection,
  TargetSystemShell,
  tsDialogShellClass,
} from "@/modules/target-system/target-system-ui";

export function SetTargetPage() {
  const [activeTab, setActiveTab] = useState<"user" | "role" | "same">("user");
  const [showUserForm, setShowUserForm] = useState(true);
  const [showRoleForm, setShowRoleForm] = useState(true);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const { data: userTargets = [], isLoading: isLoadingUserTargets } = useQuery<any[]>({
    queryKey: ["/api/target-system/user-targets"],
  });

  const { data: targetsData = [] } = useQuery<any[]>({
    queryKey: ["/api/target-system/targets"],
  });

  const { data: usersResp } = useQuery<any>({
    queryKey: ["/api/users"],
  });
  const usersData = usersResp?.users || [];

  const [roleType, setRoleType] = useState("none");
  const [roleTargets, setRoleTargets] = useState<any[]>([]);
  
  const [selectedUser, setSelectedUser] = useState("none");
  const [userFormTargets, setUserFormTargets] = useState<any[]>([]);

  useEffect(() => {
    if (targetsData.length > 0) {
      const initTargets = targetsData.map(d => ({
        ...d,
        name: d.targetName,
        number: 0,
        category: "none",
        startDate: "",
        endDate: "",
        selected: false
      }));
      setRoleTargets(initTargets);
      setUserFormTargets(initTargets);
    }
  }, [targetsData]);

  const handleUserFormTargetChange = (index: number, field: string, value: any) => {
    const newTargets = [...userFormTargets];
    newTargets[index] = { ...newTargets[index], [field]: value };
    setUserFormTargets(newTargets);
  };

  const handleRoleTargetChange = (index: number, field: string, value: any) => {
    const newTargets = [...roleTargets];
    newTargets[index] = { ...newTargets[index], [field]: value };
    setRoleTargets(newTargets);
  };

  const assignRoleMutation = useMutation({
    mutationFn: async (data: { role: string, targets: any[] }) => {
      const res = await apiRequest("POST", "/api/target-system/assign-role", data);
      const body = await res.json().catch(() => ({}));
      // apiRequest never throws on a non-2xx response (by design — callers
      // must check res.ok themselves). Without this check, a 400/403/500 JSON
      // error body still resolves "successfully" here, and useMutation calls
      // onSuccess with it — which is exactly how this silently failed before
      // (toast said "success" while nothing was actually saved).
      if (!res.ok) throw new Error(extractApiError(body, res.status));
      return body;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/target-system/user-targets"] });
      toast({ title: data.message || "Targets successfully assigned to role!" });
      setActiveTab("user");
    },
    onError: (error: any) => {
      toast({ title: error.message || "Failed to assign targets.", variant: "destructive" });
    }
  });

  const assignUserMutation = useMutation({
    mutationFn: async (data: { targets: any[] }) => {
      const res = await apiRequest("POST", "/api/target-system/user-targets/bulk", data);
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(extractApiError(body, res.status));
      return body;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/target-system/user-targets"] });
      toast({ title: data.message || "Targets successfully assigned to user!" });
      // Keep them on 'user' tab, maybe reset selected
      setSelectedUser("none");
      setUserFormTargets(targetsData.map(d => ({
        ...d,
        name: d.targetName,
        number: 0,
        category: "none",
        startDate: "",
        endDate: "",
        selected: false
      })));
    },
    onError: (error: any) => {
      toast({ title: error.message || "Failed to assign targets.", variant: "destructive" });
    }
  });

  const handleSetUserTarget = () => {
    const selectedTargets = userFormTargets.filter(t => t.selected);
    if (selectedUser === "none") {
      toast({ title: "Please select a User", variant: "destructive" });
      return;
    }
    if (selectedTargets.length === 0) {
      toast({ title: "Please select at least one target", variant: "destructive" });
      return;
    }
    
    const missingDates = selectedTargets.some(t => !t.startDate || !t.endDate);
    if (missingDates) {
      toast({ title: "Please provide Start and End Dates for all selected targets.", variant: "destructive" });
      return;
    }

    // Only the fields the backend's strict schema accepts — t is spread from
    // the full target definition row (id, package, maxPrice, penalty, amount,
    // createdAt, selected, ...), and userTargetItemSchema.strict() rejects
    // any request carrying those extra fields with a 400. That 400 was being
    // silently swallowed by the mutation (see assignUserMutation above),
    // which is why this looked like it "succeeded" while saving nothing.
    const payloadTargets = selectedTargets.map(t => ({
      userId: selectedUser,
      targetName: t.name,
      category: t.category,
      target: t.number,
      price: t.price,
      maxPrice: t.maxPrice,
      bonus: t.bonus,
      vas: t.vas,
      kwa: t.kwa,
      reward: t.reward,
      conversion: t.conversion,
      startDate: t.startDate,
      endDate: t.endDate,
    }));

    assignUserMutation.mutate({ targets: payloadTargets });
  };

  const handleSetRoleTarget = () => {
    const selectedTargets = roleTargets.filter(t => t.selected);
    if (roleType === "none") {
      toast({ title: "Please select a Role Type", variant: "destructive" });
      return;
    }
    if (selectedTargets.length === 0) {
      toast({ title: "Please select at least one target", variant: "destructive" });
      return;
    }
    
    // Check if dates are selected for all selected targets
    const missingDates = selectedTargets.some(t => !t.startDate || !t.endDate);
    if (missingDates) {
      toast({ title: "Please provide Start and End Dates for all selected targets.", variant: "destructive" });
      return;
    }

    // Same fix as handleSetUserTarget — only the fields targetItemSchema.strict()
    // actually accepts, not the raw row (which carries id/package/maxPrice/
    // penalty/amount/createdAt/selected and gets rejected with a 400).
    const payloadTargets = selectedTargets.map(t => ({
      targetName: t.name,
      category: t.category,
      number: t.number,
      price: t.price,
      maxPrice: t.maxPrice,
      bonus: t.bonus,
      vas: t.vas,
      kwa: t.kwa,
      reward: t.reward,
      conversion: t.conversion,
      startDate: t.startDate,
      endDate: t.endDate,
    }));

    assignRoleMutation.mutate({ role: roleType, targets: payloadTargets });
  };


  const deleteUserTargetMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("DELETE", `/api/target-system/user-targets/${id}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(extractApiError(body, res.status));
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/target-system/user-targets"] });
      toast({ title: "Target deleted successfully!" });
    },
    onError: (error: any) => {
      toast({ title: error.message || "Failed to delete target.", variant: "destructive" });
    }
  });

  const handleDeleteUserTarget = (id: number) => {
    deleteUserTargetMutation.mutate(id);
  };

  const toDateInputValue = (value: any) => (value ? new Date(value).toISOString().slice(0, 10) : "");

  const [editTarget, setEditTarget] = useState<any | null>(null);
  const [editForm, setEditForm] = useState({
    target: "",
    price: "",
    maxPrice: "",
    bonus: "",
    vas: "",
    kwa: "",
    reward: "",
    conversion: "",
    total: "",
    startDate: "",
    endDate: "",
  });

  const updateUserTargetMutation = useMutation({
    mutationFn: async (vars: { id: number; data: Record<string, any> }) => {
      const res = await apiRequest("PATCH", `/api/target-system/user-targets/${vars.id}`, vars.data);
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(extractApiError(body, res.status));
      return body;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/target-system/user-targets"] });
      toast({ title: "Target updated successfully!" });
      setEditTarget(null);
    },
    onError: (error: any) => {
      toast({ title: error.message || "Failed to update target.", variant: "destructive" });
    }
  });

  const handleEditUserTarget = (row: any) => {
    setEditTarget(row);
    setEditForm({
      target: String(row.target ?? ""),
      price: String(row.price ?? ""),
      maxPrice: String(row.maxPrice ?? ""),
      bonus: row.bonus ?? "",
      vas: String(row.vas ?? ""),
      kwa: String(row.kwa ?? ""),
      reward: String(row.reward ?? ""),
      conversion: String(row.conversion ?? ""),
      total: String(row.total ?? ""),
      startDate: toDateInputValue(row.startDate),
      endDate: toDateInputValue(row.endDate),
    });
  };

  const handleSaveEditUserTarget = () => {
    if (!editTarget) return;
    updateUserTargetMutation.mutate({ id: editTarget.id, data: editForm });
  };

  // Assign Same Target logic
  const [sameTargetStartDate, setSameTargetStartDate] = useState("2026-04-01");
  const [sameTargetEndDate, setSameTargetEndDate] = useState("2026-06-30");

  const assignSameTargetMutation = useMutation({
    mutationFn: async (data: { targetIds: number[], startDate: string, endDate: string }) => {
      const res = await apiRequest("PUT", "/api/target-system/user-targets/bulk-dates", data);
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(extractApiError(body, res.status));
      return body;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/target-system/user-targets"] });
      toast({ title: "Targets successfully updated with the new timeframe!" });
    },
    onError: (error: any) => {
      toast({ title: error.message || "Failed to update targets.", variant: "destructive" });
    }
  });

  const handleAssignSameTarget = () => {
    if (!sameTargetStartDate || !sameTargetEndDate) {
      toast({ title: "Please select both Start Date and End Date.", variant: "destructive" });
      return;
    }

    if (userTargets.length === 0) {
      toast({ title: "No targets to update.", variant: "destructive" });
      return;
    }

    const targetIds = userTargets.map(t => t.id);
    assignSameTargetMutation.mutate({ targetIds, startDate: sameTargetStartDate, endDate: sameTargetEndDate });
  };

  return (
    <TargetSystemShell title="Set target" description="Assign targets to users, roles, or bulk same dates.">
    <div className="space-y-4">
      <DrmInlineActions
        items={[
          {
            id: "user",
            label: "Target for user",
            active: activeTab === "user",
            onClick: () => {
              if (activeTab === "user") setShowUserForm(!showUserForm);
              else {
                setActiveTab("user");
                setShowUserForm(true);
              }
            },
          },
          {
            id: "role",
            label: "Target for role",
            active: activeTab === "role",
            onClick: () => {
              if (activeTab === "role") setShowRoleForm(!showRoleForm);
              else {
                setActiveTab("role");
                setShowRoleForm(true);
              }
            },
          },
          {
            id: "same",
            label: "Assign same target",
            active: activeTab === "same",
            onClick: () => setActiveTab("same"),
          },
        ]}
      />

      {activeTab === "same" && (
            <div className="mb-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm mb-1 text-gray-700 dark:text-zinc-400">Start Date</label>
                  <Input type="date" value={sameTargetStartDate} onChange={e => setSameTargetStartDate(e.target.value)} className="h-9" />
                </div>
                <div>
                  <label className="block text-sm mb-1 text-gray-700 dark:text-zinc-400">End Date</label>
                  <Input type="date" value={sameTargetEndDate} onChange={e => setSameTargetEndDate(e.target.value)} className="h-9" />
                </div>
              </div>
              <Button
                type="button"
                variant="primary"
                size="sm"
                className="px-8"
                onClick={handleAssignSameTarget}
                disabled={assignSameTargetMutation.isPending || isLoadingUserTargets}
              >
                {assignSameTargetMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                Set
              </Button>
            </div>
          )}

          {activeTab === "user" && showUserForm && (
            <div className="mb-6">
              <div className="mb-4 max-w-md">
                <label className="block text-sm mb-1 text-gray-700 dark:text-zinc-400">User</label>
                <Select value={selectedUser} onValueChange={setSelectedUser}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Choose .." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Choose ..</SelectItem>
                    {usersData.map((u: any) => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.fullName || u.username} ({u.role})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                type="button"
                variant="primary"
                size="sm"
                className="mb-6 px-8"
                onClick={handleSetUserTarget}
                disabled={assignUserMutation.isPending}
              >
                {assignUserMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                Set
              </Button>
              
              <DrmSection title="Assign target details" description="Select targets, categories, and dates for this user.">
                  <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
                    <Table>
                      <TableHeader className="bg-zinc-50 dark:bg-zinc-950/80">
                        <TableRow className="hover:bg-transparent">
                          <TableHead className="font-bold text-black dark:text-zinc-300">Target Name</TableHead>
                          <TableHead className="font-bold text-black dark:text-zinc-300 text-center">Category</TableHead>
                          <TableHead className="font-bold text-black dark:text-zinc-300 text-center w-32">Number</TableHead>
                          <TableHead className="font-bold text-black dark:text-zinc-300 text-center">Price</TableHead>
                          <TableHead className="font-bold text-black dark:text-zinc-300 text-center">Max Price</TableHead>
                          <TableHead className="font-bold text-black dark:text-zinc-300 text-center">Bonus</TableHead>
                          <TableHead className="font-bold text-black dark:text-zinc-300 text-center w-40">Start Date</TableHead>
                          <TableHead className="font-bold text-black dark:text-zinc-300 text-center w-40">End Date</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {userFormTargets.map((row, index) => (
                          <TableRow key={`uform-${row.id}`}>
                            <TableCell className="font-medium flex items-center space-x-2">
                              <Checkbox 
                                id={`ucheck-${row.id}`} 
                                checked={row.selected}
                                onCheckedChange={(checked) => handleUserFormTargetChange(index, "selected", checked === true)}
                              />
                              <label htmlFor={`ucheck-${row.id}`} className="text-sm font-normal cursor-pointer text-gray-600 dark:text-zinc-300">{row.name}</label>
                            </TableCell>
                            <TableCell className="text-center">
                              <Select value={row.category} onValueChange={(val) => handleUserFormTargetChange(index, "category", val)}>
                                <SelectTrigger className="h-8 w-28 mx-auto text-xs">
                                  <SelectValue placeholder="choose..." />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="none">choose...</SelectItem>
                                  <SelectItem value="AB New Terget">AB New Terget</SelectItem>
                                  <SelectItem value="Renewal Terget">Renewal Terget</SelectItem>
                                  <SelectItem value="VAS">VAS</SelectItem>
                                  <SelectItem value="Team">Team</SelectItem>
                                  <SelectItem value="Dep DD">Dep DD</SelectItem>
                                  <SelectItem value="Dep PP">Dep PP</SelectItem>
                                  <SelectItem value="PP Link">PP Link</SelectItem>
                                  <SelectItem value="Other">Other</SelectItem>
                                </SelectContent>
                              </Select>
                            </TableCell>
                            <TableCell className="text-center">
                              <div className="flex mx-auto w-24">
                                <Button
                                  type="button"
                                  variant="secondary"
                                  className="rounded-r-none px-2 h-8 text-xs"
                                  onClick={() => handleUserFormTargetChange(index, "number", Math.max(0, row.number - 1))}
                                >
                                  -
                                </Button>
                                <Input 
                                  type="number"
                                  value={row.number} 
                                  onChange={(e) => handleUserFormTargetChange(index, "number", Number(e.target.value))}
                                  className="rounded-none text-center h-8 text-xs px-1" 
                                />
                                <Button
                                  type="button"
                                  variant="secondary"
                                  className="rounded-l-none px-2 h-8 text-xs"
                                  onClick={() => handleUserFormTargetChange(index, "number", row.number + 1)}
                                >
                                  +
                                </Button>
                              </div>
                            </TableCell>
                            <TableCell className="text-center text-sm">{row.price}</TableCell>
                            <TableCell className="text-center text-sm">{row.maxPrice}</TableCell>
                            {/* Legacy's own "Bonus" column here actually displays the
                                conversion value (+ "%" when the bonus type is a
                                percentage) — not the bonus-type label itself. */}
                            <TableCell className="text-center text-sm">
                              {row.conversion}{row.bonus === "Percentage %" ? "%" : ""}
                            </TableCell>
                            <TableCell className="text-center">
                              <Input type="date" value={row.startDate} onChange={(e) => handleUserFormTargetChange(index, "startDate", e.target.value)} className="h-8 text-xs w-full" />
                            </TableCell>
                            <TableCell className="text-center">
                              <Input type="date" value={row.endDate} onChange={(e) => handleUserFormTargetChange(index, "endDate", e.target.value)} className="h-8 text-xs w-full" />
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
              </DrmSection>
            </div>
          )}

      {activeTab === "role" && showRoleForm && (
        <div className="mb-6">
          <div className="mb-4 max-w-md">
            <label className="block text-sm mb-1 text-gray-700 dark:text-zinc-400">Role type</label>
            <Select value={roleType} onValueChange={setRoleType}>
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Choose .." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Choose ..</SelectItem>
                <SelectItem value="Sales Manager">Sales Manager</SelectItem>
                <SelectItem value="admin">admin</SelectItem>
                <SelectItem value="Sales Executive">Sales Executive</SelectItem>
                <SelectItem value="Sales Assistant Manager">Sales Assistant Manager</SelectItem>
                <SelectItem value="Service Manager">Service Manager</SelectItem>
                <SelectItem value="Service Assistant Manager">Service Assistant Manager</SelectItem>
                <SelectItem value="Service Executive">Service Executive</SelectItem>
                <SelectItem value="Reception">Reception</SelectItem>
                <SelectItem value="Project manager">Project manager</SelectItem>
                <SelectItem value="Account Manager">Account Manager</SelectItem>
                <SelectItem value="SEO/SMM Manager">SEO/SMM Manager</SelectItem>
                <SelectItem value="Product Posting Manager">Product Posting Manager</SelectItem>
                <SelectItem value="Posting Assistant Manager">Posting Assistant Manager</SelectItem>
                <SelectItem value="Posting Executive">Posting Executive</SelectItem>
                <SelectItem value="SEO/SMM Executive">SEO/SMM Executive</SelectItem>
                <SelectItem value="D&D Manager">D&D Manager</SelectItem>
                <SelectItem value="D&D Assistant Manager">D&D Assistant Manager</SelectItem>
                <SelectItem value="D&D Executive">D&D Executive</SelectItem>
                <SelectItem value="Internship Executive">Internship Executive</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button
            type="button"
            variant="primary"
            size="sm"
            className="mb-6 px-8"
            onClick={handleSetRoleTarget}
            disabled={assignRoleMutation.isPending}
          >
            {assignRoleMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
            Set
          </Button>
          
          <DrmSection title="Assign target details" description="Select targets for this role.">
              <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
                <Table>
                  <TableHeader className="bg-zinc-50 dark:bg-zinc-950/80">
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="font-bold text-black dark:text-zinc-300">Target Name</TableHead>
                      <TableHead className="font-bold text-black dark:text-zinc-300 text-center">Category</TableHead>
                      <TableHead className="font-bold text-black dark:text-zinc-300 text-center w-32">Number</TableHead>
                      <TableHead className="font-bold text-black dark:text-zinc-300 text-center">Price</TableHead>
                      <TableHead className="font-bold text-black dark:text-zinc-300 text-center">Bonus</TableHead>
                      <TableHead className="font-bold text-black dark:text-zinc-300 text-center w-40">Start Date</TableHead>
                      <TableHead className="font-bold text-black dark:text-zinc-300 text-center w-40">End Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {roleTargets.map((row, index) => (
                      <TableRow key={row.id}>
                        <TableCell className="font-medium flex items-center space-x-2">
                          <Checkbox 
                            id={`check-${row.id}`} 
                            checked={row.selected}
                            onCheckedChange={(checked) => handleRoleTargetChange(index, "selected", checked === true)}
                          />
                          <label htmlFor={`check-${row.id}`} className="text-sm font-normal cursor-pointer text-gray-600 dark:text-zinc-300">{row.name}</label>
                        </TableCell>
                        <TableCell className="text-center">
                          <Select value={row.category} onValueChange={(val) => handleRoleTargetChange(index, "category", val)}>
                            <SelectTrigger className="h-8 w-28 mx-auto text-xs">
                              <SelectValue placeholder="choose..." />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">choose...</SelectItem>
                              <SelectItem value="AB New Terget">AB New Terget</SelectItem>
                              <SelectItem value="Renewal Terget">Renewal Terget</SelectItem>
                              <SelectItem value="VAS">VAS</SelectItem>
                              <SelectItem value="Team">Team</SelectItem>
                              <SelectItem value="Dep DD">Dep DD</SelectItem>
                              <SelectItem value="Dep PP">Dep PP</SelectItem>
                              <SelectItem value="Other">Other</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex mx-auto w-24">
                            <Button
                              type="button"
                              variant="secondary"
                              className="rounded-r-none px-2 h-8 text-xs"
                              onClick={() => handleRoleTargetChange(index, "number", Math.max(0, row.number - 1))}
                            >
                              -
                            </Button>
                            <Input 
                              type="number"
                              value={row.number} 
                              onChange={(e) => handleRoleTargetChange(index, "number", Number(e.target.value))}
                              className="rounded-none text-center h-8 text-xs px-1" 
                            />
                            <Button
                              type="button"
                              variant="secondary"
                              className="rounded-l-none px-2 h-8 text-xs"
                              onClick={() => handleRoleTargetChange(index, "number", row.number + 1)}
                            >
                              +
                            </Button>
                          </div>
                        </TableCell>
                        <TableCell className="text-center text-sm">{row.price}</TableCell>
                        <TableCell className="text-center text-sm">{row.maxPrice}</TableCell>
                        {/* Legacy's own "Bonus" column here actually displays the
                            conversion value (+ "%" when the bonus type is a
                            percentage) — not the bonus-type label itself. */}
                        <TableCell className="text-center text-sm">
                          {row.conversion}{row.bonus === "Percentage %" ? "%" : ""}
                        </TableCell>
                        <TableCell className="text-center">
                          <Input type="date" value={row.startDate} onChange={(e) => handleRoleTargetChange(index, "startDate", e.target.value)} className="h-8 text-xs w-full" />
                        </TableCell>
                        <TableCell className="text-center">
                          <Input type="date" value={row.endDate} onChange={(e) => handleRoleTargetChange(index, "endDate", e.target.value)} className="h-8 text-xs w-full" />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
          </DrmSection>
        </div>
      )}

      {/* Legacy's own "Target Details" table (#loc) is always visible
          regardless of which tab is active — not scoped to "Target For
          User"/"Assign Same Target" only. */}
      <DrmSection
        title="Assigned targets"
        description={isLoadingUserTargets ? "Loading…" : `${userTargets.length} assignment(s)`}
      >
          <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
            <Table>
              <TableHeader className="bg-zinc-50 dark:bg-zinc-950/80">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="font-bold text-black dark:text-zinc-300 w-12 text-center">#</TableHead>
                  <TableHead className="font-bold text-black dark:text-zinc-300">Target Name</TableHead>
                  <TableHead className="font-bold text-black dark:text-zinc-300 text-center">Category</TableHead>
                  <TableHead className="font-bold text-black dark:text-zinc-300 text-center">Target</TableHead>
                  <TableHead className="font-bold text-black dark:text-zinc-300 text-center">Price</TableHead>
                  <TableHead className="font-bold text-black dark:text-zinc-300 text-center">Max Price</TableHead>
                  <TableHead className="font-bold text-black dark:text-zinc-300 text-center">Bonus</TableHead>
                  <TableHead className="font-bold text-black dark:text-zinc-300 text-center">Vas</TableHead>
                  <TableHead className="font-bold text-black dark:text-zinc-300 text-center">Kwa</TableHead>
                  <TableHead className="font-bold text-black dark:text-zinc-300 text-center">Reward</TableHead>
                  <TableHead className="font-bold text-black dark:text-zinc-300 text-center">Total</TableHead>
                  <TableHead className="font-bold text-black dark:text-zinc-300 text-center">Start Date</TableHead>
                  <TableHead className="font-bold text-black dark:text-zinc-300 text-center">End Date</TableHead>
                  <TableHead className="font-bold text-black dark:text-zinc-300 text-center">Sign Date</TableHead>
                  <TableHead className="font-bold text-black dark:text-zinc-300 text-center">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoadingUserTargets ? (
                  <TableRow>
                    <TableCell colSpan={15} className="text-center py-8 text-gray-500 dark:text-zinc-400">
                      Loading live data...
                    </TableCell>
                  </TableRow>
                ) : userTargets.length > 0 ? (
                  userTargets.map((row, index) => (
                    <TableRow key={row.id}>
                      <TableCell className="text-center font-medium">{index + 1}</TableCell>
                      <TableCell className="text-sm">{row.targetName}</TableCell>
                      <TableCell className="text-center">{row.category}</TableCell>
                      <TableCell className="text-center tabular-nums font-medium text-emerald-700 dark:text-emerald-400">{row.target}</TableCell>
                      <TableCell className="text-center">{Number(row.price)}</TableCell>
                      <TableCell className="text-center">{Number(row.maxPrice)}</TableCell>
                      {/* func.php's own view handler shows the conversion value here,
                          not the bonus-type label. */}
                      <TableCell className="text-center">{row.conversion}</TableCell>
                      <TableCell className="text-center">{row.vas}</TableCell>
                      <TableCell className="text-center">{row.kwa}</TableCell>
                      <TableCell className="text-center">{row.reward}</TableCell>
                      <TableCell className="text-center">{row.total}</TableCell>
                      <TableCell className="text-center">{row.startDate ? new Date(row.startDate).toLocaleDateString('en-GB') : ""}</TableCell>
                      <TableCell className="text-center">{row.endDate ? new Date(row.endDate).toLocaleDateString('en-GB') : ""}</TableCell>
                      <TableCell className="text-center text-xs">{row.signDate ? new Date(row.signDate).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true }).replace(/,/g, '') : ""}</TableCell>
                      <TableCell className="text-center">
                        <div className="inline-flex justify-center gap-1">
                          <Button type="button" variant="ghost" size="sm" title="Edit" onClick={() => handleEditUserTarget(row)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            title="Delete"
                            className="text-red-600 dark:text-red-400"
                            disabled={deleteUserTargetMutation.isPending}
                            onClick={() => handleDeleteUserTarget(row.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={15} className="text-center py-6 text-gray-500 dark:text-zinc-400">
                      No targets available.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

      </DrmSection>

      <Dialog open={!!editTarget} onOpenChange={(open) => !open && setEditTarget(null)}>
        <DialogContent className={`${tsDialogShellClass} sm:max-w-lg`}>
          <DialogHeader>
            <DialogTitle>Edit Target — {editTarget?.targetName}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs mb-1 text-gray-600 dark:text-zinc-400">Target</label>
              <Input value={editForm.target} onChange={(e) => setEditForm((f) => ({ ...f, target: e.target.value }))} />
            </div>
            <div>
              <label className="block text-xs mb-1 text-gray-600 dark:text-zinc-400">Price</label>
              <Input value={editForm.price} onChange={(e) => setEditForm((f) => ({ ...f, price: e.target.value }))} />
            </div>
            <div>
              <label className="block text-xs mb-1 text-gray-600 dark:text-zinc-400">Max Price</label>
              <Input value={editForm.maxPrice} onChange={(e) => setEditForm((f) => ({ ...f, maxPrice: e.target.value }))} />
            </div>
            <div>
              <label className="block text-xs mb-1 text-gray-600 dark:text-zinc-400">Bonus</label>
              <Input value={editForm.bonus} onChange={(e) => setEditForm((f) => ({ ...f, bonus: e.target.value }))} />
            </div>
            <div>
              <label className="block text-xs mb-1 text-gray-600 dark:text-zinc-400">Vas</label>
              <Input value={editForm.vas} onChange={(e) => setEditForm((f) => ({ ...f, vas: e.target.value }))} />
            </div>
            <div>
              <label className="block text-xs mb-1 text-gray-600 dark:text-zinc-400">Kwa</label>
              <Input value={editForm.kwa} onChange={(e) => setEditForm((f) => ({ ...f, kwa: e.target.value }))} />
            </div>
            <div>
              <label className="block text-xs mb-1 text-gray-600 dark:text-zinc-400">Reward</label>
              <Input value={editForm.reward} onChange={(e) => setEditForm((f) => ({ ...f, reward: e.target.value }))} />
            </div>
            <div>
              <label className="block text-xs mb-1 text-gray-600 dark:text-zinc-400">Conversion</label>
              <Input value={editForm.conversion} onChange={(e) => setEditForm((f) => ({ ...f, conversion: e.target.value }))} />
            </div>
            <div>
              <label className="block text-xs mb-1 text-gray-600 dark:text-zinc-400">Total</label>
              <Input value={editForm.total} onChange={(e) => setEditForm((f) => ({ ...f, total: e.target.value }))} />
            </div>
            <div />
            <div>
              <label className="block text-xs mb-1 text-gray-600 dark:text-zinc-400">Start Date</label>
              <Input type="date" value={editForm.startDate} onChange={(e) => setEditForm((f) => ({ ...f, startDate: e.target.value }))} />
            </div>
            <div>
              <label className="block text-xs mb-1 text-gray-600 dark:text-zinc-400">End Date</label>
              <Input type="date" value={editForm.endDate} onChange={(e) => setEditForm((f) => ({ ...f, endDate: e.target.value }))} />
            </div>
          </div>
          <Button
            type="button"
            variant="primary"
            size="sm"
            className="mt-2"
            onClick={handleSaveEditUserTarget}
            disabled={updateUserTargetMutation.isPending}
          >
            {updateUserTargetMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
            Save
          </Button>
        </DialogContent>
      </Dialog>
    </div>
    </TargetSystemShell>
  );
}
